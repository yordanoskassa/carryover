"""Real visa news for the top ticker, served from the `visa-news` index."""
from fastapi import APIRouter
from app.services.elastic import es

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/recent")
async def recent(size: int = 12):
    try:
        res = es.search(index="visa-news", body={
            "size": min(size, 30),
            "sort": [{"indexed_at": {"order": "desc"}}],
            "query": {"match_all": {}},
        })
        items = [{
            "title": h["_source"].get("title", ""),
            "source": h["_source"].get("source", ""),
            "url": h["_source"].get("url", ""),
            "date_text": h["_source"].get("date_text", ""),
            "tone": h["_source"].get("tone", "neutral"),
        } for h in res.get("hits", {}).get("hits", [])]
    except Exception:
        items = []
    return {"items": items}
