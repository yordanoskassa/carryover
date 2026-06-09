#!/usr/bin/env python3
"""
Ingest CFPB Consumer Complaint Database into the known-scams index.

The CFPB database has 4M+ consumer complaints with narrative text fields.
We filter for immigration/travel/money-transfer related complaints.

Download from: https://www.consumerfinance.gov/data-research/consumer-complaints/
Direct CSV: https://files.consumerfinance.gov/ccdb/complaints.csv.zip

Usage:
    1. Download and unzip complaints.csv into backend/app/data/seed/
    2. python scripts/ingest_cfpb.py
"""

import csv
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.services.elastic import es, bulk_index

# Categories that map to migration/travel fraud
RELEVANT_PRODUCTS = {
    "Money transfer, virtual currency, or money service",
    "Money transfers",
    "Debt collection",
    "Credit reporting, credit repair services, or other personal consumer reports",
}

SCAM_KEYWORDS = [
    "visa", "immigration", "travel", "passport", "agency", "abroad",
    "scam", "fraud", "deposit", "refund", "money transfer", "wire",
    "guaranteed", "embassy", "consulate", "student visa", "work permit",
]


def matches_keywords(text: str) -> bool:
    if not text:
        return False
    text_lower = text.lower()
    return any(kw in text_lower for kw in SCAM_KEYWORDS)


def ingest_cfpb(csv_path: str, max_docs: int = 50000):
    print(f"Reading {csv_path}...")

    documents = []
    skipped = 0
    total_read = 0

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            total_read += 1
            if total_read % 100000 == 0:
                print(f"  Scanned {total_read} rows, found {len(documents)} relevant...")

            narrative = row.get("Consumer complaint narrative", "")
            product = row.get("Product", "")
            issue = row.get("Issue", "")

            # Filter: must have narrative text and be relevant
            if not narrative or narrative == "":
                skipped += 1
                continue

            # Check product category or keyword match
            if product not in RELEVANT_PRODUCTS and not matches_keywords(narrative):
                skipped += 1
                continue

            # Map to our schema
            date_str = row.get("Date received", "")
            try:
                date_reported = datetime.strptime(date_str, "%m/%d/%Y").strftime("%Y-%m-%dT00:00:00Z")
            except (ValueError, TypeError):
                date_reported = None

            doc = {
                "post_text": narrative[:5000],  # Cap at 5k chars for ELSER
                "scam_category": _map_category(product, issue),
                "subcategory": issue,
                "source": "CFPB",
                "date_reported": date_reported,
                "country": "US",
                "confidence": 0.6,  # Lower confidence since these are complaints, not confirmed scams
                "platform": "consumer_complaint",
                "corridor": _guess_corridor(narrative),
            }
            documents.append(doc)

            if len(documents) >= max_docs:
                break

    print(f"\nTotal scanned: {total_read}")
    print(f"Relevant documents: {len(documents)}")
    print(f"Skipped: {skipped}")

    # Bulk index in batches
    if documents:
        print(f"\nIndexing {len(documents)} documents into known-scams...")
        batch_size = 200
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            result = bulk_index("known-scams", batch)
            errors = result.get("errors", False)
            status = "with errors" if errors else "ok"
            print(f"  Batch {i // batch_size + 1}: {len(batch)} docs ({status})")

        print(f"\nDone. Indexed {len(documents)} complaints into known-scams.")
    else:
        print("No relevant documents found.")


def _map_category(product: str, issue: str) -> str:
    issue_lower = issue.lower()
    if "fraud" in issue_lower or "scam" in issue_lower:
        return "confirmed_fraud"
    if "money" in product.lower() or "transfer" in product.lower():
        return "money_transfer_fraud"
    if "debt" in product.lower():
        return "debt_collection_fraud"
    return "general_fraud"


def _guess_corridor(text: str) -> str | None:
    text_lower = text.lower()
    corridors = {
        "ethiopia": "ET",
        "nigeria": "NG",
        "india": "IN",
        "nepal": "NP",
        "philippines": "PH",
        "bangladesh": "BD",
        "uk": "GB",
        "united kingdom": "GB",
        "united states": "US",
        "canada": "CA",
        "australia": "AU",
        "germany": "DE",
    }
    origin = None
    dest = None
    for country, code in corridors.items():
        if country in text_lower:
            if code in ("US", "GB", "CA", "AU", "DE"):
                dest = code
            else:
                origin = code
    if origin and dest:
        return f"{origin}->{dest}"
    return None


if __name__ == "__main__":
    csv_path = os.path.join(
        os.path.dirname(__file__), "..", "backend", "app", "data", "seed", "complaints.csv"
    )
    if not os.path.exists(csv_path):
        print(f"CFPB CSV not found at: {csv_path}")
        print("Download from: https://files.consumerfinance.gov/ccdb/complaints.csv.zip")
        print("Unzip and place complaints.csv in backend/app/data/seed/")
        sys.exit(1)

    ingest_cfpb(csv_path)
