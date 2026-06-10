#!/usr/bin/env python3
"""
Process crawled visa pages into structured visa-policies documents.

Reads raw pages from 'crawled-visa-pages' index, uses the page content
to create structured visa policy entries in 'visa-policies' index.
This script parses the crawled data by URL pattern to determine
destination country, visa purpose, and extracts requirement details.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from elasticsearch import Elasticsearch

es = Elasticsearch(
    os.environ["ELASTICSEARCH_URL"] + ":443",
    api_key=os.environ["ELASTICSEARCH_API_KEY"],
)

# ── URL → metadata mapping ──────────────────────────────────────────────────
# Maps URL patterns to destination country and visa purpose
URL_RULES = [
    # UK — gov.uk
    {"host": "www.gov.uk", "path_contains": "student-visa",         "dest": "GB", "purpose": "student",  "source_name": "UK Home Office"},
    {"host": "www.gov.uk", "path_contains": "graduate-visa",        "dest": "GB", "purpose": "student",  "source_name": "UK Home Office"},
    {"host": "www.gov.uk", "path_contains": "skilled-worker-visa",  "dest": "GB", "purpose": "work",     "source_name": "UK Home Office"},
    {"host": "www.gov.uk", "path_contains": "health-care-worker",   "dest": "GB", "purpose": "work",     "source_name": "UK Home Office"},
    {"host": "www.gov.uk", "path_contains": "global-talent",        "dest": "GB", "purpose": "work",     "source_name": "UK Home Office"},
    {"host": "www.gov.uk", "path_contains": "family-visa",          "dest": "GB", "purpose": "family",   "source_name": "UK Home Office"},
    {"host": "www.gov.uk", "path_contains": "standard-visitor",     "dest": "GB", "purpose": "tourist",  "source_name": "UK Home Office"},
    {"host": "www.gov.uk", "path_contains": "check-uk-visa",        "dest": "GB", "purpose": "tourist",  "source_name": "UK Home Office"},
    {"host": "www.gov.uk", "path_contains": "tb-test-visa",         "dest": "GB", "purpose": "student",  "source_name": "UK Home Office"},
    {"host": "www.gov.uk", "path_contains": "healthcare-immigration","dest": "GB", "purpose": "work",    "source_name": "UK Home Office"},

    # US — travel.state.gov
    {"host": "travel.state.gov", "path_contains": "student-visa",           "dest": "US", "purpose": "student",  "source_name": "US Dept of State"},
    {"host": "travel.state.gov", "path_contains": "exchange",               "dest": "US", "purpose": "student",  "source_name": "US Dept of State"},
    {"host": "travel.state.gov", "path_contains": "temporary-worker",       "dest": "US", "purpose": "work",     "source_name": "US Dept of State"},
    {"host": "travel.state.gov", "path_contains": "employment",             "dest": "US", "purpose": "work",     "source_name": "US Dept of State"},
    {"host": "travel.state.gov", "path_contains": "family-immigration",     "dest": "US", "purpose": "family",   "source_name": "US Dept of State"},
    {"host": "travel.state.gov", "path_contains": "diversity-visa",         "dest": "US", "purpose": "family",   "source_name": "US Dept of State"},
    {"host": "travel.state.gov", "path_contains": "visitor",                "dest": "US", "purpose": "tourist",  "source_name": "US Dept of State"},
    {"host": "travel.state.gov", "path_contains": "visa-waiver",            "dest": "US", "purpose": "tourist",  "source_name": "US Dept of State"},
    {"host": "travel.state.gov", "path_contains": "fees",                   "dest": "US", "purpose": "tourist",  "source_name": "US Dept of State"},

    # Canada — canada.ca
    {"host": "www.canada.ca", "path_contains": "study-canada",        "dest": "CA", "purpose": "student",  "source_name": "IRCC Canada"},
    {"host": "www.canada.ca", "path_contains": "work-canada",         "dest": "CA", "purpose": "work",     "source_name": "IRCC Canada"},
    {"host": "www.canada.ca", "path_contains": "visit-canada",        "dest": "CA", "purpose": "tourist",  "source_name": "IRCC Canada"},
    {"host": "www.canada.ca", "path_contains": "express-entry",       "dest": "CA", "purpose": "work",     "source_name": "IRCC Canada"},
    {"host": "www.canada.ca", "path_contains": "family-sponsorship",  "dest": "CA", "purpose": "family",   "source_name": "IRCC Canada"},

    # Germany
    {"host": "www.auswaertiges-amt.de", "path_contains": "visa",      "dest": "DE", "purpose": "tourist",  "source_name": "German Federal Foreign Office"},
    {"host": "www.auswaertiges-amt.de", "path_contains": "national",  "dest": "DE", "purpose": "work",     "source_name": "German Federal Foreign Office"},
    {"host": "www.auswaertiges-amt.de", "path_contains": "schengen",  "dest": "DE", "purpose": "tourist",  "source_name": "German Federal Foreign Office"},

    # France
    {"host": "france-visas.gouv.fr", "path_contains": "short-stay",   "dest": "FR", "purpose": "tourist",  "source_name": "France-Visas"},
    {"host": "france-visas.gouv.fr", "path_contains": "long-stay",    "dest": "FR", "purpose": "work",     "source_name": "France-Visas"},
    {"host": "france-visas.gouv.fr", "path_contains": "student",      "dest": "FR", "purpose": "student",  "source_name": "France-Visas"},
    {"host": "france-visas.gouv.fr", "path_contains": "france-visas", "dest": "FR", "purpose": "tourist",  "source_name": "France-Visas"},

    # Netherlands
    {"host": "ind.nl", "path_contains": "schengen",    "dest": "NL", "purpose": "tourist",  "source_name": "IND Netherlands"},
    {"host": "ind.nl", "path_contains": "working",     "dest": "NL", "purpose": "work",     "source_name": "IND Netherlands"},
    {"host": "ind.nl", "path_contains": "studying",    "dest": "NL", "purpose": "student",  "source_name": "IND Netherlands"},
    {"host": "ind.nl", "path_contains": "family",      "dest": "NL", "purpose": "family",   "source_name": "IND Netherlands"},

    # UAE
    {"host": "icp.gov.ae", "path_contains": "entry-permits",  "dest": "AE", "purpose": "tourist",  "source_name": "UAE ICP"},
    {"host": "icp.gov.ae", "path_contains": "residency",      "dest": "AE", "purpose": "work",     "source_name": "UAE ICP"},
    {"host": "icp.gov.ae", "path_contains": "visa",           "dest": "AE", "purpose": "tourist",  "source_name": "UAE ICP"},

    # Turkey
    {"host": "www.mfa.gov.tr",  "path_contains": "visa",  "dest": "TR", "purpose": "tourist",  "source_name": "Turkey MFA"},
    {"host": "www.evisa.gov.tr","path_contains": "/en",    "dest": "TR", "purpose": "tourist",  "source_name": "Turkey e-Visa"},

    # Australia
    {"host": "immi.homeaffairs.gov.au", "path_contains": "student-500",      "dest": "AU", "purpose": "student",  "source_name": "Australia Home Affairs"},
    {"host": "immi.homeaffairs.gov.au", "path_contains": "skilled",          "dest": "AU", "purpose": "work",     "source_name": "Australia Home Affairs"},
    {"host": "immi.homeaffairs.gov.au", "path_contains": "temporary-skill",  "dest": "AU", "purpose": "work",     "source_name": "Australia Home Affairs"},
    {"host": "immi.homeaffairs.gov.au", "path_contains": "visitor-600",      "dest": "AU", "purpose": "tourist",  "source_name": "Australia Home Affairs"},
    {"host": "immi.homeaffairs.gov.au", "path_contains": "partner",          "dest": "AU", "purpose": "family",   "source_name": "Australia Home Affairs"},
    {"host": "immi.homeaffairs.gov.au", "path_contains": "visa-finder",      "dest": "AU", "purpose": "tourist",  "source_name": "Australia Home Affairs"},
]

# All nationalities we support (these apply to ALL crawled policies)
NATIONALITIES = ["ET", "NG", "IN", "PK", "BD", "KE", "SO", "ER", "GH", "PH",
                 "EG", "MA", "LK", "NP", "AF", "IQ", "SY", "YE", "SD", "CM"]


# ── Generic host → destination mapping ─────────────────────────────────────
# Fallback for hosts without explicit URL_RULES: destination comes from the
# host, purpose is detected from keywords in the URL and page title.
HOST_MAP = {
    # Europe — Nordics + Ireland
    "irishimmigration.ie":     ("IE", "Irish Immigration Service"),
    "migrationsverket.se":     ("SE", "Swedish Migration Agency"),
    "nyidanmark.dk":           ("DK", "New to Denmark (SIRI)"),
    "udi.no":                  ("NO", "Norwegian Directorate of Immigration"),
    "migri.fi":                ("FI", "Finnish Immigration Service"),
    # Europe — Central / South
    "migration.gv.at":         ("AT", "Austrian Migration Portal"),
    "sem.admin.ch":            ("CH", "Swiss State Secretariat for Migration"),
    "migration.gov.gr":        ("GR", "Greek Ministry of Migration"),
    "vistos.mne.gov.pt":       ("PT", "Portugal MFA Visa Portal"),
    "exteriores.gob.es":       ("ES", "Spain Ministry of Foreign Affairs"),
    "gov.pl":                  ("PL", "Poland Office for Foreigners"),
    "mzv.gov.cz":              ("CZ", "Czech Ministry of Foreign Affairs"),
    "dofi.ibz.be":             ("BE", "Belgium Immigration Office"),
    "vistoperitalia.esteri.it": ("IT", "Italy MFA Visa Portal"),
    # Asia-Pacific
    "mofa.go.jp":              ("JP", "Japan Ministry of Foreign Affairs"),
    "ica.gov.sg":              ("SG", "Singapore ICA"),
    "immigration.go.kr":       ("KR", "Korea Immigration Service"),
    "china-embassy.gov.cn":    ("CN", "Chinese Embassy Consular Affairs"),
    "immigration.govt.nz":     ("NZ", "Immigration New Zealand"),
    "consular.mfa.go.th":      ("TH", "Thailand MFA Consular Department"),
    # Gulf + Russia + Africa
    "visitsaudi.com":          ("SA", "Visit Saudi (official)"),
    "mofa.gov.sa":             ("SA", "Saudi Ministry of Foreign Affairs"),
    "visitqatar.com":          ("QA", "Visit Qatar (official)"),
    "evisa.kdmid.ru":          ("RU", "Russia e-Visa Portal"),
    "dha.gov.za":              ("ZA", "South Africa Home Affairs"),
}

PURPOSE_KEYWORDS = [
    ("student", ("student", "study", "studies", "studying", "education", "school")),
    ("work",    ("work", "employ", "skilled", "labour", "labor", "job", "business", "talent", "residence")),
    ("family",  ("family", "spouse", "partner", "join", "reunif", "marriage", "dependent")),
    ("tourist", ("visit", "tourist", "tourism", "schengen", "short-stay", "short_stay", "holiday", "travel")),
]


def detect_purpose(text: str) -> str:
    text = text.lower()
    for purpose, keywords in PURPOSE_KEYWORDS:
        if any(kw in text for kw in keywords):
            return purpose
    return "tourist"


def classify_page(url: str, url_host: str, title: str = "") -> dict | None:
    """Match a crawled page URL to destination/purpose metadata."""
    url_lower = url.lower()
    host = (url_host or "").lower()

    for rule in URL_RULES:
        if rule["host"] in host and rule["path_contains"] in url_lower:
            return {
                "destination": rule["dest"],
                "purpose": rule["purpose"],
                "source_name": rule["source_name"],
            }

    for host_key, (dest, source_name) in HOST_MAP.items():
        if host_key in host:
            return {
                "destination": dest,
                "purpose": detect_purpose(f"{url_lower} {title}"),
                "source_name": source_name,
            }

    return None


def chunk_text(text: str, max_chars: int = 2000) -> list[str]:
    """Split long text into chunks at paragraph boundaries."""
    if not text or len(text) <= max_chars:
        return [text] if text else []

    chunks = []
    paragraphs = text.split("\n\n")
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chars and current:
            chunks.append(current.strip())
            current = para
        else:
            current = current + "\n\n" + para if current else para

    if current.strip():
        chunks.append(current.strip())

    return chunks


def process_pages():
    """Read crawled pages and create structured visa-policies entries."""
    print("Reading crawled pages from Elasticsearch...")

    # Scroll through all crawled pages
    resp = es.search(
        index="crawled-visa-pages",
        body={"query": {"match_all": {}}, "size": 500},
        scroll="5m",
    )

    scroll_id = resp["_scroll_id"]
    hits = resp["hits"]["hits"]
    all_hits = list(hits)

    while hits:
        resp = es.scroll(scroll_id=scroll_id, scroll="5m")
        hits = resp["hits"]["hits"]
        all_hits.extend(hits)

    print(f"Found {len(all_hits)} crawled pages")

    # Process each page
    policies = []
    classified = 0
    skipped = 0

    for hit in all_hits:
        src = hit["_source"]
        url = src.get("url", "")
        url_host = src.get("url_host", "")
        body = src.get("body", "") or src.get("body_content", "")
        title = src.get("title", "")

        if not body or len(body) < 100:
            skipped += 1
            continue

        meta = classify_page(url, url_host, title)
        if not meta:
            skipped += 1
            continue

        classified += 1

        # Chunk the body content into digestible pieces
        chunks = chunk_text(body, max_chars=3000)

        for i, chunk in enumerate(chunks):
            # Create a policy document for each nationality
            # For efficiency, we create one "universal" policy per chunk
            # The advisor filters by destination + purpose, nationality is for display
            policy = {
                "nationality": "ALL",  # applies to all nationalities
                "destination": meta["destination"],
                "purpose": meta["purpose"],
                "requirement_text": chunk,
                "documents_needed": None,
                "fee_usd": None,
                "processing_days": None,
                "source_url": url,
                "source_name": meta["source_name"],
                "last_updated": src.get("last_crawled_at"),
                "language": "en",
                "page_title": title,
            }
            policies.append(policy)

    print(f"Classified {classified} pages, skipped {skipped}")
    print(f"Generated {len(policies)} visa policy chunks")

    if not policies:
        print("No policies to index!")
        return

    # Clear old crawl-derived policies (keep seed data which has specific nationalities)
    try:
        es.delete_by_query(
            index="visa-policies",
            body={"query": {"term": {"nationality": "ALL"}}},
            refresh=True,
        )
        print("Cleared old crawl-derived policies")
    except Exception as e:
        print(f"Note: {e}")

    # Bulk index in batches of 100
    from app.services.elastic import bulk_index

    batch_size = 100
    for i in range(0, len(policies), batch_size):
        batch = policies[i : i + batch_size]
        result = bulk_index("visa-policies", batch)
        errors = result.get("errors", False)
        print(f"  Indexed batch {i // batch_size + 1}: {len(batch)} docs, errors={errors}")

    # Final count
    import time
    time.sleep(2)
    count = es.count(index="visa-policies")
    print(f"\nTotal visa-policies documents: {count['count']}")

    # Breakdown by destination
    for dest in ["GB", "US", "CA", "DE", "FR", "NL", "AE", "TR", "AU"]:
        c = es.count(index="visa-policies", body={"query": {"term": {"destination": dest}}})
        print(f"  {dest}: {c['count']} docs")


if __name__ == "__main__":
    process_pages()
