"""
Kibo — the orchestrator agent.

One front door, visible delegation: every chat turn returns a typed event
stream the UI renders as a multi-agent conversation —

  handoff     → which specialists Kibo routed to, and why
  agent_card  → each specialist's structured findings + the Elastic tools it used
  kibo        → Gemini's synthesis of the findings into a plain-language answer

Routing and synthesis use Gemini when GEMINI_API_KEY is set; otherwise a
keyword heuristic routes and a template synthesizes, so the endpoint always
answers from live Elastic data.
"""

import asyncio
import re

from fastapi import APIRouter, HTTPException

from app.models.schemas import AdvisorRequest, InspectorRequest, KiboChatRequest
from app.routers.advisor import structured_requirements
from app.routers.inspector import evaluate_agency, scan_agency, ScanAgencyRequest
from app.services import gemini

router = APIRouter(prefix="/api/kibo", tags=["kibo"])

# A Telegram handle or t.me link in the message means "investigate this agency".
_HANDLE = re.compile(r"(?:@|t\.me/(?:s/)?)([A-Za-z0-9_]{4,})", re.IGNORECASE)

INSPECTOR_TOOLS = ["inspector.scam_pattern_match", "inspector.identity_reuse", "ES|QL"]
ADVISOR_TOOLS = ["advisor.policy_lookup", "advisor.visa_policy_search", "ELSER"]
REPORTER_TOOLS = ["reporter.community_writeback", "reporter.file_complaint", "Resend"]

# Verdicts that warrant proposing the one-click report-and-complaint action.
_ACTIONABLE = {"HIGH", "CRITICAL"}


def _reporter_event(
    *, req: KiboChatRequest, post_text: str, verdict: str, risk_score: int,
    evidence: list[str], agency_name=None, handle=None, phone=None,
) -> dict:
    """A one-click action card: Kibo proposes filing a warning + complaint.

    Nothing is sent until the user taps it — the payload is posted as-is to
    /api/reporter/file.
    """
    who = agency_name or (f"@{handle}" if handle else "this offer")
    return {
        "kind": "action_prompt",
        "agent": "reporter",
        "tools": REPORTER_TOOLS,
        "label": "Report this agency",
        "description": (
            f"This scored {risk_score}/100 ({verdict}). I can file a community "
            f"warning to Elastic and send a formal complaint about {who} to the "
            f"right authority — one tap, you stay in control."
        ),
        "payload": {
            "post_text": post_text,
            "agency_name": agency_name,
            "handle": handle,
            "phone": phone,
            "nationality": req.nationality,
            "destination": req.destination,
            "corridor": f"{req.nationality}->{req.destination}",
            "risk_score": risk_score,
            "verdict": verdict,
            "evidence": evidence[:5],
        },
    }

_SCAM_HINTS = re.compile(
    r"scam|legit|fraud|fake|guarantee|promise|agent|agency|tiktok|telegram|"
    r"whatsapp|facebook|offer|deal|fast.?track|no.?interview|100%|\$\d|usd|birr",
    re.IGNORECASE,
)
_ADVICE_HINTS = re.compile(
    r"requirement|document|fee|cost|how (do|can|long)|process|apply|visa|"
    r"eligib|sponsor|need|qualif|official",
    re.IGNORECASE,
)
_PHONE = re.compile(r"\+?\d[\d\s().-]{7,}\d")


def _heuristic_route(req: KiboChatRequest) -> dict:
    """Keyword fallback router used when Gemini is unavailable."""
    q = req.question
    suspicious = bool(_SCAM_HINTS.search(q)) or bool(_PHONE.search(q))
    advisory = bool(_ADVICE_HINTS.search(q))

    if suspicious:
        agents = ["inspector", "advisor"]
        reason = "The question describes an agency offer, so Inspector checks it for fraud while Advisor pulls the official policy to compare against."
    elif advisory:
        agents = ["advisor"]
        reason = "The question asks about official requirements, so Advisor handles it."
    else:
        agents = ["advisor"]
        reason = "Defaulting to Advisor for general visa guidance."

    phone = _PHONE.search(q)
    return {
        "agents": agents,
        "reason": reason,
        "post_text": q if suspicious else None,
        "agency_name": None,
        "identifier": phone.group(0).strip() if phone else None,
    }


