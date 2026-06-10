#!/usr/bin/env python3
"""
Bulk-ingest real public Telegram visa/study-abroad agency channels into the
`agency-posts` index — the data the Inspector's identity-reuse (ES|QL) and the
dashboard rely on. Channels were discovered via Firecrawl search over t.me.

Pulls each channel's recent public posts (t.me/s/<handle>) and indexes them.
Phone numbers are extracted so the ES|QL reuse detector can find numbers shared
across channels.
"""
import sys, os, asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.services import telegram
from app.services.elastic import bulk_index
from datetime import datetime, timezone

# Real public agency / study-abroad / visa channels (Firecrawl-discovered).
# Pass a comma-separated list as argv[1] to ingest a specific batch.
CHANNELS = [
    # batch 1
    "ethiomegastarconsultancy", "travel_work_or_study_channel", "leap_abroad",
    "scholarships365", "scholarshipscorner", "OpportunitiesPedia",
    "scholarshipregion", "opcorners", "scolarships", "joinyouthuz",
    # batch 2 — consultancies (several with contact phone numbers)
    "tridenteduconsultants", "GlobeDockConsultancy", "doveagent",
    "lineaddisconsultancy", "graceconsultancy", "ethioscholarshipopportunity",
    "OHUB4AllET", "WEduAbroad", "layboard_in", "abroadjbs", "truescho",
]


async def ingest(handle: str) -> int:
    try:
        channel = await telegram.fetch_channel(handle, limit=15)
    except Exception as e:
        print(f"  @{handle}: skip ({type(e).__name__}: {str(e)[:60]})")
        return 0
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for post in channel["posts"]:
        docs.append({
            "agency_name": channel["title"],
            "account_handle": channel["handle"],
            "platform": "telegram",
            "post_text": post["text"],
            "phone": post["phones"][0] if post["phones"] else None,
            "timestamp": post["date"] or now,
            "corridor": None,
            "group_name": f"t.me/{channel['handle']}",
        })
    if docs:
        bulk_index("agency-posts", docs)
    print(f"  @{handle} ({channel['title'][:30]}): {len(docs)} posts indexed")
    return len(docs)


async def main():
    handles = sys.argv[1].split(",") if len(sys.argv) > 1 else CHANNELS
    total = 0
    for h in handles:
        total += await ingest(h.strip())
    print(f"\nDone: {total} agency posts indexed across {len(handles)} channels.")


if __name__ == "__main__":
    asyncio.run(main())
