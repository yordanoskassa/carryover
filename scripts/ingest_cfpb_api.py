#!/usr/bin/env python3
"""
Load real consumer-fraud narratives from the public CFPB Consumer Complaint
Database (free JSON API) into the `known-scams` index — the corpus the Inspector
matches agency posts against with ELSER.

We target advance-fee / wire-transfer / money-service / job & immigration scam
narratives, which share the language of visa-agency fraud (deposits, guarantees,
wire transfers, fake offers).
"""
import os, sys, time, html, re

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
import httpx
from elasticsearch import Elasticsearch

es = Elasticsearch(
    os.environ["ELASTICSEARCH_URL"] + ":443",
    api_key=os.environ["ELASTICSEARCH_API_KEY"],
    request_timeout=180, retry_on_timeout=True, max_retries=3,
)

API = "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/"

SEARCH_TERMS = [
    "money transfer scam", "wire transfer fraud", "advance fee scam",
    "gift card scam", "western union scam", "fake job offer scam",
    "immigration scam", "visa application fraud", "embassy scam",
    "guaranteed approval scam", "upfront fee fraud", "deposit refund scam",
    "money order scam", "romance scam wire", "overpayment scam",
    "fraudulent money transfer", "scammer asked to send money",
]

MAX_PER_TERM = 250          # paginate up to this many per term
TARGET_TOTAL = 2500         # overall cap (keeps ELSER embed time reasonable)
PAGE = 100


def category_for(src: dict) -> str:
    blob = f"{src.get('product','')} {src.get('sub_product','')} {src.get('issue','')}".lower()
    if "money transfer" in blob or "virtual currency" in blob:
        return "money_transfer_fraud"
    if "debt" in blob:
        return "debt_collection_scam"
    if "credit" in blob:
        return "credit_fraud"
    return "consumer_fraud"


def clean(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"X{2,}", "", text)          # CFPB redaction markers
    return re.sub(r"\s+", " ", text).strip()


def fetch():
    seen, docs = set(), []
    with httpx.Client(timeout=45) as client:
        for term in SEARCH_TERMS:
            if len(docs) >= TARGET_TOTAL:
                break
            got = 0
            for frm in range(0, MAX_PER_TERM, PAGE):
                params = {
                    "search_term": term, "field": "complaint_what_happened",
                    "has_narrative": "true", "size": PAGE, "frm": frm,
                    "no_aggs": "true", "sort": "relevance_desc",
                }
                try:
                    hits = client.get(API, params=params).json()["hits"]["hits"]
                except Exception as e:
                    print(f"  '{term}' frm={frm} failed: {str(e)[:60]}"); break
                if not hits:
                    break
                for h in hits:
                    s = h["_source"]
                    cid = s.get("complaint_id")
                    narr = clean(s.get("complaint_what_happened"))
                    if not cid or cid in seen or len(narr) < 120:
                        continue
                    seen.add(cid)
                    docs.append({
                        "post_text": narr[:2000],
                        "scam_category": category_for(s),
                        "agency_name": None,
                        "phone": None, "account_handle": None,
                        "platform": "cfpb_complaint",
                        "corridor": None,
                        "confidence": 0.85,
                        "source": f"CFPB complaint #{cid}",
                        "date_reported": s.get("date_received"),
                    })
                    got += 1
                    if len(docs) >= TARGET_TOTAL:
                        break
                if len(docs) >= TARGET_TOTAL:
                    break
            print(f"  '{term}': +{got} (total {len(docs)})")
    return docs


def index(docs):
    batch = 40
    ok = 0
    for i in range(0, len(docs), batch):
        ops = []
        for d in docs[i:i+batch]:
            ops.append({"index": {"_index": "known-scams"}})
            ops.append(d)
        for attempt in (1, 2):
            try:
                es.bulk(operations=ops)
                ok += len(docs[i:i+batch])
                break
            except Exception as e:
                if attempt == 2:
                    print(f"  batch {i//batch+1} skipped ({type(e).__name__})")
                else:
                    time.sleep(2)
        if (i // batch) % 5 == 0:
            print(f"  indexed {ok}/{len(docs)}")
    return ok


if __name__ == "__main__":
    print("Fetching CFPB fraud narratives...")
    docs = fetch()
    print(f"\nFetched {len(docs)} unique fraud narratives. Indexing into known-scams...")
    n = index(docs)
    print(f"\nDone: {n} real fraud complaints indexed (ELSER embedding continues async).")