def _trim_advisor(result: dict) -> dict:
    """Clean structured policy for the Advisor card (visa name, fee, requirements)."""
    return {
        "visa_name": result.get("visa_name"),
        "summary": (result.get("summary") or "")[:240],
        "fee": result.get("fee"),
        "processing_time": result.get("processing_time"),
        "requirements": (result.get("key_requirements") or [])[:4],
        "source_name": result.get("source_name"),
        "source_url": result.get("source_url"),
    }


def _trim_inspector(result) -> dict:
    return {
        "risk_score": result.risk_score,
        "verdict": result.verdict,
        "matched_scams": result.matched_scams,
        "contradictions": result.contradictions,
        "identity_reuse_count": result.identity_reuse_count,
        "evidence_chain": [
            {
                "type": e.type,
                "description": e.description[:220],
                "source": e.source,
                "confidence": round(e.confidence, 2),
            }
            for e in result.evidence_chain[:4]
        ],
    }


def _fallback_synthesis(question: str, findings: dict) -> str:
    parts = []
    insp = findings.get("inspector")
    adv = findings.get("advisor")
    if insp:
        verdict = insp["verdict"]
        if verdict in ("HIGH", "CRITICAL"):
            parts.append(
                f"This looks very risky — risk score {insp['risk_score']}/100 ({verdict}). "
                f"It matches {insp['matched_scams']} known scam pattern(s)."
            )
        elif verdict == "MEDIUM":
            parts.append(
                f"Be careful — risk score {insp['risk_score']}/100. "
                f"Some claims don't line up with official policy."
            )
        else:
            parts.append(
                f"No strong fraud signals found (risk score {insp['risk_score']}/100), "
                f"but always verify an agency independently."
            )
    if adv and adv["requirements"]:
        top = adv["requirements"][0]
        fact = top["requirement_text"][:180]
        cite = top["source_name"] or top["source_url"]
        parts.append(f"For the official route: {fact} (source: {cite}).")
    if not parts:
        parts.append(
            "I couldn't find data for that yet — try asking about a specific "
            "destination, or paste an agency post for a fraud check."
        )
    return " ".join(parts)


def _fallback_scan_narration(handle: str, scan: dict) -> str:
    n = scan["posts_scanned"]
    phones = scan["phones_found"]
    title = scan["agency"]["title"]
    bits = [
        f"I pulled @{handle} ({title}) — {n} public posts, now indexed to Elasticsearch."
    ]
    if phones:
        bits.append(
            f"It reuses {len(phones)} phone number(s) across its posts"
            + (f" ({', '.join(phones[:2])})" if phones else "")
            + " — Elastic now tracks those for reuse across other agencies."
        )
    if scan["verdict"] in ("HIGH", "CRITICAL"):
        bits.append(f"Risk reads {scan['aggregate_risk']}/100 — see the flagged posts in the panel.")
    else:
        bits.append("Nothing screams scam, but the full post-by-post breakdown is in the panel.")
    return " ".join(bits)


