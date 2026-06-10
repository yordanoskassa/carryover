"""
Gemini orchestration layer for Kibo.

Kibo is the front-door orchestrator: Gemini decides which specialist agents
(Inspector, Advisor) handle a user question, then synthesizes their structured
findings into a final answer. Specialists themselves run on Elastic
(ELSER semantic search + ES|QL via the Agent Builder tool definitions).

Degrades gracefully: if GEMINI_API_KEY is unset or a call fails, callers fall
back to heuristic routing and template synthesis so the product keeps working.
"""

import json
from app.config import get_settings

settings = get_settings()

_client = None


def available() -> bool:
    return bool(settings.gemini_api_key)


def _get_client():
    global _client
    if _client is None:
        from google import genai
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


ROUTE_SCHEMA = {
    "type": "object",
    "properties": {
        "agents": {
            "type": "array",
            "items": {"type": "string", "enum": ["inspector", "advisor"]},
            "description": "Which specialist agents should handle this question.",
        },
        "reason": {
            "type": "string",
            "description": "One short sentence explaining the routing decision.",
        },
        "post_text": {
            "type": ["string", "null"],
            "description": "If the question contains a pasted agency post/claim to fraud-check, the extracted post text.",
        },
        "agency_name": {
            "type": ["string", "null"],
            "description": "Agency name mentioned in the post, if any.",
        },
        "identifier": {
            "type": ["string", "null"],
            "description": "Phone number or social handle mentioned, if any.",
        },
    },
    "required": ["agents", "reason"],
}

ROUTER_PROMPT = """You are the router for Kibo, a visa-fraud-protection assistant for migrants.

Two specialist agents are available:
- "inspector": fraud detection. Use when the user pastes or describes an agency
  post, offer, or claim and wants to know if it is legitimate (mentions of
  guarantees, fees, fast processing, agents/agencies, phone numbers, social media).
- "advisor": official visa requirements. Use when the user asks what is required,
  fees, processing times, documents, or how the legitimate process works.

Route to BOTH when the user asks about a suspicious offer (inspector checks the
claim, advisor supplies the official policy to compare against).

User context: citizen of {nationality}, destination {destination}, purpose {purpose}.
User question:
{question}"""

SYNTHESIS_PROMPT = """You are Kibo, a warm, plain-spoken visa intelligence assistant protecting
migrants from visa fraud. A user (citizen of {nationality}, heading to {destination}
for {purpose}) asked:

{question}

Your specialist agents returned these findings (JSON):

{findings}

Write Kibo's reply in 2-4 short sentences:
- Lead with the direct answer (e.g. "This is very likely a scam" or the key requirement).
- Ground every claim in the findings; never invent fees, timelines, or rules.
- If inspector findings exist, state the risk plainly and name the strongest evidence.
- If advisor findings exist, state the official route's key facts and cite the source name.
- Never give legal advice; for edge cases say "verify with the embassy".
- No markdown, no bullet lists — conversational prose only."""


async def route(question: str, nationality: str, destination: str, purpose: str) -> dict | None:
    """Ask Gemini which agents should handle the question. None on failure."""
    if not available():
        return None
    try:
        client = _get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=ROUTER_PROMPT.format(
                nationality=nationality,
                destination=destination,
                purpose=purpose,
                question=question,
            ),
            config={
                "response_mime_type": "application/json",
                "response_json_schema": ROUTE_SCHEMA,
            },
        )
        plan = json.loads(resp.text)
        if not plan.get("agents"):
            return None
        return plan
    except Exception:
        return None


async def synthesize(
    question: str,
    nationality: str,
    destination: str,
    purpose: str,
    findings: dict,
) -> str | None:
    """Synthesize specialist findings into Kibo's final reply. None on failure."""
    if not available():
        return None
    try:
        client = _get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=SYNTHESIS_PROMPT.format(
                nationality=nationality,
                destination=destination,
                purpose=purpose,
                question=question,
                findings=json.dumps(findings, default=str)[:12000],
            ),
        )
        text = (resp.text or "").strip()
        return text or None
    except Exception:
        return None
