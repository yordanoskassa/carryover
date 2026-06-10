import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.schemas import (
    InspectorRequest, InspectorResponse, EvidenceItem,
    ScamReport, ScamReportResponse,
)
from app.services.elastic import es, search_semantic, bulk_index
from app.services import agent_builder, telegram
from datetime import datetime, timezone

router = APIRouter(prefix="/api/inspector", tags=["inspector"])


# Fraud language signals — the claims legitimate immigration services never make.
# Each tuple is (label, regex). Hits drive the base risk and gate the ES checks
# so benign posts don't get flagged just for being semantically near a scam.
import re as _re

_FRAUD_SIGNALS = [
    ("guaranteed approval", _re.compile(r"guarantee|100%|sure|assured|certain approval", _re.I)),
    ("no interview / no documents", _re.compile(r"no interview|without interview|no document|no passport|no ielts|without ielts", _re.I)),
    ("unrealistic speed", _re.compile(r"\b\d+\s*(day|days|hour|week)s?\b.*\b(visa|permit|approv)|fast.?track|express guarantee|same.?day", _re.I)),
    ("upfront cash / informal payment", _re.compile(r"deposit|pay cash|cash only|western union|m-?pesa|hawala|advance payment|pay first", _re.I)),
    ("special connections", _re.compile(r"special arrangement|inside|connection|we know|back ?door|special deal", _re.I)),
]


def detect_fraud_signals(text: str) -> list[str]:
    return [label for label, pat in _FRAUD_SIGNALS if pat.search(text or "")]


@router.post("/evaluate", response_model=InspectorResponse)
async def evaluate_agency(req: InspectorRequest):
    """
    Evaluate an agency post for scam risk.
    Runs three checks: semantic match, policy contradiction, identity reuse.
    """
    evidence = []
    risk_score = 0

    # ── 0. Fraud language signals ─────────────────────────────────────────
    # The post's own claims anchor the score. A legitimate agency post (or an
    # official channel) trips none of these and stays LOW even if ELSER finds a
    # topically-similar scam in the corpus.
    signals = detect_fraud_signals(req.post_text)
    for label in signals:
        evidence.append(EvidenceItem(
            type="FRAUD_SIGNAL",
            description=f"Post contains a known fraud red flag: {label}.",
            source="claim analysis",
            confidence=0.9,
        ))
    risk_score += min(len(signals) * 20, 55)

    # ── 1. Semantic match against known scams ─────────────────────────────
    # ELSER returns a score for almost everything, so a relative-to-top
    # threshold gates what counts as a real match.
    scam_matches = search_semantic(
        index="known-scams",
        query=req.post_text,
        size=5,
    )
    hits = scam_matches.get("hits", {}).get("hits", [])
    max_score = max((h.get("_score", 0) for h in hits), default=0)
    threshold = max(max_score * 0.85, 8.0)  # ELSER text_expansion scale
    matched_scams = 0
    for hit in hits:
        score = hit.get("_score", 0)
        if score < threshold:
            continue
        src = hit["_source"]
        matched_scams += 1
        evidence.append(EvidenceItem(
            type="SEMANTIC_MATCH",
            description=(
                f"Closely matches a known scam (score {score:.1f}): "
                f"'{src.get('post_text', '')[:120]}...'"
            ),
            source=src.get("source", "known-scams index"),
            confidence=min(score / max(max_score, 1.0), 1.0) if max_score else 0,
        ))
    # A semantic match only adds risk when the post itself looks suspicious —
    # this stops benign posts from being scored up by corpus similarity alone.
    if matched_scams >= 1 and signals:
        risk_score += 25 if matched_scams >= 3 else 15

    # ── 2. Policy contradiction check ─────────────────────────────────────
    # Only a fraud-signal post can "contradict" policy; we then surface the
    # official requirement as the counter-evidence the user should trust.
    contradictions = 0
    if req.corridor and signals:
        parts = req.corridor.split("->")
        if len(parts) == 2:
            dest = parts[1].strip()
            policy_results = search_semantic(
                index="visa-policies",
                query=req.post_text,
                size=1,
                filters={"destination": dest},
            )
            for hit in policy_results.get("hits", {}).get("hits", []):
                src = hit["_source"]
                contradictions += 1
                evidence.append(EvidenceItem(
                    type="POLICY_CONTRADICTION",
                    description=(
                        f"Official policy contradicts the offer: "
                        f"'{src.get('requirement_text', '')[:150]}...'"
                    ),
                    source=src.get("source_url", ""),
                    confidence=0.8,
                ))
                risk_score += 20

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


class ScanAgencyRequest(BaseModel):
    handle: str  # @handle, bare handle, or any t.me URL
    corridor: str | None = None  # e.g. "ET->GB"


@router.post("/scan-agency")
async def scan_agency(req: ScanAgencyRequest):
    """
    Multi-step agency scan from just a Telegram handle:
    1. Fetch the channel's recent public posts (live web service).
    2. Index every post into agency-posts — feeds the identity-reuse ES|QL tool.
    3. Run the 3-check fraud evaluation on each post in parallel.
    4. Return an aggregate verdict with per-post evidence.
    """
    try:
        channel = await telegram.fetch_channel(req.handle, limit=8)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach Telegram right now.")

    if not channel["posts"]:
        raise HTTPException(status_code=404, detail="No readable posts found on this channel.")

    # Index posts so identity-reuse detection works across agencies
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
            "corridor": req.corridor,
            "group_name": f"t.me/{channel['handle']}",
        })
    bulk_index("agency-posts", docs)
    indexed = len(docs)

    # Evaluate every post concurrently with the same 3-check pipeline
    evaluations = await asyncio.gather(*[
        evaluate_agency(InspectorRequest(
            post_text=post["text"],
            agency_name=channel["title"],
            corridor=req.corridor,
        ))
        for post in channel["posts"]
    ], return_exceptions=True)

    post_results = []
    risks = []
    all_phones: set[str] = set()
    for post, ev in zip(channel["posts"], evaluations):
        all_phones.update(post["phones"])
        if isinstance(ev, Exception):
            continue
        risks.append(ev.risk_score)
        post_results.append({
            "text": post["text"][:280],
            "date": post["date"],
            "risk_score": ev.risk_score,
            "verdict": ev.verdict,
            "evidence": [
                {"type": e.type, "description": e.description[:200], "confidence": e.confidence}
                for e in ev.evidence_chain[:2]
            ],
        })

    aggregate = max(risks) if risks else 0
    if aggregate >= 80:
        verdict = "CRITICAL"
    elif aggregate >= 60:
        verdict = "HIGH"
    elif aggregate >= 30:
        verdict = "MEDIUM"
    else:
        verdict = "LOW"

    return {
        "agency": {
            "handle": channel["handle"],
            "title": channel["title"],
            "description": channel["description"],
        },
        "posts_scanned": len(post_results),
        "posts_indexed": indexed,
        "aggregate_risk": aggregate,
        "verdict": verdict,
        "phones_found": sorted(all_phones),
        "posts": sorted(post_results, key=lambda p: p["risk_score"], reverse=True),
    }


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
