#!/usr/bin/env python3
"""Ingest Telegram channel handles listed in a file (comma/newline separated),
skipping channels already in agency-posts. Usage: ingest_from_file.py <path>"""
import sys, os, re, asyncio
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.services import telegram
from app.services.elastic import es, bulk_index
from datetime import datetime, timezone


async def ingest(handle):
    try:
        ch = await telegram.fetch_channel(handle, limit=15)
    except Exception:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    docs = [{
        "agency_name": ch["title"], "account_handle": ch["handle"], "platform": "telegram",
        "post_text": p["text"], "phone": p["phones"][0] if p["phones"] else None,
        "timestamp": p["date"] or now, "corridor": None,
        "group_name": f"t.me/{ch['handle']}",
    } for p in ch["posts"]]
    if docs:
        bulk_index("agency-posts", docs)
    print(f"  @{handle} ({ch['title'][:26]}): {len(docs)}")
    return len(docs)


async def main():
    raw = open(sys.argv[1]).read()
    handles = [h.strip() for h in re.split(r"[,\s]+", raw) if h.strip()]
    # dedupe case-insensitively
    seen, uniq = set(), []
    for h in handles:
        if h.lower() not in seen:
            seen.add(h.lower()); uniq.append(h)
    existing = set()
    try:
        agg = es.search(index="agency-posts", body={"size": 0, "aggs": {
            "h": {"terms": {"field": "account_handle", "size": 2000}}}})
        existing = {b["key"].lower() for b in agg["aggregations"]["h"]["buckets"]}
    except Exception:
        pass
    todo = [h for h in uniq if h.lower() not in existing]
    print(f"{len(uniq)} unique candidates, {len(todo)} new (skipping {len(uniq)-len(todo)} already indexed)\n")
    total, ok = 0, 0
    for h in todo:
        n = await ingest(h)
        if n:
            ok += 1; total += n
        await asyncio.sleep(0.25)
    print(f"\nDone: {total} posts from {ok} channels ({len(todo)-ok} private/empty).")


if __name__ == "__main__":
    asyncio.run(main())
