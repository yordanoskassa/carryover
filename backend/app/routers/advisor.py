from fastapi import APIRouter, HTTPException
from app.models.schemas import AdvisorRequest, AdvisorResponse, PolicyResult
from app.services.elastic import es, search_semantic, search_esql
from app.services import agent_builder

router = APIRouter(prefix="/api/advisor", tags=["advisor"])


@router.post("/requirements", response_model=AdvisorResponse)
async def get_requirements(req: AdvisorRequest):
    """Get official visa requirements for a nationality→destination route."""

    # 1. ES|QL exact lookup — filtered by nationality, destination, AND purpose
    esql_query = (
        "FROM visa-policies "
        "| WHERE nationality == ?nationality AND destination == ?destination AND purpose == ?purpose "
        "| KEEP requirement_text, documents_needed, fee_usd, processing_days, "
        "  source_url, source_name, last_updated, purpose "
        "| LIMIT 20"
    )
    try:
        esql_result = es.esql.query(
            query=esql_query,
            params=[
                {"nationality": req.nationality},
                {"destination": req.destination},
                {"purpose": req.purpose},
            ],
        )
    except Exception:
        esql_result = {"values": []}

    # 2. Semantic search — filtered by purpose AND destination
    purpose_labels = {
        "student": "student study university education",
        "work": "work employment skilled worker job",
        "family": "family reunion spouse dependent",
        "tourist": "tourist visitor travel short stay",
    }
    purpose_desc = purpose_labels.get(req.purpose, req.purpose)
    query_text = (
        f"{purpose_desc} visa requirements for {req.nationality} citizen "
        f"traveling to {req.destination}"
    )
    try:
        semantic_result = search_semantic(
            index="visa-policies",
            query=query_text,
            size=5,
            filters={"destination": req.destination, "purpose": req.purpose},
        )
    except Exception:
        semantic_result = {"hits": {"hits": []}}

    # Merge results — deduplicate on requirement_text, not source_url
    requirements = []
    seen = set()

    # From ES|QL
    columns = [c["name"] for c in esql_result.get("columns", [])]
    for row in esql_result.get("values", []):
        record = dict(zip(columns, row))
        key = record.get("requirement_text", "")[:80]
        if key and key not in seen:
            seen.add(key)
            requirements.append(PolicyResult(
                requirement_text=record.get("requirement_text", ""),
                documents_needed=record.get("documents_needed"),
                fee_usd=record.get("fee_usd"),
                processing_days=record.get("processing_days"),
                source_url=record.get("source_url", ""),
                source_name=record.get("source_name", ""),
                last_updated=record.get("last_updated"),
            ))

    # From semantic search
    for hit in semantic_result.get("hits", {}).get("hits", []):
        src = hit["_source"]
        key = src.get("requirement_text", "")[:80]
        if key and key not in seen:
            seen.add(key)
            requirements.append(PolicyResult(
                requirement_text=src.get("requirement_text", ""),
                documents_needed=src.get("documents_needed"),
                fee_usd=src.get("fee_usd"),
                processing_days=src.get("processing_days"),
                source_url=src.get("source_url", ""),
                source_name=src.get("source_name", ""),
                last_updated=src.get("last_updated"),
            ))

    return AdvisorResponse(
        nationality=req.nationality,
        destination=req.destination,
        purpose=req.purpose,
        requirements=requirements,
    )


@router.post("/ask")
async def ask_advisor(req: AdvisorRequest, question: str = ""):
    """Ask the Advisor agent a natural language question via Agent Builder chat."""
    message = (
        f"I am a citizen of {req.nationality} wanting to go to {req.destination} "
        f"for {req.purpose}. {question or 'What are the visa requirements?'}"
    )
    try:
        result = await agent_builder.chat("elastipath-advisor", message)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent Builder error: {str(e)}")
