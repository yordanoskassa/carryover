"""
Unified view of everything indexed in Elasticsearch — the one place that shows
the whole corpus together for demos: every index, its doc count, what feeds it,
and whether it's ELSER (semantic) backed.
"""
from fastapi import APIRouter
from app.services.elastic import es

router = APIRouter(prefix="/api/elastic", tags=["elastic"])

# Index → (label, what it holds, source, ELSER-backed?)
INDEX_META = [
    ("crawled-visa-pages", "Crawled government pages",
     "Raw immigration/embassy pages ingested by the Elastic Open Crawler.",
     "Elastic Open Crawler", False),
    ("visa-policies", "Visa policy corpus",
     "Processed, ELSER-embedded policy text the Advisor agent searches semantically.",
     "Open Crawler → processed + seed data", True),
    ("structured-policies", "Structured policies",
     "Clean per-route policies (visa name, fee, funds, steps) the UI renders.",
     "Gemini structuring + Firecrawl + Google-Search grounding", False),
    ("known-scams", "Known scam patterns",
     "Labelled fraud posts the Inspector agent matches against with ELSER.",
     "Seed + user scam reports (write-back)", True),
    ("agency-posts", "Scanned agency posts",
     "Agency posts pulled live and indexed; powers ES|QL identity-reuse detection.",
     "Kibo agency scans (write-back)", False),
    ("policy-history", "Policy change history",
     "Snapshots of policy changes for the Watchtower trend detection.",
     "Snapshots", False),
]


@router.get("/overview")
async def overview():
    """Doc counts + metadata for every index, plus a source breakdown."""
    indices = []
    total = 0
    for name, label, desc, source, semantic in INDEX_META:
        try:
            count = es.count(index=name).get("count", 0)
        except Exception:
            count = 0
        total += count
        indices.append({
            "index": name, "label": label, "description": desc,
            "source": source, "semantic": semantic, "doc_count": count,
        })

    # How the structured policies were produced (curated vs grounded vs gemini).
    breakdown = {"firecrawl": 0, "grounded": 0, "gemini": 0}
    try:
        res = es.search(index="structured-policies", body={
            "size": 0,
            "aggs": {
                "firecrawl": {"filter": {"term": {"firecrawl_sourced": True}}},
                "grounded": {"filter": {"term": {"grounded": True}}},
            },
        })
        aggs = res.get("aggregations", {})
        breakdown["firecrawl"] = aggs.get("firecrawl", {}).get("doc_count", 0)
        breakdown["grounded"] = aggs.get("grounded", {}).get("doc_count", 0)
        struct_total = next((i["doc_count"] for i in indices if i["index"] == "structured-policies"), 0)
        breakdown["gemini"] = max(struct_total - breakdown["firecrawl"] - breakdown["grounded"], 0)
    except Exception:
        pass

    return {"total_docs": total, "indices": indices, "structured_breakdown": breakdown}


@router.get("/sample/{index}")
async def sample(index: str, size: int = 3):
    """A few raw documents from one index — for the 'click to inspect' demo view."""
    allowed = {m[0] for m in INDEX_META}
    if index not in allowed:
        return {"index": index, "docs": []}
    try:
        res = es.search(index=index, body={"size": min(size, 10), "query": {"match_all": {}}})
        docs = [h["_source"] for h in res.get("hits", {}).get("hits", [])]
    except Exception:
        docs = []
    return {"index": index, "docs": docs}
