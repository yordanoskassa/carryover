import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from app.models.schemas import AdvisorRequest, AdvisorResponse, PolicyResult
from app.services.elastic import es, search_semantic, search_esql
from app.services import agent_builder, gemini

router = APIRouter(prefix="/api/advisor", tags=["advisor"])

# Gemini-structured policies are written back to Elasticsearch as a persistent
# knowledge layer — so they survive restarts and become a queryable artifact
# (this is the "agent insights → Elastic memory" pattern). A tiny in-process
# memo sits in front of it to keep rapid re-clicks snappy.
STRUCTURED_INDEX = "structured-policies"
_STRUCTURE_MEMO: dict[str, dict] = {}
_structured_index_ready = False


def _ensure_structured_index() -> None:
    global _structured_index_ready
    if _structured_index_ready:
        return
    try:
        if not es.indices.exists(index=STRUCTURED_INDEX):
            es.indices.create(index=STRUCTURED_INDEX, mappings={"properties": {
                "route": {"type": "keyword"},
                "nationality": {"type": "keyword"},
                "destination": {"type": "keyword"},
                "purpose": {"type": "keyword"},
                "visa_name": {"type": "text"},
                "summary": {"type": "text"},
                "fee": {"type": "keyword"},
                "processing_time": {"type": "keyword"},
                "key_requirements": {"type": "text"},
                "documents": {"type": "text"},
                "steps": {"type": "text"},
                "source_name": {"type": "keyword"},
                "source_url": {"type": "keyword"},
                "ai_structured": {"type": "boolean"},
                "found": {"type": "boolean"},
                "generated_at": {"type": "date"},
            }})
        _structured_index_ready = True
    except Exception:
        pass


def _shape_grounded(req, g: dict) -> dict:
    """Shape a Gemini-grounded policy into the structured response dict."""
    return {
        "nationality": req.nationality, "destination": req.destination, "purpose": req.purpose,
        "found": True, "ai_structured": True, "grounded": True,
        "visa_name": g.get("visa_name"),
        "summary": g.get("summary"),
        "fee": g.get("fee"),
        "processing_time": g.get("processing_time"),
        "key_requirements": (g.get("key_requirements") or [])[:6],
        "documents": (g.get("documents") or [])[:8],
        "steps": (g.get("steps") or [])[:6],
        "source_name": g.get("source_name") or "Gemini + Google Search",
        "source_url": g.get("source_url"),
    }


def _is_weak(result: dict) -> bool:
    """A result worth trying to improve with grounded search."""
    return not result.get("fee") and len(result.get("key_requirements") or []) < 3


def _load_structured(route_id: str) -> dict | None:
    if route_id in _STRUCTURE_MEMO:
        return _STRUCTURE_MEMO[route_id]
    _ensure_structured_index()
    try:
        doc = es.get(index=STRUCTURED_INDEX, id=route_id)
        if doc.get("found"):
            src = doc["_source"]
            _STRUCTURE_MEMO[route_id] = src
            return src
    except Exception:
        pass
    return None


def _store_structured(route_id: str, result: dict) -> None:
    _STRUCTURE_MEMO[route_id] = result
    _ensure_structured_index()
    try:
        es.index(
            index=STRUCTURED_INDEX,
            id=route_id,
            document={**result, "route": route_id,
                      "generated_at": datetime.now(timezone.utc).isoformat()},
        )
    except Exception:
        pass

# Crawled pages share boilerplate prefixes (cookie banners, nav). Strip a known
# lead so dedup and display don't choke on it.
_BOILERPLATE = ("cookies on", "we use some essential cookies", "skip to main content",
                "accept additional cookies", "hide this message", "additional cookies",
                "understand how you use", "remember your settings", "javascript")


def _strip_boilerplate(text: str) -> str:
    """Remove leading cookie/nav sentences from a crawled page."""
    if not text:
        return ""
    sentences = text.split(". ")
    cleaned = [s for s in sentences if not any(b in s.lower() for b in _BOILERPLATE)]
    return ". ".join(cleaned).strip()


def _dedup_key(text: str) -> str:
    """A dedup key that survives shared boilerplate prefixes."""
    return _strip_boilerplate(text)[:120].lower()


