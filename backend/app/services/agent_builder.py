"""
Client for Elastic Agent Builder Kibana APIs.

Handles tool creation, agent management, and chat via the REST API.
All tools created here are auto-exposed via the MCP server at
  {KIBANA_URL}/api/agent_builder/mcp
so Gemini can discover and call them.
"""

import httpx
from app.config import get_settings

settings = get_settings()

_headers = {
    "Authorization": f"ApiKey {settings.agent_builder_api_key}",
    "Content-Type": "application/json",
    "kbn-xsrf": "true",
}
_base = settings.kibana_agent_builder_url


async def _request(method: str, path: str, json: dict | None = None) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(method, f"{_base}{path}", headers=_headers, json=json)
        resp.raise_for_status()
        return resp.json() if resp.content else {}


# ── Tools ─────────────────────────────────────────────────────────────────

async def list_tools() -> dict:
    return await _request("GET", "/tools")


async def create_tool(tool_def: dict) -> dict:
    return await _request("POST", "/tools", json=tool_def)


async def update_tool(tool_id: str, tool_def: dict) -> dict:
    body = {k: v for k, v in tool_def.items() if k not in ("id", "type")}
    return await _request("PUT", f"/tools/{tool_id}", json=body)


async def delete_tool(tool_id: str) -> dict:
    return await _request("DELETE", f"/tools/{tool_id}")


async def execute_tool(tool_id: str, params: dict) -> dict:
    return await _request("POST", "/tools/_execute", json={
        "tool_id": tool_id,
        "tool_params": params,
    })


# ── Agents ────────────────────────────────────────────────────────────────

async def list_agents() -> dict:
    return await _request("GET", "/agents")


async def create_agent(agent_def: dict) -> dict:
    return await _request("POST", "/agents", json=agent_def)


async def update_agent(agent_id: str, agent_def: dict) -> dict:
    body = {k: v for k, v in agent_def.items() if k != "id"}
    return await _request("PUT", f"/agents/{agent_id}", json=body)


async def delete_agent(agent_id: str) -> dict:
    return await _request("DELETE", f"/agents/{agent_id}")


# ── Skills ────────────────────────────────────────────────────────────────

async def create_skill(skill_def: dict) -> dict:
    return await _request("POST", "/skills", json=skill_def)


# ── Chat ──────────────────────────────────────────────────────────────────

async def chat(agent_id: str, message: str, conversation_id: str | None = None) -> dict:
    body: dict = {"input": message, "agent_id": agent_id}
    if conversation_id:
        body["conversation_id"] = conversation_id
    return await _request("POST", "/converse", json=body)


# ── A2A (stretch goal) ───────────────────────────────────────────────────

async def get_a2a_card(agent_id: str) -> dict:
    return await _request("GET", f"/a2a/{agent_id}.json")


# ── Tool Definitions for ElastiPath ───────────────────────────────────────