async def _scan_flow(req: KiboChatRequest, handle: str) -> dict:
    """Kibo delegates an agency-handle investigation: scan → index → narrate.

    The rich result rides in a `scan_result` event the UI renders in the
    dashboard panel; the chat side only gets the handoff + a short analysis.
    """
    events: list[dict] = [{
        "kind": "handoff",
        "agents": ["inspector", "advisor"],
        "reason": (
            f"You gave an agency handle, so Inspector is pulling @{handle}'s public "
            f"Telegram posts and indexing them to Elastic, while Advisor lines them up "
            f"against official {req.destination} policy."
        ),
        "router": "gemini" if gemini.available() else "heuristic",
    }]

    try:
        scan = await scan_agency(ScanAgencyRequest(
            handle=handle,
            corridor=f"{req.nationality}->{req.destination}",
        ))
    except HTTPException as e:
        events.append({
            "kind": "kibo",
            "content": f"I couldn't scan @{handle} — {e.detail}",
            "engine": "elastic-fallback",
        })
        return {"events": events}

    # Heavy payload → dashboard panel, not the chat
    events.append({"kind": "scan_result", "data": scan})

    narration = await gemini.narrate_scan(req.question, handle, scan)
    events.append({
        "kind": "kibo",
        "content": narration or _fallback_scan_narration(handle, scan),
        "engine": "gemini" if narration else "elastic-fallback",
    })

    # Confirmed scam → propose the one-click report + complaint action,
    # pre-filled from the riskiest post and the channel's identifiers.
    if scan["verdict"] in _ACTIONABLE:
        top = (scan.get("posts") or [{}])[0]
        events.append(_reporter_event(
            req=req,
            post_text=top.get("text") or req.question,
            verdict=scan["verdict"],
            risk_score=scan["aggregate_risk"],
            evidence=[e["description"] for e in top.get("evidence", [])],
            agency_name=scan["agency"]["title"],
            handle=scan["agency"]["handle"],
            phone=(scan.get("phones_found") or [None])[0],
        ))
    return {"events": events}


@router.post("/chat")
async def kibo_chat(req: KiboChatRequest):
    """Orchestrated chat turn: route → run specialists in parallel → synthesize."""

    # If the user named an agency handle, delegate to the live-scan investigation.
    handle_match = _HANDLE.search(req.question)
    if handle_match:
        return await _scan_flow(req, handle_match.group(1))

    plan = await gemini.route(req.question, req.nationality, req.destination, req.purpose)
    engine = "gemini" if plan else "heuristic"
    if not plan:
        plan = _heuristic_route(req)
    agents = [a for a in plan.get("agents", []) if a in ("inspector", "advisor")] or ["advisor"]

    events: list[dict] = [{
        "kind": "handoff",
        "agents": agents,
        "reason": plan.get("reason", ""),
        "router": engine,
    }]

    tasks = {}
    if "inspector" in agents:
        tasks["inspector"] = evaluate_agency(InspectorRequest(
            post_text=plan.get("post_text") or req.question,
            agency_name=plan.get("agency_name"),
            corridor=f"{req.nationality}->{req.destination}",
        ))
    if "advisor" in agents:
        tasks["advisor"] = structured_requirements(AdvisorRequest(
            nationality=req.nationality,
            destination=req.destination,
            purpose=req.purpose,
        ))

    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    findings: dict = {}
    for agent, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            events.append({
                "kind": "agent_card",
                "agent": agent,
                "tools": INSPECTOR_TOOLS if agent == "inspector" else ADVISOR_TOOLS,
                "error": "This agent couldn't reach its data right now.",
                "data": None,
            })
            continue
        data = _trim_inspector(result) if agent == "inspector" else _trim_advisor(result)
        findings[agent] = data
        events.append({
            "kind": "agent_card",
            "agent": agent,
            "tools": INSPECTOR_TOOLS if agent == "inspector" else ADVISOR_TOOLS,
            "error": None,
            "data": data,
        })

    synthesis = await gemini.synthesize(
        req.question, req.nationality, req.destination, req.purpose, findings,
    )
    events.append({
        "kind": "kibo",
        "content": synthesis or _fallback_synthesis(req.question, findings),
        "engine": "gemini" if synthesis else "elastic-fallback",
    })

    # Confirmed scam → propose the one-click report + complaint action.
    insp = findings.get("inspector")
    if insp and insp["verdict"] in _ACTIONABLE:
        events.append(_reporter_event(
            req=req,
            post_text=plan.get("post_text") or req.question,
            verdict=insp["verdict"],
            risk_score=insp["risk_score"],
            evidence=[e["description"] for e in insp["evidence_chain"]],
            agency_name=plan.get("agency_name"),
            phone=plan.get("identifier"),
        ))

    return {"events": events}