@router.post("/requirements", response_model=AdvisorResponse)
async def get_requirements(req: AdvisorRequest):
    """Get official visa requirements for a nationality→destination route."""

    # 1. ES|QL exact lookup — matches specific nationality OR "ALL" (crawl-derived)
    # Sort structured seed policies (those with a known fee) to the top so the
    # hand-curated data outranks raw crawled pages.
    esql_query = (
        "FROM visa-policies "
        "| WHERE (nationality == ?nationality OR nationality == \"ALL\") "
        "  AND destination == ?destination AND purpose == ?purpose "
        "| KEEP requirement_text, documents_needed, fee_usd, processing_days, "
        "  source_url, source_name, last_updated, purpose "
        "| SORT fee_usd DESC NULLS LAST "
        "| LIMIT 30"
    )
    try:
        esql_result = es.esql.query(
            query=esql_query,
            params=[
                {"nationality": req.nationality},
                {"destination": req.destination},
                {"purpose": req.purpose},
            ],
        )
    except Exception:
        esql_result = {"values": []}

    # 2. Semantic search — filtered by purpose AND destination
    purpose_labels = {
        "student": "student study university education",
        "work": "work employment skilled worker job",
        "family": "family reunion spouse dependent",
        "tourist": "tourist visitor travel short stay",
    }
    purpose_desc = purpose_labels.get(req.purpose, req.purpose)
    query_text = (
        f"{purpose_desc} visa requirements for {req.nationality} citizen "
        f"traveling to {req.destination}"
    )
    try:
        semantic_result = search_semantic(
            index="visa-policies",
            query=query_text,
            size=5,
            filters={"destination": req.destination, "purpose": req.purpose},
        )
    except Exception:
        semantic_result = {"hits": {"hits": []}}

    # 3. Crawled government pages — text search on real embassy/immigration sites
    # Only search crawled pages for the destination's own government host —
    # without a host we'd pull cross-country noise, so skip instead.
    dest_host = DEST_HOST.get(req.destination, "")
    if dest_host:
        try:
            crawl_result = es.search(
                index="crawled-visa-pages",
                body={
                    "size": 5,
                    "query": {"bool": {
                        "must": [{"match": {"body": query_text}}],
                        "filter": [{"term": {"url_host": dest_host}}],
                    }},
                },
            )
        except Exception:
            crawl_result = {"hits": {"hits": []}}
    else:
        crawl_result = {"hits": {"hits": []}}

    # Merge results — deduplicate on requirement_text, not source_url
    requirements = []
    seen = set()

    # From ES|QL (structured policies)
    columns = [c["name"] for c in esql_result.get("columns", [])]
    for row in esql_result.get("values", []):
        record = dict(zip(columns, row))
        text = _strip_boilerplate(record.get("requirement_text") or "")
        key = _dedup_key(text)
        if key and key not in seen:
            seen.add(key)
            requirements.append(PolicyResult(
                requirement_text=text,
                documents_needed=record.get("documents_needed"),
                fee_usd=record.get("fee_usd"),
                processing_days=record.get("processing_days"),
                source_url=record.get("source_url", ""),
                source_name=record.get("source_name", ""),
                last_updated=record.get("last_updated"),
            ))

    # From semantic search (structured policies)
    for hit in semantic_result.get("hits", {}).get("hits", []):
        src = hit["_source"]
        text = _strip_boilerplate(src.get("requirement_text") or "")
        key = _dedup_key(text)
        if key and key not in seen:
            seen.add(key)
            requirements.append(PolicyResult(
                requirement_text=text,
                documents_needed=src.get("documents_needed"),
                fee_usd=src.get("fee_usd"),
                processing_days=src.get("processing_days"),
                source_url=src.get("source_url", ""),
                source_name=src.get("source_name", ""),
                last_updated=src.get("last_updated"),
            ))

    # From crawled government pages (real scraped content)
    for hit in crawl_result.get("hits", {}).get("hits", []):
        src = hit["_source"]
        body = _strip_boilerplate((src.get("body") or "")[:3000])
        title = src.get("title", "")
        key = _dedup_key(title or body)
        if key and key not in seen:
            seen.add(key)
            requirements.append(PolicyResult(
                requirement_text=f"[{title}] {body}" if title else body,
                documents_needed=None,
                fee_usd=None,
                processing_days=None,
                source_url=src.get("url", ""),
                source_name=f"Crawled: {src.get('url_host', '')}",
                last_updated=src.get("last_crawled_at"),
            ))

    return AdvisorResponse(
        nationality=req.nationality,
        destination=req.destination,
        purpose=req.purpose,
        requirements=requirements,
    )


