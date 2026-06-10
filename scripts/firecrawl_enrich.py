#!/usr/bin/env python3
"""
Firecrawl enrichment → Elasticsearch.

For destinations whose government sites hide fees/funds behind links or PDFs the
Elastic Open Crawler can't follow, we use Firecrawl's structured `extract` to pull
the exact figures, then index them into the `structured-policies` index keyed as
ALL-<dest>-<purpose>. The Advisor treats these as authoritative for every
nationality on that route.

This keeps Elasticsearch the single source the agent searches; Firecrawl is just a
supplementary ingestion path for the gap pages. The POLICIES below are the verbatim
output of Firecrawl extract runs (see git history / the chat that produced them).
"""
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from elasticsearch import Elasticsearch

es = Elasticsearch(
    os.environ["ELASTICSEARCH_URL"] + ":443",
    api_key=os.environ["ELASTICSEARCH_API_KEY"],
    request_timeout=60,
)

STRUCTURED_INDEX = "structured-policies"

# Each entry is Firecrawl-extracted official data for one route.
POLICIES = [
    {
        "destination": "IE", "purpose": "student",
        "visa_name": "Long Stay (Type D) Student Visa",
        "summary": ("A long-stay study visa for non-EU students accepted onto an approved "
                    "course in Ireland for more than 90 days. You must show sufficient funds "
                    "and hold private medical insurance."),
        "fee": "€60 single entry / €100 multiple entry",
        "processing_time": "approximately 8 weeks",
        "key_requirements": [
            "Acceptance onto an approved course (on the ILEP list)",
            "Evidence of at least €7,000 per year in available funds",
            "Private medical insurance",
            "Evidence of English language proficiency",
        ],
        "documents": [
            "Passport and passport photographs",
            "Letter of acceptance from the college",
            "Proof of course fee payment",
            "Financial summary form / evidence of funds",
            "Private medical insurance",
            "Evidence of English language ability",
            "Accommodation details",
        ],
        "steps": [
            "Get accepted onto an approved course and pay the course fees",
            "Create your visa application online via AVATS",
            "Pay the visa fee (€60 single / €100 multiple entry)",
            "Submit the signed summary form with your supporting documents",
        ],
        "source_name": "Irish Immigration Service",
        "source_url": "https://www.irishimmigration.ie/coming-to-study-in-ireland/",
    },
    {
        "destination": "NO", "purpose": "student",
        "visa_name": "Study Permit (Norway)",
        "summary": ("A residence permit for non-EU/EEA students admitted full-time to a Norwegian "
                    "university or university college. You must prove you can support yourself and "
                    "have somewhere to live."),
        "fee": "NOK 5,400",
        "processing_time": "up to 12 months",
        "key_requirements": [
            "Admission to an approved university or university college",
            "Full-time study",
            "Proof of at least NOK 170,368 per year in available funds",
            "Confirmed accommodation in Norway",
        ],
        "documents": [
            "Valid passport",
            "Confirmation of admission to an approved institution",
            "Proof of sufficient funds (bank statements, scholarship letters)",
            "Health insurance documentation",
            "Proof of accommodation in Norway",
        ],
        "steps": [
            "Get admitted to an approved Norwegian institution",
            "Register an application in the UDI application portal and pay the fee",
            "Book and attend an appointment to hand in documents",
            "Wait for the decision (can take up to 12 months)",
        ],
        "source_name": "Norwegian Directorate of Immigration (UDI)",
        "source_url": "https://www.udi.no/en/want-to-apply/studies/",
    },
    {
        "destination": "FI", "purpose": "student",
        "visa_name": "Residence Permit for Studies (Finland)",
        "summary": ("A residence permit for non-EU students accepted to a Finnish educational "
                    "institution. You must show sufficient funds and hold health insurance."),
        "fee": "€600 (online) / €750 (paper)",
        "processing_time": "studies applications are high-priority; varies by case",
        "key_requirements": [
            "Acceptance at a Finnish educational institution",
            "At least €9,600 for one year (or €800 per month) in available funds",
            "Valid health insurance",
        ],
        "documents": [
            "Valid passport",
            "Passport photo",
            "Certificate of acceptance from the educational institution",
            "Proof of financial resources",
            "Certificate of insurance",
        ],
        "steps": [
            "Get accepted to a Finnish educational institution",
            "Fill in the studies application in Enter Finland and pay the fee",
            "Visit a Finnish mission or service point to prove your identity",
            "Wait for the decision",
        ],
        "source_name": "Finnish Immigration Service (Migri)",
        "source_url": "https://migri.fi/en/studying-in-finland",
    },
]


def index_policy(p: dict) -> str:
    route_id = f"ALL-{p['destination']}-{p['purpose']}"
    doc = {
        "route": route_id,
        "nationality": "ALL",
        "destination": p["destination"],
        "purpose": p["purpose"],
        "found": True,
        "ai_structured": False,
        "firecrawl_sourced": True,
        "visa_name": p["visa_name"],
        "summary": p["summary"],
        "fee": p.get("fee"),
        "processing_time": p.get("processing_time"),
        "key_requirements": p.get("key_requirements", []),
        "documents": p.get("documents", []),
        "steps": p.get("steps", []),
        "source_name": p.get("source_name"),
        "source_url": p.get("source_url"),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    es.index(index=STRUCTURED_INDEX, id=route_id, document=doc, refresh="wait_for")
    return route_id


if __name__ == "__main__":
    if not es.indices.exists(index=STRUCTURED_INDEX):
        es.indices.create(index=STRUCTURED_INDEX)
    for p in POLICIES:
        rid = index_policy(p)
        print(f"  indexed {rid}: {p['visa_name']} — {p.get('fee')}")
    print(f"Done: {len(POLICIES)} Firecrawl-curated policies indexed.")
