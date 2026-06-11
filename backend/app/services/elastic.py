from elasticsearch import Elasticsearch
from app.config import get_settings

settings = get_settings()

# Elastic Cloud URLs need a scheme and explicit port for the Python client.
_es_url = settings.elasticsearch_url.strip()
if _es_url and "://" not in _es_url:
    _es_url = "https://" + _es_url
if _es_url.startswith("https://") and ":" not in _es_url.split("//", 1)[1]:
    _es_url += ":443"


class _UnconfiguredES:
    """Stand-in when ELASTICSEARCH_URL is unset: the app still boots (so
    /health works and the container doesn't crash-loop) and any actual
    Elastic call fails with a clear message instead of a deep traceback."""

    def __getattr__(self, name):
        raise RuntimeError(
            "Elasticsearch is not configured — set the ELASTICSEARCH_URL and "
            "ELASTICSEARCH_API_KEY environment variables."
        )


es = (
    Elasticsearch(_es_url, api_key=settings.elasticsearch_api_key)
    if _es_url
    else _UnconfiguredES()
)


# ---------------------------------------------------------------------------
# Index definitions — semantic_text fields get ELSER embeddings automatically
# ---------------------------------------------------------------------------

INDEX_MAPPINGS = {
    "visa-policies": {
        "_meta": {
            "description": (
                "Official visa requirements per nationality-destination route. "
                "Crawled from embassy and immigration authority websites. "
                "Use for answering visa requirement questions and detecting "
                "contradictions in agency claims."
            )
        },
        "properties": {
            "nationality": {"type": "keyword"},
            "destination": {"type": "keyword"},
            "purpose": {"type": "keyword"},
            "requirement_text": {"type": "semantic_text"},
            "documents_needed": {"type": "text"},
            "fee_usd": {"type": "float"},
            "processing_days": {"type": "integer"},
            "source_url": {"type": "keyword"},
            "source_name": {"type": "keyword"},
            "last_updated": {"type": "date"},
            "language": {"type": "keyword"},
            "raw_page_text": {"type": "semantic_text"},
        },
    },
    "known-scams": {
        "_meta": {
            "description": (
                "Labeled scam posts, fraud complaint narratives, and agency "
                "identifiers. Used for semantic similarity matching against "
                "new agency claims. Includes CFPB complaints and user reports."
            )
        },
        "properties": {
            "post_text": {"type": "semantic_text"},
            "scam_category": {"type": "keyword"},
            "subcategory": {"type": "keyword"},
            "phone": {"type": "keyword"},
            "account_handle": {"type": "keyword"},
            "bank_account": {"type": "keyword"},
            "agency_name": {"type": "keyword"},
            "corridor": {"type": "keyword"},
            "platform": {"type": "keyword"},
            "confidence": {"type": "float"},
            "source": {"type": "keyword"},
            "date_reported": {"type": "date"},
            "country": {"type": "keyword"},
        },
    },
    "agency-posts": {
        "_meta": {
            "description": (
                "Ingested agency posts from Telegram, Facebook, and other "
                "platforms. Normalized and indexed for scam pattern matching "
                "and identity reuse detection."
            )
        },
        "properties": {
            "agency_name": {"type": "keyword"},
            "post_text": {"type": "semantic_text"},
            "platform": {"type": "keyword"},
            "group_name": {"type": "keyword"},
            "phone": {"type": "keyword"},
            "account_handle": {"type": "keyword"},
            "url": {"type": "keyword"},
            "timestamp": {"type": "date"},
            "corridor": {"type": "keyword"},
            "language": {"type": "keyword"},
        },
    },
    "policy-history": {
        "_meta": {
            "description": (
                "Time-stamped snapshots of visa policies for change detection. "
                "Watchtower compares consecutive snapshots to detect rule changes."
            )
        },
        "properties": {
            "route": {"type": "keyword"},
            "snapshot_date": {"type": "date"},
            "policy_text": {"type": "text"},
            "requirements_hash": {"type": "keyword"},
            "source_url": {"type": "keyword"},
            "changes_detected": {"type": "boolean"},
            "diff_summary": {"type": "text"},
        },
    },
    "user-subscriptions": {
        "_meta": {
            "description": "User corridor subscriptions for Watchtower alerts."
        },
        "properties": {
            "user_id": {"type": "keyword"},
            "corridor": {"type": "keyword"},
            "email": {"type": "keyword"},
            "language": {"type": "keyword"},
            "created_at": {"type": "date"},
        },
    },
}


def create_indices():
    """Create all Carryover indices with proper mappings."""
    results = {}
    for index_name, mapping in INDEX_MAPPINGS.items():
        if es.indices.exists(index=index_name):
            results[index_name] = "already exists"
        else:
            es.indices.create(index=index_name, mappings=mapping)
            results[index_name] = "created"
    return results


def search_semantic(index: str, query: str, size: int = 10, filters: dict | None = None):
    """Run a semantic search using ELSER on a semantic_text field."""
    body: dict = {
        "size": size,
        "query": {
            "bool": {
                "must": [{"semantic": {"field": _semantic_field(index), "query": query}}],
                "filter": _build_filters(filters) if filters else [],
            }
        },
    }
    return es.search(index=index, body=body)


def search_esql(query: str, params: dict | None = None):
    """Execute an ES|QL query directly."""
    body: dict = {"query": query}
    if params:
        body["params"] = params
    return es.esql.query(body=body)


def bulk_index(index: str, documents: list[dict], id_field: str | None = None):
    """Bulk index documents into an Elasticsearch index."""
    operations = []
    for doc in documents:
        meta = {"index": {"_index": index}}
        if id_field and id_field in doc:
            meta["index"]["_id"] = doc[id_field]
        operations.append(meta)
        operations.append(doc)
    return es.bulk(operations=operations, refresh="wait_for")


