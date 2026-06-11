from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.elastic import es, create_indices, bulk_index
import json
import csv
import io

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


@router.post("/setup")
async def setup_indices():
    """Create all Carryover Elasticsearch indices."""
    results = create_indices()
    return {"indices": results}


@router.post("/policies")
async def ingest_policies(documents: list[dict]):
    """Bulk ingest visa policy documents."""
    if not documents:
        raise HTTPException(status_code=400, detail="No documents provided")
    result = bulk_index("visa-policies", documents)
    return {
        "indexed": len(documents),
        "errors": result.get("errors", False),
    }


@router.post("/scams")
async def ingest_scams(documents: list[dict]):
    """Bulk ingest known scam entries."""
    if not documents:
        raise HTTPException(status_code=400, detail="No documents provided")
    result = bulk_index("known-scams", documents)
    return {
        "indexed": len(documents),
        "errors": result.get("errors", False),
    }


@router.post("/agency-posts")
async def ingest_agency_posts(documents: list[dict]):
    """Bulk ingest agency post data."""
    if not documents:
        raise HTTPException(status_code=400, detail="No documents provided")
    result = bulk_index("agency-posts", documents)
    return {
        "indexed": len(documents),
        "errors": result.get("errors", False),
    }


@router.post("/upload-csv/{index_name}")
async def upload_csv(index_name: str, file: UploadFile = File(...)):
    """
    Upload a CSV file and bulk index its rows.
    Useful for CFPB complaint data or any tabular dataset.
    """
    allowed = {"visa-policies", "known-scams", "agency-posts", "policy-history"}
    if index_name not in allowed:
        raise HTTPException(status_code=400, detail=f"Index must be one of {allowed}")

    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    documents = []
    for row in reader:
        # Clean empty strings to None
        cleaned = {k: (v if v else None) for k, v in row.items()}
        documents.append(cleaned)

    if not documents:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    # Bulk index in batches of 500
    total = 0
    errors = False
    for i in range(0, len(documents), 500):
        batch = documents[i:i + 500]
        result = bulk_index(index_name, batch)
        total += len(batch)
        if result.get("errors"):
            errors = True

    return {
        "indexed": total,
        "errors": errors,
        "file": file.filename,
    }


@router.get("/stats")
async def ingest_stats():
    """Get document counts across all Carryover indices."""
    indices = ["visa-policies", "known-scams", "agency-posts", "policy-history", "user-subscriptions"]
    counts = {}
    for idx in indices:
        try:
            counts[idx] = es.count(index=idx)["count"]
        except Exception:
            counts[idx] = 0
    return counts