def _clean_policy_text(text: str) -> str:
    """Drop obvious crawl boilerplate before sending to the LLM."""
    junk = ("cookies on", "we use some essential", "javascript", "skip to main",
            "accept additional cookies", "hide this message", "gov.uk")
    lines = [ln.strip() for ln in text.replace("\n", " ").split(". ")]
    kept = [ln for ln in lines if ln and not any(j in ln.lower() for j in junk)]
    return ". ".join(kept)


# Destination → crawled site host, so we can pull the right country's full pages.
DEST_HOST = {
    "GB": "www.gov.uk", "US": "travel.state.gov", "CA": "www.canada.ca",
    "DE": "www.auswaertiges-amt.de", "FR": "france-visas.gouv.fr", "NL": "ind.nl",
    "AE": "icp.gov.ae", "TR": "www.mfa.gov.tr", "AU": "immi.homeaffairs.gov.au",
    "IE": "www.irishimmigration.ie", "SE": "www.migrationsverket.se",
    "DK": "www.nyidanmark.dk", "NO": "www.udi.no", "FI": "migri.fi",
    "AT": "www.migration.gv.at", "CH": "www.sem.admin.ch", "GR": "migration.gov.gr",
    "PT": "vistos.mne.gov.pt", "ES": "www.exteriores.gob.es", "PL": "www.gov.pl",
    "CZ": "mzv.gov.cz", "BE": "dofi.ibz.be", "IT": "vistoperitalia.esteri.it",
    "JP": "www.mofa.go.jp", "SG": "www.ica.gov.sg", "KR": "www.immigration.go.kr",
    "NZ": "www.immigration.govt.nz", "TH": "consular.mfa.go.th",
    "SA": "visitsaudi.com", "QA": "visitqatar.com", "RU": "evisa.kdmid.ru",
    "ZA": "www.dha.gov.za",
}

_PURPOSE_QUERY = {
    "student": "student study visa requirements course tuition fees documents how to apply",
    "work": "work employment permit visa requirements job documents how to apply fees",
    "family": "family join spouse partner visa requirements documents how to apply",
    "tourist": "visitor tourist short stay visa requirements documents how to apply fees",
}

# Long nav strings shared across a site's pages — strip so the LLM sees content.
_NAV_RE = re.compile(
    r"skip to (main )?content.*?(more results\.\.\.|quick links|search)",
    re.IGNORECASE | re.DOTALL,
)


def _fetch_full_pages(destination: str, purpose: str, n: int = 6) -> list[dict]:
    """Top full crawled pages for a route — richer context than indexed chunks."""
    host = DEST_HOST.get(destination)
    query_text = _PURPOSE_QUERY.get(purpose, f"{purpose} visa requirements")
    body = {
        "size": n,
        "query": {"bool": {
            "must": [{"match": {"body": query_text}}],
            "filter": [{"term": {"url_host": host}}] if host else [],
        }},
        "_source": ["title", "body", "url", "url_host"],
    }
    try:
        res = es.search(index="crawled-visa-pages", body=body)
        out = []
        for hit in res.get("hits", {}).get("hits", []):
            src = hit["_source"]
            raw_body = _NAV_RE.sub(" ", (src.get("body") or ""))
            out.append({
                "title": src.get("title", ""),
                "body": _clean_policy_text(raw_body)[:2800],
                "url": src.get("url", ""),
                "host": src.get("url_host", ""),
            })
        return out
    except Exception:
        return []


