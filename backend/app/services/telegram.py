"""
Telegram public-channel scanner.

Fetches recent posts from a channel's public preview page (t.me/s/<handle>),
which is server-rendered HTML — no login or API key required. Used by the
Inspector's scan-agency flow: posts are indexed into agency-posts (feeding
the identity-reuse ES|QL tool) and each post is run through the 3-check
fraud evaluation.
"""

import re
import httpx
from bs4 import BeautifulSoup

_PHONE = re.compile(r"\+?\d[\d\s().-]{7,}\d")
_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)


def normalize_handle(raw: str) -> str:
    """Accept '@handle', 'handle', or any t.me URL form."""
    raw = raw.strip()
    m = re.search(r"t\.me/(?:s/)?([A-Za-z0-9_]+)", raw)
    if m:
        return m.group(1)
    return raw.lstrip("@").strip("/")


async def fetch_channel(handle: str, limit: int = 10) -> dict:
    """Fetch recent posts from a public Telegram channel preview page.

    Returns {"handle", "title", "description", "posts": [{text, date, phones}]}.
    Raises httpx.HTTPStatusError on a non-200, ValueError if the channel has
    no public preview (private channels redirect to a join page).
    """
    handle = normalize_handle(handle)
    url = f"https://t.me/s/{handle}"

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": _UA})
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    messages = soup.select(".tgme_widget_message_text")
    if not messages:
        # Private channels / invalid handles render a join-only page
        raise ValueError(
            f"@{handle} has no public posts — the channel may be private or the handle wrong."
        )

    title_el = soup.select_one(".tgme_channel_info_header_title")
    desc_el = soup.select_one(".tgme_channel_info_description")

    posts = []
    for msg in messages[-limit:]:
        text = msg.get_text(separator=" ", strip=True)
        if not text or len(text) < 20:
            continue
        date_el = msg.find_parent(class_="tgme_widget_message_bubble")
        date = None
        if date_el:
            time_tag = date_el.select_one("time[datetime]")
            if time_tag:
                date = time_tag.get("datetime")
        posts.append({
            "text": text[:2000],
            "date": date,
            "phones": [p.strip() for p in _PHONE.findall(text)],
        })

    return {
        "handle": handle,
        "title": title_el.get_text(strip=True) if title_el else handle,
        "description": desc_el.get_text(strip=True) if desc_el else None,
        "posts": posts,
    }
