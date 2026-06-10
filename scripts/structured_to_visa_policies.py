#!/usr/bin/env python3
"""
Mirror the clean `structured-policies` into `visa-policies` as well-formed,
correctly-labelled documents — so the Elastic Agent Builder agent (whose
`advisor.visa_policy_search` tool searches `visa-policies`) finds clean visa
guidance instead of nav-heavy crawl chunks.

Each structured policy becomes one rich, ELSER-embedded requirement_text with the
right destination + purpose.
"""
import os, sys
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
from elasticsearch import Elasticsearch, helpers

es = Elasticsearch(
    os.environ["ELASTICSEARCH_URL"] + ":443",
    api_key=os.environ["ELASTICSEARCH_API_KEY"],
    request_timeout=180, retry_on_timeout=True, max_retries=3,
)


def build_text(s: dict) -> str:
    parts = []
    if s.get("visa_name"):
        parts.append(s["visa_name"] + ".")
    if s.get("summary"):
        parts.append(s["summary"])
    if s.get("fee"):
        parts.append(f"Fee: {s['fee']}.")
    if s.get("processing_time"):
        parts.append(f"Processing time: {s['processing_time']}.")
    if s.get("key_requirements"):
        parts.append("Requirements: " + "; ".join(s["key_requirements"]) + ".")
    if s.get("documents"):
        parts.append("Documents needed: " + "; ".join(s["documents"]) + ".")
    if s.get("steps"):
        parts.append("How to apply: " + "; ".join(s["steps"]) + ".")
    return " ".join(parts)


def main():
    rows = helpers.scan(es, index="structured-policies", query={"query": {"match_all": {}}})
    actions, n = [], 0
    for r in rows:
        s = r["_source"]
        if not s.get("found", True) or not s.get("visa_name"):
            continue
        doc = {
            "nationality": "ALL",
            "destination": s["destination"],
            "purpose": s["purpose"],
            "requirement_text": build_text(s),
            "documents_needed": "; ".join(s.get("documents", [])) or None,
            "fee_usd": None,
            "processing_days": None,
            "source_url": s.get("source_url"),
            "source_name": s.get("source_name"),
            "last_updated": s.get("generated_at"),
        }
        # Stable id so re-runs upsert instead of duplicating.
        actions.append({"_index": "visa-policies",
                        "_id": f"structured-{s['destination']}-{s['purpose']}",
                        "_source": doc})
        n += 1

    ok = 0
    for success, _ in helpers.streaming_bulk(es, actions, chunk_size=25,
                                             request_timeout=180, raise_on_error=False):
        if success:
            ok += 1
    print(f"Mirrored {ok}/{n} structured policies into visa-policies (ELSER embedding async).")


if __name__ == "__main__":
    main()
