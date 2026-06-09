from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    InspectorRequest, InspectorResponse, EvidenceItem,
    ScamReport, ScamReportResponse,
)
from app.services.elastic import es, search_semantic, bulk_index
from app.services import agent_builder
from datetime import datetime, timezone

router = APIRouter(prefix="/api/inspector", tags=["inspector"])


@router.post("/evaluate", response_model=InspectorResponse)
async def evaluate_agency(req: InspectorRequest):
    """
    Evaluate an agency post for scam risk.
    Runs three checks: semantic match, policy contradiction, identity reuse.
    """
    evidence = []
    risk_score = 0

    # ── 1. Semantic match against known scams ─────────────────────────────
    scam_matches = search_semantic(
        index="known-scams",
        query=req.post_text,
        size=5,
    )
    matched_scams = 0
    for hit in scam_matches.get("hits", {}).get("hits", []):
        score = hit.get("_score", 0)
        src = hit["_source"]
        if score > 0.5:
            matched_scams += 1
            confidence = min(score / 10, 1.0)  # normalize
            evidence.append(EvidenceItem(
                type="SEMANTIC_MATCH",
                description=(
                    f"Post text is {confidence:.0%} similar to known scam: "
                    f"'{src.get('post_text', '')[:120]}...'"
                ),
                source=src.get("source", "known-scams index"),
                confidence=confidence,
            ))
            if confidence > 0.7:
                risk_score += 40
            elif confidence > 0.5:
                risk_score += 20

    # ── 2. Policy contradiction check ─────────────────────────────────────
    if req.corridor:
        parts = req.corridor.split("->")
        if len(parts) == 2:
            nat, dest = parts[0].strip(), parts[1].strip()
            policy_results = search_semantic(
                index="visa-policies",
                query=req.post_text,
                size=3,
                filters={"destination": dest},
            )
            contradictions = 0
            for hit in policy_results.get("hits", {}).get("hits", []):
                src = hit["_source"]
                # Flag as contradiction — the LLM comparison happens client-side
                # or via Agent Builder chat. Here we surface the policy for comparison.
                contradictions += 1
                evidence.append(EvidenceItem(
                    type="POLICY_CONTRADICTION",
                    description=(
                        f"Agency claim may contradict official policy: "
                        f"'{src.get('requirement_text', '')[:150]}...'"
                    ),
                    source=src.get("source_url", ""),
                    confidence=0.8,
                ))
                risk_score += 20
    else:
        contradictions = 0

    # ── 3. Identity reuse check ───────────────────────────────────────────
    identity_reuse_count = 0
    if req.agency_name:
        try:
            reuse_query = (
                "FROM agency-posts "
                "| WHERE agency_name != ?agency "
                "| STATS shared = COUNT_DISTINCT(agency_name) BY phone, account_handle "
                "| WHERE shared > 1 "
                "| LIMIT 5"
            )
            reuse_result = es.esql.query(
                query=reuse_query,
                params=[{"agency": req.agency_name}],
            )
            identity_reuse_count = len(reuse_result.get("values", []))
            if identity_reuse_count > 0:
                risk_score += 15
                evidence.append(EvidenceItem(
                    type="IDENTITY_REUSE",
                    description=(
                        f"Found {identity_reuse_count} phone/handle(s) shared "
                        f"with other agencies."
                    ),
                    confidence=0.9,
                ))
        except Exception:
            pass

    # ── Score and verdict ─────────────────────────────────────────────────
    risk_score = min(risk_score, 100)

    if risk_score >= 80:
        verdict = "CRITICAL"
    elif risk_score >= 60:
        verdict = "HIGH"
    elif risk_score >= 30:
        verdict = "MEDIUM"
    else:
        verdict = "LOW"

    return InspectorResponse(
        risk_score=risk_score,
        verdict=verdict,
        evidence_chain=evidence,
        matched_scams=matched_scams,
        contradictions=contradictions,
        identity_reuse_count=identity_reuse_count,
        agency_name=req.agency_name,
    )


@router.post("/evaluate-agent")
async def evaluate_via_agent(req: InspectorRequest):
    """Evaluate using the full Agent Builder Inspector agent (richer reasoning)."""
    message = f"Evaluate this agency post for scam risk:\n\n{req.post_text}"
    if req.agency_name:
        message += f"\n\nAgency name: {req.agency_name}"
    if req.corridor:
        message += f"\nCorridor: {req.corridor}"
    try:
        result = await agent_builder.chat("elastipath-inspector", message)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Agent Builder error: {str(e)}")


@router.post("/report", response_model=ScamReportResponse)
async def report_scam(report: ScamReport):
    """
    Memory write-back: user confirms a scam → index it into known-scams.
    Next Inspector run will match against this new entry.
    """
    doc = {
        "post_text": report.post_text,
        "scam_category": report.scam_category,
        "agency_name": report.agency_name,
        "phone": report.phone,
        "account_handle": report.account_handle,
        "platform": report.platform,
        "corridor": report.corridor,
        "confidence": 0.95,
        "source": "user_report",
        "date_reported": datetime.now(timezone.utc).isoformat(),
    }
    result = es.index(index="known-scams", document=doc, refresh="wait_for")
    return ScamReportResponse(
        indexed=True,
        document_id=result["_id"],
        message="Scam reported. Future scans will match against this entry.",
    )