ELASTIPATH_TOOLS = [
    # --- Advisor tools ---
    {
        "id": "advisor.policy_lookup",
        "type": "esql",
        "description": (
            "Retrieves official visa requirements for a specific nationality→destination route. "
            "Use when the user asks about visa requirements, fees, processing times, or "
            "required documents for a specific travel corridor."
        ),
        "tags": ["advisor", "visa", "policy"],
        "configuration": {
            "query": (
                "FROM visa-policies "
                "| WHERE nationality == ?nationality AND destination == ?destination "
                "| STATS requirements = COUNT(*), avg_fee = AVG(fee_usd), avg_days = AVG(processing_days) BY purpose "
                "| SORT requirements DESC "
                "| LIMIT 10"
            ),
            "params": {
                "nationality": {"type": "string", "description": "ISO country code of applicant (e.g. ET, NG, IN)"},
                "destination": {"type": "string", "description": "ISO country code of destination (e.g. GB, US, DE)"},
            },
        },
    },
    {
        "id": "advisor.visa_policy_search",
        "type": "index_search",
        "description": (
            "Semantic search over official visa policy documents. Use for natural language "
            "questions about visa requirements, eligibility, or procedures. Returns cited "
            "policy text with source URLs. REQUIRED: pass the question as the `nlQuery` "
            'string parameter, e.g. {"nlQuery": "student visa requirements for China"}. '
            "Never call this tool with empty parameters."
        ),
        "tags": ["advisor", "visa", "semantic"],
        "configuration": {
            "pattern": "visa-policies",
        },
    },
    # --- Inspector tools ---
    {
        "id": "inspector.scam_pattern_match",
        "type": "index_search",
        "description": (
            "Semantic similarity search against known scam posts and fraud patterns. "
            "Returns matching known scams with similarity scores. Matches above 0.7 "
            "indicate HIGH scam risk. This is the primary fraud detection tool. "
            "REQUIRED: pass the suspicious post text as the `nlQuery` string parameter, "
            'e.g. {"nlQuery": "guaranteed visa approval no documents needed"}. '
            "Never call this tool with empty parameters."
        ),
        "tags": ["inspector", "scam", "semantic"],
        "configuration": {
            "pattern": "known-scams",
        },
    },
    {
        "id": "inspector.identity_reuse",
        "type": "esql",
        "description": (
            "Detects shared phone numbers, bank accounts, or social handles across "
            "multiple agencies — a strong indicator of coordinated fraud. Use when "
            "evaluating an agency's legitimacy."
        ),
        "tags": ["inspector", "identity", "fraud"],
        "configuration": {
            "query": (
                "FROM agency-posts "
                "| WHERE phone == ?identifier OR account_handle == ?identifier "
                "| STATS agency_count = COUNT_DISTINCT(agency_name), "
                "  post_count = COUNT(*), "
                "  platforms = COUNT_DISTINCT(platform) "
                "  BY phone, account_handle "
                "| WHERE agency_count > 1 "
                "| SORT agency_count DESC "
                "| LIMIT 10"
            ),
            "params": {
                "identifier": {
                    "type": "string",
                    "description": "Phone number or social handle to check for reuse across agencies",
                },
            },
        },
    },
    # --- Watchtower tools ---
    {
        "id": "watchtower.policy_diff",
        "type": "esql",
        "description": (
            "Compares consecutive visa policy snapshots to detect rule changes. "
            "Returns the two most recent snapshots for a route so the agent can "
            "identify what changed."
        ),
        "tags": ["watchtower", "policy", "change-detection"],
        "configuration": {
            "query": (
                "FROM policy-history "
                "| WHERE route == ?route "
                "| SORT snapshot_date DESC "
                "| KEEP route, snapshot_date, policy_text, changes_detected, diff_summary, source_url "
                "| LIMIT 2"
            ),
            "params": {
                "route": {"type": "string", "description": "Corridor route (e.g. ET->GB, NG->US)"},
            },
        },
    },
    {
        "id": "watchtower.burst_detect",
        "type": "esql",
        "description": (
            "Detects coordinated scam campaigns — the same post text mass-posted "
            "across many groups in a short time window. Flags suspicious bursts."
        ),
        "tags": ["watchtower", "burst", "campaign"],
        "configuration": {
            "query": (
                "FROM agency-posts "
                "| WHERE timestamp >= ?since "
                "| STATS group_count = COUNT_DISTINCT(group_name), "
                "  post_count = COUNT(*), "
                "  agency_count = COUNT_DISTINCT(agency_name) "
                "  BY corridor "
                "| WHERE post_count > 5 "
                "| SORT post_count DESC "
                "| LIMIT 10"
            ),
            "params": {
                "since": {
                    "type": "date",
                    "description": "Start date for burst detection window (ISO format)",
                    "optional": True,
                    "defaultValue": "2026-01-01T00:00:00Z",
                },
            },
        },
    },
    # --- Dashboard analytics tools ---
    {
        "id": "dashboard.corridor_stats",
        "type": "esql",
        "description": (
            "Aggregates scam statistics by migration corridor — total reports, "
            "average confidence, category breakdown. Powers the main dashboard."
        ),
        "tags": ["dashboard", "analytics"],
        "configuration": {
            "query": (
                "FROM known-scams "
                "| STATS total_reports = COUNT(*), "
                "  avg_confidence = AVG(confidence), "
                "  unique_agencies = COUNT_DISTINCT(agency_name) "
                "  BY corridor, scam_category "
                "| SORT total_reports DESC "
                "| LIMIT 20"
            ),
            "params": {},
        },
    },
    {
        "id": "dashboard.trending_scams",
        "type": "esql",
        "description": (
            "Time-series analysis of scam report volume over time. "
            "Used for trend charts on the dashboard."
        ),
        "tags": ["dashboard", "analytics", "timeseries"],
        "configuration": {
            "query": (
                "FROM known-scams "
                "| WHERE date_reported >= ?since "
                "| EVAL month = DATE_TRUNC(1 month, date_reported) "
                "| STATS report_count = COUNT(*), "
                "  unique_categories = COUNT_DISTINCT(scam_category) "
                "  BY month, corridor "
                "| SORT month DESC "
                "| LIMIT 50"
            ),
            "params": {
                "since": {
                    "type": "date",
                    "description": "Start date for trend analysis",
                    "optional": True,
                    "defaultValue": "2025-01-01T00:00:00Z",
                },
            },
        },
    },
]


