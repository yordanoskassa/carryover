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

from fastapi import APIRouter

from app.models.schemas import AdvisorRequest, InspectorRequest, KiboChatRequest
from app.routers.advisor import get_requirements
from app.routers.inspector import evaluate_agency
from app.services import gemini

router = APIRouter(prefix="/api/kibo", tags=["kibo"])

INSPECTOR_TOOLS = ["inspector.scam_pattern_match", "inspector.identity_reuse", "ES|QL"]
ADVISOR_TOOLS = ["advisor.policy_lookup", "advisor.visa_policy_search", "ELSER"]

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


def _trim_advisor(result) -> dict:
    """Top requirements only — agent cards are compact."""
    reqs = []
    for r in result.requirements[:3]:
        reqs.append({
            "requirement_text": r.requirement_text[:220],
            "fee_usd": r.fee_usd,
            "processing_days": r.processing_days,
            "source_url": r.source_url,
            "source_name": r.source_name,
            "last_updated": r.last_updated,
        })
    return {
        "requirements": reqs,
        "total_found": len(result.requirements),
        "purpose": result.purpose,
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


@router.post("/chat")
async def kibo_chat(req: KiboChatRequest):
    """Orchestrated chat turn: route → run specialists in parallel → synthesize."""

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
        tasks["advisor"] = get_requirements(AdvisorRequest(
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

    return {"events": events}
