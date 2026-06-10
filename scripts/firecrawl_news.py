#!/usr/bin/env python3
"""
Real visa-news → Elasticsearch.

Headlines fetched via Firecrawl news search are indexed into `visa-news`, which
the top ticker reads. Keeps the ticker grounded in real, recent immigration news
instead of seed snapshots. Re-run after a fresh Firecrawl news search to refresh.
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

NEWS_INDEX = "visa-news"

# Firecrawl news-search results (real headlines + sources).
NEWS = [
    {"title": "Minimum salary changes announced for several work-visa countries",
     "source": "Fragomen", "url": "https://www.fragomen.com/insights/minimum-salary-changes-announced.html",
     "date_text": "1 day ago", "tone": "warning"},
    {"title": "EMEA immigration updates: EU, UK & Middle East changes (May 2026)",
     "source": "Clark Hill", "url": "https://www.clarkhill.com/news-events/news/may-2026-outbound-immigration-and-global-mobility-recap-emea/",
     "date_text": "5 days ago", "tone": "neutral"},
    {"title": "Immigration & visa changes in May 2026: US, UK, Canada, Europe updates",
     "source": "Business Standard", "url": "https://www.business-standard.com/immigration/immigration-visa-changes-in-may-2026-us-uk-canada-europe-updates-126050100331_1.html",
     "date_text": "May 2026", "tone": "neutral"},
    {"title": "Visa & immigration changes in April 2026: US, UK, Canada, EU tighten rules",
     "source": "Business Standard", "url": "https://www.business-standard.com/immigration/visa-immigration-changes-in-april-2026-us-uk-canada-eu-tighten-rules-126040100310_1.html",
     "date_text": "Apr 2026", "tone": "warning"},
    {"title": "How are UK passport rules changing for British dual nationals?",
     "source": "BBC News", "url": "https://www.bbc.com/news/articles/cx2d9yk2kpjo",
     "date_text": "Feb 2026", "tone": "neutral"},
    {"title": "Europe travel rules changing from April 10, 2026: new entry requirements",
     "source": "Y-Axis", "url": "https://www.y-axis.com/news/europe-travel-rules-changing-from-april-10/",
     "date_text": "Apr 2026", "tone": "warning"},
    {"title": "How will the EU's new entry-exit border system work?",
     "source": "Al Jazeera", "url": "https://www.aljazeera.com/news/2025/10/10/how-will-the-eus-new-entry-exit-border-system-work",
     "date_text": "2026", "tone": "neutral"},
    {"title": "14 countries with dependant visas that let you bring your spouse and family",
     "source": "Study International", "url": "https://studyinternational.com/news/dependant-visa-countries-bring-family/",
     "date_text": "Mar 2026", "tone": "good"},
    {"title": "Global immigration news update: Armenia advances major law reform package",
     "source": "Corporate Immigration Partners", "url": "https://corporateimmigrationpartners.com/global-immigration-news-update-march-18-2026/",
     "date_text": "Mar 2026", "tone": "neutral"},
]


def run():
    if not es.indices.exists(index=NEWS_INDEX):
        es.indices.create(index=NEWS_INDEX, mappings={"properties": {
            "title": {"type": "text"}, "source": {"type": "keyword"},
            "url": {"type": "keyword"}, "date_text": {"type": "keyword"},
            "tone": {"type": "keyword"}, "indexed_at": {"type": "date"},
        }})
    now = datetime.now(timezone.utc).isoformat()
    for i, n in enumerate(NEWS):
        es.index(index=NEWS_INDEX, id=str(i), document={**n, "indexed_at": now})
    es.indices.refresh(index=NEWS_INDEX)
    print(f"Indexed {len(NEWS)} real visa-news headlines into {NEWS_INDEX}.")


if __name__ == "__main__":
    run()
