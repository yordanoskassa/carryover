"""
Outbound action channel for the Reporter agent.

This is what makes Kibo *do something* instead of only describing: a confirmed
scam becomes a real, delivered complaint. Today the channel is email (Resend);
the `send_email` surface is deliberately small so a Composio / Slack / fax
channel can slot in behind the same Reporter endpoint later.

Degrades gracefully: with no RESEND_API_KEY set the function returns
`delivered=False, channel="draft"` and the caller still files the Elastic
warning and hands the drafted complaint back to the user — nothing breaks.

Safety: complaints are delivered to a configured reports inbox
(REPORT_TO_EMAIL), not auto-blasted to government desks. The letter is
*addressed* to the right authority and ready for the user to forward.
"""

import httpx

from app.config import get_settings

settings = get_settings()

RESEND_ENDPOINT = "https://api.resend.com/emails"


def email_configured() -> bool:
    return bool(settings.resend_api_key and settings.report_to_email)


# Where a complaint for a given destination should be filed. `address` is the
# authority the letter is written to; `portal` is where a human can also file
# directly. Falls back to a generic entry for unmapped destinations.
AUTHORITIES: dict[str, dict[str, str]] = {
    "GB": {
        "name": "UK Immigration Enforcement",
        "address": "Immigration Enforcement, Home Office",
        "portal": "https://www.gov.uk/report-immigration-crime",
    },
    "US": {
        "name": "FBI Internet Crime Complaint Center (IC3)",
        "address": "FBI IC3 / FTC Consumer Sentinel",
        "portal": "https://www.ic3.gov/",
    },
    "CA": {
        "name": "Canadian Anti-Fraud Centre",
        "address": "Canadian Anti-Fraud Centre (CAFC)",
        "portal": "https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm",
    },
    "AU": {
        "name": "Scamwatch (ACCC)",
        "address": "Scamwatch, Australian Competition & Consumer Commission",
        "portal": "https://www.scamwatch.gov.au/report-a-scam",
    },
    "DE": {
        "name": "German Federal Foreign Office — Visa Fraud",
        "address": "Auswärtiges Amt, Visa Section",
        "portal": "https://www.auswaertiges-amt.de/en",
    },
}

GENERIC_AUTHORITY = {
    "name": "Destination Embassy — Visa Fraud Desk",
    "address": "Consular / Visa Fraud Desk of the destination embassy",
    "portal": "",
}


def authority_for(destination: str | None) -> dict[str, str]:
    """Resolve the reporting authority for a destination ISO code (e.g. 'GB')."""
    if destination:
        return AUTHORITIES.get(destination.strip().upper(), GENERIC_AUTHORITY)
    return GENERIC_AUTHORITY


async def send_email(subject: str, body: str, reply_to: str | None = None) -> dict:
    """Deliver a complaint via Resend. Never raises — returns a status dict."""
    if not email_configured():
        return {
            "channel": "draft",
            "delivered": False,
            "detail": "Email channel not configured (set RESEND_API_KEY + REPORT_TO_EMAIL).",
        }

    payload = {
        "from": settings.report_from_email,
        "to": [settings.report_to_email],
        "subject": subject,
        "text": body,
    }
    if reply_to:
        payload["reply_to"] = reply_to

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                RESEND_ENDPOINT,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json=payload,
            )
        if res.status_code >= 400:
            return {"channel": "email", "delivered": False,
                    "detail": f"Resend error {res.status_code}: {res.text[:160]}"}
        msg_id = res.json().get("id", "")
        return {
            "channel": "email",
            "delivered": True,
            "to": settings.report_to_email,
            "message_id": msg_id,
            "detail": f"Complaint emailed to {settings.report_to_email}.",
        }
    except Exception as e:  # network / DNS / timeout — stay graceful
        return {"channel": "email", "delivered": False, "detail": f"Send failed: {e}"}
