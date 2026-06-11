"""
Outbound action channel for the Reporter agent.

This is what makes Kibo *do something* instead of only describing: a confirmed
scam becomes a real, delivered complaint. Today the channel is email (Resend);
the `send_email` surface is deliberately small so a Composio / Slack / fax
channel can slot in behind the same Reporter endpoint later.

Degrades gracefully: with no RESEND_API_KEY set the function returns
`delivered=False, channel="draft"` and the caller still files the Elastic
warning and hands the drafted complaint back to the user — nothing breaks.

Delivery: complaints go to the authority's officially published reporting
email when one exists (known map, else a Gemini grounded lookup), with the
configured REPORT_TO_EMAIL BCC'd as the record copy. Portal-only authorities
fall back to the record-copy inbox with the letter ready to file.
"""

import html as html_mod

import httpx

from app.config import get_settings

settings = get_settings()

RESEND_ENDPOINT = "https://api.resend.com/emails"


def email_configured() -> bool:
    return bool(settings.resend_api_key and settings.report_to_email)


# Where a complaint for a given destination should be filed. `address` is the
# authority the letter is written to; `portal` is where a human can also file
# directly. Falls back to a generic entry for unmapped destinations.
# `email` is the authority's public reporting inbox where one exists — many
# (IC3, Scamwatch, Home Office) only accept reports through a web portal, so
# their email stays empty and delivery falls back to the configured inbox.
AUTHORITIES: dict[str, dict[str, str]] = {
    "GB": {
        "name": "UK Immigration Enforcement",
        "address": "Immigration Enforcement, Home Office",
        "portal": "https://www.gov.uk/report-immigration-crime",
        "email": "",
    },
    "US": {
        "name": "FBI Internet Crime Complaint Center (IC3)",
        "address": "FBI IC3 / FTC Consumer Sentinel",
        "portal": "https://www.ic3.gov/",
        "email": "",
    },
    "CA": {
        "name": "Canadian Anti-Fraud Centre",
        "address": "Canadian Anti-Fraud Centre (CAFC)",
        "portal": "https://antifraudcentre-centreantifraude.ca/report-signalez-eng.htm",
        "email": "info@antifraudcentre.ca",
    },
    "AU": {
        "name": "Scamwatch (ACCC)",
        "address": "Scamwatch, Australian Competition & Consumer Commission",
        "portal": "https://www.scamwatch.gov.au/report-a-scam",
        "email": "",
    },
    "DE": {
        "name": "German Federal Foreign Office — Visa Fraud",
        "address": "Auswärtiges Amt, Visa Section",
        "portal": "https://www.auswaertiges-amt.de/en",
        "email": "buergerservice@diplo.de",
    },
}

GENERIC_AUTHORITY = {
    "name": "Destination Embassy — Visa Fraud Desk",
    "address": "Consular / Visa Fraud Desk of the destination embassy",
    "portal": "",
    "email": "",
}


def authority_for(destination: str | None) -> dict[str, str]:
    """Resolve the reporting authority for a destination ISO code (e.g. 'GB')."""
    if destination:
        return AUTHORITIES.get(destination.strip().upper(), GENERIC_AUTHORITY)
    return GENERIC_AUTHORITY


def _esc(s: str | None) -> str:
    return html_mod.escape(s or "")