def _semantic_field(index: str) -> str:
    """Return the primary semantic_text field for an index."""
    field_map = {
        "visa-policies": "requirement_text",
        "known-scams": "post_text",
        "agency-posts": "post_text",
    }
    return field_map.get(index, "post_text")


def _build_filters(filters: dict) -> list:
    """Convert a dict of field:value into ES term filters."""
    return [{"term": {k: v}} for k, v in filters.items()]


# ---------------------------------------------------------------------------
# Contact discovery — official emails published in the crawled pages
# ---------------------------------------------------------------------------

import re as _re

# Official immigration-authority hosts present in crawled-visa-pages, and the
# email domains accepted as "officially published" for each destination.
OFFICIAL_SOURCES: dict[str, dict[str, list[str]]] = {
    # gov.uk hosts every UK department — only Home Office / UKVI addresses
    # are the right desk for visa fraud.
    "GB": {"hosts": ["www.gov.uk"], "domains": ["homeoffice.gov.uk", "ukvi.gov.uk"]},
    "US": {"hosts": ["travel.state.gov"], "domains": ["state.gov"]},
    "CA": {"hosts": ["www.canada.ca"], "domains": ["canada.ca", "cic.gc.ca", "gc.ca"]},
    "IE": {"hosts": ["www.irishimmigration.ie"], "domains": ["irishimmigration.ie", "justice.ie"]},
    "NO": {"hosts": ["www.udi.no"], "domains": ["udi.no"]},
    "FI": {"hosts": ["migri.fi"], "domains": ["migri.fi"]},
    "SE": {"hosts": ["www.migrationsverket.se"], "domains": ["migrationsverket.se"]},
    "DK": {"hosts": ["www.nyidanmark.dk"], "domains": ["nyidanmark.dk", "us.dk", "siri.dk"]},
    "DE": {"hosts": ["www.auswaertiges-amt.de"], "domains": ["auswaertiges-amt.de", "diplo.de"]},
    "CH": {"hosts": ["www.sem.admin.ch"], "domains": ["sem.admin.ch", "admin.ch"]},
    "AT": {"hosts": ["www.migration.gv.at"], "domains": ["migration.gv.at", "gv.at"]},
    "BE": {"hosts": ["dofi.ibz.be"], "domains": ["ibz.be"]},
    "CZ": {"hosts": ["mzv.gov.cz"], "domains": ["mzv.gov.cz", "gov.cz"]},
    "GR": {"hosts": ["migration.gov.gr"], "domains": ["migration.gov.gr", "gov.gr"]},
    "PT": {"hosts": ["vistos.mne.gov.pt"], "domains": ["mne.gov.pt", "gov.pt"]},
    "SG": {"hosts": ["www.ica.gov.sg"], "domains": ["ica.gov.sg", "gov.sg"]},
    "TR": {"hosts": ["www.mfa.gov.tr", "www.evisa.gov.tr"], "domains": ["mfa.gov.tr", "gov.tr"]},
    "SA": {"hosts": ["www.mofa.gov.sa", "www.visitsaudi.com"], "domains": ["mofa.gov.sa", "gov.sa"]},
    "AE": {"hosts": ["icp.gov.ae"], "domains": ["icp.gov.ae", "gov.ae"]},
    "QA": {"hosts": ["visitqatar.com"], "domains": ["visitqatar.com", "gov.qa"]},
}

_EMAIL_RE = _re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_EMAIL_JUNK = _re.compile(
    r"noreply|no-reply|donotreply|webmaster|postmaster|abuse|privacy|press|news"
    r"|firstname|lastname|example|sentry|\.png|\.jpg|\.gif",
    _re.IGNORECASE,
)
_LOCAL_HINTS = _re.compile(
    r"visa|immigra|migrat|consul|embassy|info|contact|enquir|inquir|report|fraud|help|support",
    _re.IGNORECASE,
)


def find_official_contact_email(destination: str) -> dict | None:
    """Best officially-published contact email for a destination, mined from
    the government pages the Open Crawler indexed into crawled-visa-pages.

    Returns {"email", "source_host"} or None. Heuristic scoring: the address
    must sit on the authority's own domain; service-desk style local parts
    (visa/info/contact/...) and cross-page frequency win over one-off
    addresses like a press desk.
    """
    src = OFFICIAL_SOURCES.get((destination or "").strip().upper())
    if not src:
        return None
    try:
        res = es.search(
            index="crawled-visa-pages",
            size=80,
            query={
                "bool": {
                    "filter": [{"terms": {"url_host": src["hosts"]}}],
                    "should": [{"match": {"body": "email contact enquiries"}}],
                }
            },
            _source=["body", "url_host"],
        )
    except Exception:
        return None

    scores: dict[str, float] = {}
    for hit in res.get("hits", {}).get("hits", []):
        body = hit["_source"].get("body") or ""
        for addr in set(_EMAIL_RE.findall(body)):
            addr = addr.lower().strip(".")
            if _EMAIL_JUNK.search(addr):
                continue
            local, _, domain = addr.partition("@")
            if not any(domain == d or domain.endswith("." + d) for d in src["domains"]):
                continue
            s = scores.get(addr, 0.0) + 1.0           # cross-page frequency
            if addr not in scores:
                if _LOCAL_HINTS.search(local):
                    s += 20.0                          # service-desk local part
                if local == domain.split(".")[0]:
                    s += 10.0                          # main inbox (migri@migri.fi)
            scores[addr] = s

    if not scores:
        return None
    best, score = max(scores.items(), key=lambda kv: kv[1])
    if score < 10:                                     # press desks, one-offs
        return None
    return {"email": best, "source_host": src["hosts"][0]}
