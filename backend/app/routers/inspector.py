import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.schemas import (
    InspectorRequest, InspectorResponse, EvidenceItem,
    ScamReport, ScamReportResponse,
)
from app.services.elastic import es, search_semantic, bulk_index
from app.services import agent_builder, gemini, telegram
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
    # Each detector contributes an independent "probability of fraud"; we combine
    # them with a probabilistic OR (1 - ∏(1-p)) so the score is graded and spreads
    # across 0-100 instead of jumping in fixed chunks.
    probs: list[float] = []

    # ── 0. Fraud language signals (the primary discriminator) ─────────────
    # Severity-weighted: a guaranteed-approval / cash-upfront claim is a far
    # stronger signal than a vague "special connections" line.
    SIGNAL_WEIGHT = {
        "guaranteed approval": 0.45,
        "no interview / no documents": 0.42,
        "unrealistic speed": 0.35,
        "upfront cash / informal payment": 0.48,
        "special connections": 0.25,
    }
    signals = detect_fraud_signals(req.post_text)
    for label in signals:
        w = SIGNAL_WEIGHT.get(label, 0.30)
        probs.append(w)
        evidence.append(EvidenceItem(
            type="FRAUD_SIGNAL",
            description=f"Post contains a known fraud red flag: {label}.",
            source="claim analysis",
            confidence=round(0.55 + w / 2, 2),
        ))

    # ── 0b. Informal-channel baseline (always on, language-independent) ───
    # Selling visas over Telegram via personal phone numbers is inherently
    # risky even with no explicit false claim — embassies never work this way.
    # This keeps non-English posts from scoring zero when the phrase regexes
    # (English-only) miss.
    text = req.post_text or ""
    has_phone = bool(_re.search(r"\+?\d[\d\s().-]{7,}\d", text))
    sells_visa = bool(_re.search(r"visa|umrah|work permit|iqama|ticket.*visa", text, _re.I))
    if sells_visa and has_phone:
        probs.append(0.22)
        evidence.append(EvidenceItem(
            type="INFORMAL_CHANNEL",
            description=(
                "Markets visas through Telegram with a personal phone number — "
                "official visa routes never sell this way."
            ),
            source="channel analysis",
            confidence=0.7,
        ))

    # ── 0c. Gemini AI rating (every post gets a calibrated score) ─────────
    ai = await gemini.rate_post(text, req.corridor or "")
    if ai:
        probs.append((ai["risk"] / 100) * 0.65)
        evidence.append(EvidenceItem(
            type="AI_ASSESSMENT",
            description=f"Gemini rates this {ai['risk']}/100: {ai['reason']}",
            source="gemini",
            confidence=round(0.5 + ai["risk"] / 250, 2),
        ))

    # ── 1. Semantic match against known scams (ELSER) ─────────────────────
    # On this corpus ELSER similarity sits ~0.68-0.83 for almost any visa text,
    # so it's a weak standalone discriminator: we show the match as evidence but
    # only let it nudge the score relative to a baseline, and halve its weight
    # when the post itself shows no fraud language.
    scam_matches = search_semantic(index="known-scams", query=req.post_text, size=5)
    hits = sorted(
        scam_matches.get("hits", {}).get("hits", []),
        key=lambda h: h.get("_score", 0), reverse=True,
    )
    top_score = hits[0].get("_score", 0) if hits else 0
    BASELINE = 0.72
    matched_scams = sum(1 for h in hits if h.get("_score", 0) >= BASELINE)
    for h in hits[:2]:
        s = h.get("_score", 0)
        if s < BASELINE:
            continue
        src = h["_source"]
        evidence.append(EvidenceItem(
            type="SEMANTIC_MATCH",
            description=(
                f"Resembles a known scam (similarity {s:.2f}): "
                f"'{src.get('post_text', '')[:110]}...'"
            ),
            source=src.get("source", "known-scams index"),
            confidence=round(s, 2),
        ))
    if top_score > BASELINE:
        p_sem = min((top_score - BASELINE) / 0.18, 1.0) * 0.28
        p_sem *= 1.0 if signals else 0.5
        if p_sem > 0.005:
            probs.append(p_sem)

    # ── 2. Policy contradiction check ─────────────────────────────────────
    # Only a claim-making post can "contradict" policy; we surface the official
    # requirement as the counter-evidence the user should trust.
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
                probs.append(0.30)
                evidence.append(EvidenceItem(
                    type="POLICY_CONTRADICTION",
                    description=(
                        f"Official policy contradicts the offer: "
                        f"'{src.get('requirement_text', '')[:150]}...'"
                    ),
                    source=src.get("source_url", ""),
                    confidence=0.75,
                ))

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
                probs.append(min(identity_reuse_count * 0.18, 0.5))
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

    # ── Combine: probabilistic OR → a graded 0-100 score ──────────────────
    survive = 1.0
    for p in probs:
        survive *= (1.0 - max(0.0, min(p, 0.95)))
    risk_score = round((1.0 - survive) * 100)

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
        result = await agent_builder.chat("carryover-inspector", message)
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
