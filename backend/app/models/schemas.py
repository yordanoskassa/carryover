from pydantic import BaseModel
from datetime import datetime


# ── Advisor ───────────────────────────────────────────────────────────────

class AdvisorRequest(BaseModel):
    nationality: str  # ISO code: ET, NG, IN
    destination: str  # ISO code: GB, US, DE
    purpose: str = "student"  # student, work, family, tourist


class PolicyResult(BaseModel):
    requirement_text: str
    documents_needed: str | None = None
    fee_usd: float | None = None
    processing_days: int | None = None
    source_url: str
    source_name: str
    last_updated: str | None = None


class AdvisorResponse(BaseModel):
    nationality: str
    destination: str
    purpose: str
    requirements: list[PolicyResult]
    summary: str | None = None


# ── Inspector ─────────────────────────────────────────────────────────────

class InspectorRequest(BaseModel):
    agency_name: str | None = None
    post_text: str
    corridor: str | None = None  # e.g. "ET->GB"


class EvidenceItem(BaseModel):
    type: str  # POLICY_CONTRADICTION, SEMANTIC_MATCH, IDENTITY_REUSE, CATEGORY_MATCH
    description: str
    source: str | None = None
    confidence: float = 0.0


class InspectorResponse(BaseModel):
    risk_score: int  # 0-100
    verdict: str  # LOW, MEDIUM, HIGH, CRITICAL
    evidence_chain: list[EvidenceItem]
    matched_scams: int = 0
    contradictions: int = 0
    identity_reuse_count: int = 0
    agency_name: str | None = None


# ── Dashboard ─────────────────────────────────────────────────────────────

class CorridorStat(BaseModel):
    corridor: str
    total_reports: int
    avg_confidence: float
    unique_agencies: int
    scam_category: str | None = None


class TrendPoint(BaseModel):
    month: str
    corridor: str
    report_count: int
    unique_categories: int


class DashboardResponse(BaseModel):
    corridor_stats: list[CorridorStat]
    trending: list[TrendPoint]
    total_scams_indexed: int
    total_policies_indexed: int
    recent_policy_changes: list[dict]


# ── Kibo (orchestrator chat) ──────────────────────────────────────────────

class KiboChatRequest(BaseModel):
    question: str
    nationality: str  # ISO code: ET, NG, IN
    destination: str  # ISO code: GB, US, DE
    purpose: str = "student"


# ── Scam Report (memory write-back) ──────────────────────────────────────

class ScamReport(BaseModel):
    post_text: str
    agency_name: str | None = None
    phone: str | None = None
    account_handle: str | None = None
    platform: str | None = None
    corridor: str | None = None
    scam_category: str = "general_fraud"


class ScamReportResponse(BaseModel):
    indexed: bool
    document_id: str
    message: str


# ── Reporter (real outbound action) ──────────────────────────────────────

class ReporterFileRequest(BaseModel):
    """One-click action on a confirmed scam: file warning + draft & send complaint."""
    post_text: str
    agency_name: str | None = None
    handle: str | None = None
    phone: str | None = None
    nationality: str | None = None
    destination: str | None = None  # ISO code → picks the reporting authority
    corridor: str | None = None
    risk_score: int = 0
    verdict: str = "HIGH"
    evidence: list[str] = []  # short evidence-chain descriptions
    reply_to: str | None = None  # optional user email for the authority to reach


class ComplaintDraft(BaseModel):
    to_authority: str
    authority_portal: str
    subject: str
    body: str


class DeliveryStatus(BaseModel):
    channel: str  # "email" | "draft"
    delivered: bool
    detail: str
    message_id: str | None = None


class ReporterFileResponse(BaseModel):
    filed: bool  # indexed into known-scams (community warning)
    document_id: str | None = None
    complaint: ComplaintDraft
    delivery: DeliveryStatus
    summary: str  # one-line plain-language recap for Kibo to show
