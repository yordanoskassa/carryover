"""
Reporter — the action agent.

Advisor and Inspector produce *information* (what the visa requires, whether an
offer is a scam). Reporter is the one that *acts*: on a confirmed scam it

  1. files a community warning into Elasticsearch (known-scams) so the next
     person who checks this agency/phone is warned, and
  2. drafts a formal complaint to the right authority for the corridor and
     actually sends it through the outbound channel (email today).

It's a one-click, user-confirmed action — Kibo only *proposes* it; nothing is
filed or sent until the user taps the button.
"""

from datetime import datetime, timezone

from fastapi import APIRouter

from app.models.schemas import (
    ReporterFileRequest, ReporterFileResponse,
    ComplaintDraft, DeliveryStatus,
)
from app.services.elastic import es
from app.services import gemini, notify

router = APIRouter(prefix="/api/reporter", tags=["reporter"])


def _category(verdict: str, post: str) -> str:
    p = (post or "").lower()
    if "guarantee" in p or "100%" in p:
        return "guaranteed_visa_scam"
    if "deposit" in p or "western union" in p or "pay" in p:
        return "advance_fee_fraud"
    return "visa_fraud"


def _template_complaint(authority: str, req: ReporterFileRequest) -> str:
    """Plain-text complaint used when Gemini is unavailable."""
    ids = []
    if req.agency_name:
        ids.append(f"name “{req.agency_name}”")
    if req.handle:
        ids.append(f"handle @{req.handle.lstrip('@')}")
    if req.phone:
        ids.append(f"phone {req.phone}")
    id_line = ("It operates under " + ", ".join(ids) + ". ") if ids else ""
    ev = "".join(f"  - {e}\n" for e in req.evidence) or "  - Multiple automated fraud signals.\n"
    return (
        f"To {authority},\n\n"
        f"I am reporting a visa/immigration offer that appears to be fraudulent. "
        f"{id_line}It targets the {req.corridor or 'migration'} corridor.\n\n"
        f"An automated fraud check scored it {req.risk_score}/100 ({req.verdict}). "
        f"The offer read:\n\n  \"{(req.post_text or '').strip()[:600]}\"\n\n"
        f"Evidence supporting this report:\n{ev}\n"
        f"Please investigate this agency and warn other applicants. Thank you."
    )


@router.post("/file", response_model=ReporterFileResponse)
async def file_report(req: ReporterFileRequest):
    """File the community warning and draft + send the formal complaint."""

    # ── 1. Community warning → known-scams (memory write-back) ────────────
    filed = False
    doc_id: str | None = None
    try:
        doc = {
            "post_text": req.post_text,
            "scam_category": _category(req.verdict, req.post_text),
            "agency_name": req.agency_name,
            "phone": req.phone,
            "account_handle": req.handle,
            "platform": "telegram" if req.handle else None,
            "corridor": req.corridor,
            "risk_score": req.risk_score,
            "verdict": req.verdict,
            "confidence": 0.95,
            "source": "reporter_action",
            "date_reported": datetime.now(timezone.utc).isoformat(),
        }
        result = es.index(index="known-scams", document=doc, refresh="wait_for")
        filed = True
        doc_id = result["_id"]
    except Exception:
        filed = False

    # ── 2. Draft the formal complaint (Gemini, else template) ─────────────
    authority = notify.authority_for(req.destination)
    body = await gemini.draft_complaint(
        authority=authority["address"],
        corridor=req.corridor or "",
        risk=req.risk_score,
        verdict=req.verdict,
        agency=req.agency_name or "",
        handle=req.handle or "",
        phone=req.phone or "",
        post=req.post_text,
        evidence=req.evidence,
    ) or _template_complaint(authority["address"], req)

    who = req.agency_name or (f"@{req.handle.lstrip('@')}" if req.handle else "an agency")
    subject = f"Visa fraud report — {who} ({req.corridor or 'migration corridor'})"

    complaint = ComplaintDraft(
        to_authority=authority["name"],
        authority_portal=authority["portal"],
        subject=subject,
        body=body,
    )

    # ── 3. Actually send it through the outbound channel ──────────────────
    delivery_raw = await notify.send_email(
        subject=subject,
        body=body + f"\n\n— Filed via Carryover Reporter. Intended authority: {authority['name']}.",
        reply_to=req.reply_to,
    )
    delivery = DeliveryStatus(
        channel=delivery_raw["channel"],
        delivered=delivery_raw["delivered"],
        detail=delivery_raw["detail"],
        message_id=delivery_raw.get("message_id"),
    )

    # ── Plain-language recap for Kibo to show ─────────────────────────────
    bits = []
    if filed:
        bits.append("filed a community warning to Elastic (future checks will flag it)")
    if delivery.delivered:
        bits.append(f"sent a formal complaint to {authority['name']}")
    else:
        bits.append(f"drafted a complaint to {authority['name']} (ready to send)")
    summary = "Done — I " + " and ".join(bits) + "."

    return ReporterFileResponse(
        filed=filed,
        document_id=doc_id,
        complaint=complaint,
        delivery=delivery,
        summary=summary,
    )
