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


SCAN_NARRATION_PROMPT = """You are Kibo, a warm, plain-spoken assistant protecting migrants from
visa fraud. A user asked you to check the agency @{handle}. Your Inspector agent pulled the
channel's public Telegram posts and indexed them into Elasticsearch, and ES|QL extracted any
reused phone numbers. Here are the findings (JSON):

{findings}

Write a SHORT chat-side analysis — 2 to 3 sentences, conversational, no markdown, no bullet lists:
- Say what the agency advertises and how many posts you scanned and indexed to Elastic.
- Call out the single most notable signal (a reused phone, a risky claim) OR say it looks clean.
- Tell the user the full post-by-post breakdown is now open in the dashboard panel.
Do NOT declare it definitively a scam — frame findings as signals the user should weigh."""


async def narrate_scan(question: str, handle: str, scan: dict) -> str | None:
    """Short chat-side narration of an agency scan. None on failure/no key."""
    if not available():
        return None
    try:
        client = _get_client()
        slim = {
            "agency": scan.get("agency"),
            "posts_scanned": scan.get("posts_scanned"),
            "posts_indexed": scan.get("posts_indexed"),
            "aggregate_risk": scan.get("aggregate_risk"),
            "verdict": scan.get("verdict"),
            "phones_found": scan.get("phones_found"),
            "top_posts": [
                {"risk": p["risk_score"], "verdict": p["verdict"], "text": p["text"][:200]}
                for p in scan.get("posts", [])[:4]
            ],
        }
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=SCAN_NARRATION_PROMPT.format(
                handle=handle,
                findings=json.dumps(slim, default=str)[:8000],
            ),
        )
        text = (resp.text or "").strip()
        return text or None
    except Exception:
        return None


POLICY_STRUCTURE_SCHEMA = {
    "type": "object",
    "properties": {
        "visa_name": {"type": "string", "description": "Official name of the visa, e.g. 'F-1 Student Visa' or 'Skilled Worker visa'."},
        "summary": {"type": "string", "description": "One or two plain-language sentences a non-native English speaker can understand."},
        "fee": {"type": ["string", "null"], "description": "Application fee with currency, e.g. '$185' or '£490'. Null if not stated."},
        "processing_time": {"type": ["string", "null"], "description": "Typical processing time in plain words, e.g. 'about 3 weeks'. Null if not stated."},
        "key_requirements": {"type": "array", "items": {"type": "string"}, "description": "3-6 concise eligibility requirements."},
        "documents": {"type": "array", "items": {"type": "string"}, "description": "Documents the applicant must provide."},
        "steps": {"type": "array", "items": {"type": "string"}, "description": "Application steps in order, if described."},
    },
    "required": ["visa_name", "summary", "key_requirements"],
}

POLICY_STRUCTURE_PROMPT = """You are given raw official visa-policy text crawled from government
websites. It is messy — it may contain navigation menus, cookie banners, and unrelated boilerplate.

Extract clean, structured information for a {purpose} visa for a citizen of {nationality} traveling
to {destination}. Rules:
- IGNORE cookie notices, navigation, and any text not about this visa.
- Use ONLY facts present in the text. Do NOT invent fees, timelines, or rules.
- If the fee or processing time isn't stated, return null for that field.
- Keep each requirement and document to one short line.
- Write the summary in simple English for a non-native speaker.
{hint}
RAW POLICY TEXT:
{raw}"""


async def structure_policy(
    nationality: str,
    destination: str,
    purpose: str,
    raw_text: str,
    fee_hint: float | None = None,
    days_hint: int | None = None,
) -> dict | None:
    """Turn messy crawled policy text into a clean structured object. None on failure."""
    if not available() or not raw_text.strip():
        return None
    hints = []
    if fee_hint:
        hints.append(f"A structured fee of about ${fee_hint:.0f} USD is on record — use it unless the text is clearer.")
    if days_hint:
        hints.append(f"A processing time of about {days_hint} days is on record — use it unless the text is clearer.")
    hint = ("KNOWN DATA: " + " ".join(hints) + "\n") if hints else ""
    try:
        client = _get_client()
        resp = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=POLICY_STRUCTURE_PROMPT.format(
                nationality=nationality,
                destination=destination,
                purpose=purpose,
                hint=hint,
                raw=raw_text[:16000],
            ),
            config={
                "response_mime_type": "application/json",
                "response_json_schema": POLICY_STRUCTURE_SCHEMA,
            },
        )
        return json.loads(resp.text)
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
