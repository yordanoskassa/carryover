#!/usr/bin/env python3
"""
Autonomous discover→ingest loop for travel/visa/study-abroad Telegram channels.

For each search query: run `firecrawl search ... --json`, extract public t.me
handles, then pull each channel's recent posts and bulk-index into `agency-posts`.
Skips handles already ingested and private channels (no t.me/s preview).

Run:  python scripts/scrape_channels_loop.py
Bounded by MAX_CHANNELS so it always terminates.
"""
import sys, os, re, json, asyncio, subprocess, time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.services import telegram
from app.services.elastic import es, bulk_index
from datetime import datetime, timezone

MAX_CHANNELS = 250
POSTS_PER_CHANNEL = 15

QUERIES = [
    "visa agency site:t.me", "study abroad consultancy site:t.me",
    "work permit abroad agent site:t.me", "scholarship without IELTS site:t.me",
    "DV lottery green card site:t.me", "Canada immigration consultant site:t.me",
    "UK student visa agent site:t.me", "Dubai work visa agency site:t.me",
    "Ethiopia study abroad consultancy site:t.me", "Nigeria visa agent site:t.me",
    "Ghana study abroad site:t.me", "Kenya work abroad site:t.me",
    "India study visa consultant site:t.me", "Pakistan study abroad consultant site:t.me",
    "Poland study work visa agent site:t.me", "Germany work visa agency site:t.me",
    "Australia immigration agent site:t.me", "Gulf jobs work visa site:t.me",
    "Qatar Saudi work visa agency site:t.me", "Europe work permit agency site:t.me",
    "travel agency visa processing site:t.me", "abroad jobs recruitment agency site:t.me",
    "international student recruitment agent site:t.me", "migration consultant site:t.me",
    "work abroad agency site:t.me", "fully funded scholarship agent site:t.me",
    "ቪዛ ኤጀንሲ ትምህርት ውጭ site:t.me", "ስኮላርሺፕ ኤጀንሲ site:t.me",
    "وكالة تأشيرة سفر site:t.me", "دراسة في الخارج وكالة site:t.me",
    "study in europe no ielts agent site:t.me", "caregiver work visa abroad site:t.me",
]

_HANDLE = re.compile(r"t\.me/(?:s/)?([A-Za-z0-9_]{4,})", re.I)
_RESERVED = {"share", "joinchat", "addstickers", "proxy", "socks", "iv", "bot"}


def discover_handles() -> list[str]:
    found, seen = [], set()
    for q in QUERIES:
        try:
            out = subprocess.run(
                ["firecrawl", "search", q, "--limit", "20", "--json"],
                capture_output=True, text=True, timeout=90,
            ).stdout
            data = json.loads(out)
            results = data.get("data", {}).get("web", []) or []
        except Exception as e:
            print(f"  search '{q[:40]}' failed: {str(e)[:60]}")
            continue
        n_q = 0
        for r in results:
            m = _HANDLE.search(r.get("url", ""))
            if not m:
                continue
            h = m.group(1)
            if h.lower() in _RESERVED or h.lower() == "s" or h in seen:
                continue
            seen.add(h)
            found.append(h)
            n_q += 1
        print(f"  '{q[:45]}' → {n_q} new handles (total {len(found)})")
    return found


async def ingest(handle: str) -> int:
    try:
        channel = await telegram.fetch_channel(handle, limit=POSTS_PER_CHANNEL)
    except Exception:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    docs = [{
        "agency_name": channel["title"],
        "account_handle": channel["handle"],
        "platform": "telegram",
        "post_text": p["text"],
        "phone": p["phones"][0] if p["phones"] else None,
        "timestamp": p["date"] or now,
        "corridor": None,
        "group_name": f"t.me/{channel['handle']}",
    } for p in channel["posts"]]
    if docs:
        bulk_index("agency-posts", docs)
    print(f"  @{handle} ({channel['title'][:28]}): {len(docs)} posts")
    return len(docs)


async def main():
    # Skip channels already ingested.
    existing = set()
    try:
        agg = es.search(index="agency-posts", body={"size": 0, "aggs": {
            "h": {"terms": {"field": "account_handle", "size": 1000}}}})
        existing = {b["key"] for b in agg["aggregations"]["h"]["buckets"]}
    except Exception:
        pass
    print(f"Already ingested: {len(existing)} channels\nDiscovering handles...")

    handles = [h for h in discover_handles() if h not in existing][:MAX_CHANNELS]
    print(f"\n{len(handles)} new candidate channels. Ingesting...\n")

    total, ok_channels = 0, 0
    for h in handles:
        n = await ingest(h)
        if n:
            ok_channels += 1
            total += n
        await asyncio.sleep(0.3)
    print(f"\nDone: {total} posts from {ok_channels} channels "
          f"(+{len(handles) - ok_channels} private/empty skipped).")


if __name__ == "__main__":
    asyncio.run(main())