def complaint_html(
    *,
    case_ref: str,
    filed_at: str,
    corridor: str,
    risk_score: int,
    verdict: str,
    agency_name: str | None,
    handle: str | None,
    phone: str | None,
    authority_name: str,
    authority_portal: str,
    evidence: list[str],
    letter: str,
) -> str:
    """Branded, inline-styled HTML for the outbound complaint email."""
    id_rows = ""
    for label, value in (
        ("Agency", agency_name),
        ("Handle", f"@{handle.lstrip('@')}" if handle else None),
        ("Phone", phone),
    ):
        if value:
            id_rows += (
                f'<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:130px;">{label}</td>'
                f'<td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">{_esc(value)}</td></tr>'
            )

    ev_items = "".join(
        f'<li style="margin:0 0 6px;color:#334155;font-size:13px;line-height:1.5;">{_esc(e)}</li>'
        for e in evidence[:5]
    ) or '<li style="margin:0;color:#334155;font-size:13px;">Multiple automated fraud signals.</li>'

    portal_btn = (
        f'<a href="{_esc(authority_portal)}" '
        f'style="display:inline-block;margin-top:10px;padding:9px 16px;background:#0f172a;color:#ffffff;'
        f'text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">Official reporting portal →</a>'
        if authority_portal else ""
    )

    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:580px;margin:24px auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">

  <div style="background:#0f172a;padding:22px 28px;">
    <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">CARRYOVER</div>
    <div style="color:#94a3b8;font-size:12px;margin-top:3px;">Reporter · automated visa-fraud complaint</div>
  </div>

  <div style="padding:24px 28px 8px;">
    <table cellpadding="0" cellspacing="0" style="width:100%;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:130px;">Case reference</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:700;">{_esc(case_ref)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Filed</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;">{_esc(filed_at)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Corridor</td>
          <td style="padding:6px 0;color:#0f172a;font-size:13px;font-weight:600;">{_esc(corridor or "unspecified")}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Risk assessment</td>
          <td style="padding:6px 0;">
            <span style="display:inline-block;padding:3px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:999px;font-size:12px;font-weight:700;">{risk_score}/100 · {_esc(verdict)}</span>
          </td></tr>
      {id_rows}
    </table>
  </div>

  <div style="padding:18px 28px 4px;">
    <div style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:8px;">Formal complaint — addressed to {_esc(authority_name)}</div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #0f172a;border-radius:6px;padding:16px 18px;color:#334155;font-size:13px;line-height:1.65;white-space:pre-wrap;">{_esc(letter)}</div>
  </div>

  <div style="padding:18px 28px 4px;">
    <div style="color:#0f172a;font-size:14px;font-weight:700;margin-bottom:8px;">Evidence from the automated check</div>
    <ul style="margin:0;padding-left:18px;">{ev_items}</ul>
  </div>

  <div style="padding:18px 28px 24px;">
    <div style="color:#64748b;font-size:12px;line-height:1.6;">
      This complaint is addressed to <strong style="color:#0f172a;">{_esc(authority_name)}</strong> and ready to forward.
    </div>
    {portal_btn}
  </div>

  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;">
    <div style="color:#94a3b8;font-size:11px;line-height:1.6;">
      Filed via <strong>Carryover Reporter</strong> after a user-confirmed action ·
      a community warning for this agency is now indexed in Elasticsearch.
    </div>
  </div>

</div>
</body></html>"""


async def send_email(
    subject: str,
    body: str,
    reply_to: str | None = None,
    html: str | None = None,
    to: str | None = None,
) -> dict:
    """Deliver a complaint via Resend. Never raises — returns a status dict.

    `to` overrides the recipient (the authority's inbox); the configured
    REPORT_TO_EMAIL is then BCC'd as the sender's record copy.
    """
    if not email_configured():
        return {
            "channel": "draft",
            "delivered": False,
            "detail": "Email channel not configured (set RESEND_API_KEY + REPORT_TO_EMAIL).",
        }

    recipient = to or settings.report_to_email
    payload = {
        "from": settings.report_from_email,
        "to": [recipient],
        "subject": subject,
        "text": body,
    }
    if to and to != settings.report_to_email:
        payload["bcc"] = [settings.report_to_email]
    if html:
        payload["html"] = html
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
            "to": recipient,
            "message_id": msg_id,
            "detail": f"Complaint emailed to {recipient}.",
        }
    except Exception as e:  # network / DNS / timeout — stay graceful
        return {"channel": "email", "delivered": False, "detail": f"Send failed: {e}"}