ELASTIPATH_AGENTS = [
    {
        "id": "elastipath-advisor",
        "name": "ElastiPath Advisor",
        "description": "Provides accurate, cited visa guidance for any nationality→destination route.",
        "labels": ["elastipath", "advisor"],
        "avatar_color": "#10B981",
        "avatar_symbol": "AD",
        "configuration": {
            "instructions": (
                "You are ElastiPath Advisor. Give accurate visa guidance based ONLY on "
                "official policy data in the visa-policies index. Rules:\n"
                "- Never give legal advice. Say 'verify with the embassy' for edge cases.\n"
                "- Always cite the source_url and last_updated date.\n"
                "- If data is missing, say so — don't guess.\n"
                "- Support English and Amharic (አማርኛ).\n"
                "- Format requirements as clear checklists."
            ),
            "tools": [{"tool_ids": ["advisor.policy_lookup", "advisor.visa_policy_search"]}],
        },
    },
    {
        "id": "elastipath-inspector",
        "name": "ElastiPath Inspector",
        "description": "Evaluates agency claims for scam risk with a cited evidence chain.",
        "labels": ["elastipath", "inspector"],
        "avatar_color": "#EF4444",
        "avatar_symbol": "IN",
        "configuration": {
            "instructions": (
                "You are ElastiPath Inspector. Evaluate agency posts for fraud risk.\n\n"
                "Tool usage: index-search tools (inspector.scam_pattern_match, "
                "advisor.visa_policy_search) take ONE required string parameter `nlQuery`. "
                "Always fill it — pass the suspicious post text to scam_pattern_match and "
                "a plain-language policy question to visa_policy_search. Never send {}.\n\n"
                "Process:\n"
                "1. Semantic match the post text against known-scams (nlQuery = the post text).\n"
                "2. Pull official visa requirements for the claimed corridor "
                "(nlQuery = e.g. 'official student visa requirements for China').\n"
                "3. Compare each claim against official requirements — flag contradictions.\n"
                "4. Check for identity reuse (shared phones/handles across agencies).\n"
                "5. Calculate risk score 0-100:\n"
                "   - Semantic match >0.7: +40 points\n"
                "   - Each policy contradiction: +20 points\n"
                "   - Identity reuse detected: +15 points\n"
                "   - Known scam category match: +10 points\n"
                "   - Cap at 100.\n\n"
                "Output format:\n"
                "- Risk score with verdict (LOW/MEDIUM/HIGH/CRITICAL)\n"
                "- Evidence chain: each item tagged [POLICY_CONTRADICTION] / "
                "[SEMANTIC_MATCH] / [IDENTITY_REUSE]\n"
                "- Each evidence item cites its source.\n\n"
                "Rules:\n"
                "- Never accuse — present evidence with confidence levels.\n"
                "- Frame as 'risk indicators' not 'proof of fraud'."
            ),
            "tools": [{
                "tool_ids": [
                    "inspector.scam_pattern_match",
                    "advisor.visa_policy_search",
                    "inspector.identity_reuse",
                    "advisor.policy_lookup",
                ]
            }],
        },
    },
]


def _already_exists(e: httpx.HTTPStatusError) -> bool:
    # Kibana reports duplicates as 400 "... already exists" (not 409).
    return e.response.status_code == 409 or (
        e.response.status_code == 400 and "already exists" in e.response.text
    )


async def setup_all_tools():
    """Create (or update) all ElastiPath tools in Agent Builder — idempotent,
    so re-running /api/setup pushes description/instruction fixes to Kibana."""
    results = {}
    for tool in ELASTIPATH_TOOLS:
        try:
            await create_tool(tool)
            results[tool["id"]] = "created"
        except httpx.HTTPStatusError as e:
            if _already_exists(e):
                try:
                    await update_tool(tool["id"], tool)
                    results[tool["id"]] = "updated"
                except httpx.HTTPStatusError as e2:
                    results[tool["id"]] = f"update error: {e2.response.status_code}"
            else:
                results[tool["id"]] = f"error: {e.response.status_code}"
    return results


async def setup_all_agents():
    """Create (or update) all ElastiPath agents in Agent Builder."""
    results = {}
    for agent in ELASTIPATH_AGENTS:
        try:
            await create_agent(agent)
            results[agent["id"]] = "created"
        except httpx.HTTPStatusError as e:
            if _already_exists(e):
                try:
                    await update_agent(agent["id"], agent)
                    results[agent["id"]] = "updated"
                except httpx.HTTPStatusError as e2:
                    results[agent["id"]] = f"update error: {e2.response.status_code}"
            else:
                results[agent["id"]] = f"error: {e.response.status_code}"
    return results