@router.post("/structured")
async def structured_requirements(req: AdvisorRequest):
    """LLM-structured visa requirements: messy crawled policy text → clean fields.

    Falls back to the raw structured policy fields when Gemini is unavailable.
    """
    route_id = f"{req.nationality}-{req.destination}-{req.purpose}"

    # Firecrawl-curated policies (keyed ALL-<dest>-<purpose>) are authoritative —
    # they carry the exact fees/funds the Open Crawler couldn't reach inline.
    curated = _load_structured(f"ALL-{req.destination}-{req.purpose}")
    if curated:
        return {**curated, "nationality": req.nationality,
                "destination": req.destination, "purpose": req.purpose}

    stored = _load_structured(route_id)
    if stored:
        return stored

    base = await get_requirements(req)
    reqs = base.requirements

    if not reqs:
        # No data in Elastic for this route — let Gemini fill it via Google Search
        # grounding, then write the result back so the index keeps growing.
        g = await gemini.structure_policy_grounded(req.nationality, req.destination, req.purpose)
        if g:
            result = _shape_grounded(req, g)
            _store_structured(route_id, result)
            return result
        return {
            "nationality": req.nationality, "destination": req.destination, "purpose": req.purpose,
            "found": False, "ai_structured": False,
            "visa_name": None, "summary": None, "fee": None, "processing_time": None,
            "key_requirements": [], "documents": [], "steps": [],
            "source_name": None, "source_url": None,
        }

    # Lead with clean structured/seed text, then add full crawled pages for the
    # route so the LLM has the real fees, steps, and documents (not nav-heavy chunks).
    # Full crawled pages carry the real fees/steps; lead with them. Seed text
    # (clean curated policies, when present) follows.
    seed_text = _clean_policy_text("\n\n".join(r.requirement_text for r in reqs[:3]))
    pages = _fetch_full_pages(req.destination, req.purpose)
    page_text = "\n\n".join(f"[{p['title']}]\n{p['body']}" for p in pages if p["body"])
    raw = (page_text + "\n\n" + seed_text).strip()

    fee_hint = next((r.fee_usd for r in reqs if r.fee_usd), None)
    days_hint = next((r.processing_days for r in reqs if r.processing_days), None)
    # Prefer a structured/seed source; else the first crawled page for the route.
    source = next((r for r in reqs if r.fee_usd and r.source_url), None)
    if source is None and pages:
        source = type("S", (), {"source_name": f"{pages[0]['host']}", "source_url": pages[0]["url"]})()
    if source is None:
        source = next((r for r in reqs if r.source_url), reqs[0])

    structured = await gemini.structure_policy(
        req.nationality, req.destination, req.purpose, raw, fee_hint, days_hint,
    )

    if structured:
        result = {
            "nationality": req.nationality, "destination": req.destination, "purpose": req.purpose,
            "found": True, "ai_structured": True,
            "visa_name": structured.get("visa_name"),
            "summary": structured.get("summary"),
            "fee": structured.get("fee") or (f"${fee_hint:.0f}" if fee_hint else None),
            "processing_time": structured.get("processing_time") or (f"~{days_hint} days" if days_hint else None),
            "key_requirements": structured.get("key_requirements", [])[:6],
            "documents": structured.get("documents", [])[:8],
            "steps": structured.get("steps", [])[:6],
            "source_name": source.source_name,
            "source_url": source.source_url,
        }
    else:
        # No-LLM fallback: lightly structured from raw fields
        first = reqs[0]
        sentences = [s.strip() for s in first.requirement_text.split(". ") if s.strip()]
        result = {
            "nationality": req.nationality, "destination": req.destination, "purpose": req.purpose,
            "found": True, "ai_structured": False,
            "visa_name": None,
            "summary": (sentences[0] + ".") if sentences else first.requirement_text[:200],
            "fee": f"${fee_hint:.0f}" if fee_hint else None,
            "processing_time": f"~{days_hint} days" if days_hint else None,
            "key_requirements": [s for s in sentences[1:6]],
            "documents": [d.strip() for d in (first.documents_needed or "").split(",") if d.strip()][:8],
            "steps": [],
            "source_name": source.source_name,
            "source_url": source.source_url,
        }

    # If the crawl-derived result is thin (no fee, few requirements), let grounded
    # Gemini fill the gap — and write the richer version back to Elastic.
    if _is_weak(result):
        g = await gemini.structure_policy_grounded(req.nationality, req.destination, req.purpose)
        if g and (g.get("fee") or len(g.get("key_requirements") or []) >= 3):
            result = _shape_grounded(req, g)

    _store_structured(route_id, result)
    return result


@router.post("/ask")
async def ask_advisor(req: AdvisorRequest, question: str = ""):
    """Ask the Advisor agent a natural language question via Agent Builder chat."""
    message = (
        f"I am a citizen of {req.nationality} wanting to go to {req.destination} "
        f"for {req.purpose}. {question or 'What are the visa requirements?'}"
    )
    try:
        result = await agent_builder.chat("elastipath-advisor", message)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent Builder error: {str(e)}")
