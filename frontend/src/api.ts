const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Advisor ──────────────────────────────────────────────────────────────

export interface PolicyResult {
  requirement_text: string;
  documents_needed: string | null;
  fee_usd: number | null;
  processing_days: number | null;
  source_url: string;
  source_name: string;
  last_updated: string | null;
}

export interface AdvisorResponse {
  nationality: string;
  destination: string;
  purpose: string;
  requirements: PolicyResult[];
  summary: string | null;
}

export function getRequirements(nationality: string, destination: string, purpose: string) {
  return request<AdvisorResponse>('/advisor/requirements', {
    method: 'POST',
    body: JSON.stringify({ nationality, destination, purpose }),
  });
}

export interface StructuredPolicy {
  nationality: string;
  destination: string;
  purpose: string;
  found: boolean;
  ai_structured: boolean;
  visa_name: string | null;
  summary: string | null;
  fee: string | null;
  processing_time: string | null;
  key_requirements: string[];
  documents: string[];
  steps: string[];
  source_name: string | null;
  source_url: string | null;
}

export function getStructuredPolicy(nationality: string, destination: string, purpose: string) {
  return request<StructuredPolicy>('/advisor/structured', {
    method: 'POST',
    body: JSON.stringify({ nationality, destination, purpose }),
  });
}

// ── Elastic data overview ────────────────────────────────────────────────

export interface ElasticIndexInfo {
  index: string;
  label: string;
  description: string;
  source: string;
  semantic: boolean;
  doc_count: number;
}

export interface ElasticOverview {
  total_docs: number;
  indices: ElasticIndexInfo[];
  structured_breakdown: { firecrawl: number; grounded: number; gemini: number };
}

export function getElasticOverview() {
  return request<ElasticOverview>('/elastic/overview');
}

// ── Live visa news (ticker) ──────────────────────────────────────────────

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  date_text: string;
  tone: 'good' | 'warning' | 'neutral';
}

export function getVisaNews() {
  return request<{ items: NewsItem[] }>('/news/recent');
}

// ── Inspector ────────────────────────────────────────────────────────────

export interface EvidenceItem {
  type: string;
  description: string;
  source: string | null;
  confidence: number;
}

export interface InspectorResponse {
  risk_score: number;
  verdict: string;
  evidence_chain: EvidenceItem[];
  matched_scams: number;
  contradictions: number;
  identity_reuse_count: number;
  agency_name: string | null;
}

export function evaluateAgency(post_text: string, agency_name?: string, corridor?: string) {
  return request<InspectorResponse>('/inspector/evaluate', {
    method: 'POST',
    body: JSON.stringify({ post_text, agency_name, corridor }),
  });
}

export interface ScanPost {
  text: string;
  date: string | null;
  risk_score: number;
  verdict: string;
  evidence: { type: string; description: string; confidence: number }[];
}

export interface ScanAgencyResponse {
  agency: { handle: string; title: string; description: string | null };
  posts_scanned: number;
  posts_indexed: number;
  aggregate_risk: number;
  verdict: string;
  phones_found: string[];
  posts: ScanPost[];
}

export function scanAgency(handle: string, corridor?: string) {
  return request<ScanAgencyResponse>('/inspector/scan-agency', {
    method: 'POST',
    body: JSON.stringify({ handle, corridor }),
  });
}

export function reportScam(data: {
  post_text: string;
  agency_name?: string;
  phone?: string;
  corridor?: string;
  scam_category?: string;
}) {
  return request<{ indexed: boolean; document_id: string; message: string }>(
    '/inspector/report',
    { method: 'POST', body: JSON.stringify(data) },
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────

export interface CorridorStat {
  corridor: string;
  total_reports: number;
  avg_confidence: number;
  unique_agencies: number;
  scam_category: string | null;
}

export interface TrendPoint {
  month: string;
  corridor: string;
  report_count: number;
  unique_categories: number;
}

export interface DashboardData {
  corridor_stats: CorridorStat[];
  trending: TrendPoint[];
  total_scams_indexed: number;
  total_policies_indexed: number;
  recent_policy_changes: Record<string, string>[];
}

export function getDashboard() {
  return request<DashboardData>('/dashboard/stats');
}

export interface VisaDestEntry {
  code: string;
  name: string;
  score: number;
  label: string;
  policy_count: number;
  scam_reports: number;
}

export interface CrawledSource {
  title: string;
  url: string;
  host: string;
  crawled_at: string;
}

export interface VisaOverviewData {
  nationality: string;
  destinations: VisaDestEntry[];
  policy_updates: Record<string, string>[];
  crawled_sources: CrawledSource[];
}

export function getVisaOverview(nationality: string, purpose = 'student') {
  return request<VisaOverviewData>(`/dashboard/visa-overview?nationality=${nationality}&purpose=${purpose}`);
}

export function getFlaggedAgencies() {
  return request<{ agencies: Record<string, unknown>[] }>('/dashboard/flagged-agencies');
}

export function getFlaggedPhones() {
  return request<{ phones: Record<string, unknown>[] }>('/dashboard/flagged-phones');
}

// ── Kibo (Orchestrator Agent) ───────────────────────────────────────────

export type KiboAgentId = 'inspector' | 'advisor';

export interface KiboHandoffEvent {
  kind: 'handoff';
  agents: KiboAgentId[];
  reason: string;
  router: 'gemini' | 'heuristic';
}

export interface InspectorCardData {
  risk_score: number;
  verdict: string;
  matched_scams: number;
  contradictions: number;
  identity_reuse_count: number;
  evidence_chain: { type: string; description: string; source: string | null; confidence: number }[];
}

export interface AdvisorCardData {
  visa_name: string | null;
  summary: string;
  fee: string | null;
  processing_time: string | null;
  requirements: string[];
  source_name: string | null;
  source_url: string | null;
}

export interface KiboAgentCardEvent {
  kind: 'agent_card';
  agent: KiboAgentId;
  tools: string[];
  error: string | null;
  data: InspectorCardData | AdvisorCardData | null;
}

export interface KiboReplyEvent {
  kind: 'kibo';
  content: string;
  engine: 'gemini' | 'elastic-fallback';
}

export interface KiboScanEvent {
  kind: 'scan_result';
  data: ScanAgencyResponse;
}

// Reporter — the action agent. Kibo proposes a one-click report; the payload
// is posted as-is to /reporter/file when the user confirms.
export interface ReporterPayload {
  post_text: string;
  agency_name: string | null;
  handle: string | null;
  phone: string | null;
  nationality: string;
  destination: string;
  corridor: string;
  risk_score: number;
  verdict: string;
  evidence: string[];
}

export interface KiboActionPromptEvent {
  kind: 'action_prompt';
  agent: 'reporter';
  tools: string[];
  label: string;
  description: string;
  payload: ReporterPayload;
}

// Kibo detected a corridor or purpose switch in the question (e.g. "what
// about the US?", "how about a work visa") — the UI follows by updating its
// nationality/destination/purpose selection.
export interface KiboContextEvent {
  kind: 'context';
  nationality: string;
  destination: string;
  purpose?: string;
}

// A narrated unit of agent work ("Searching visa-policies with ELSER…") the
// chat plays back sequentially — the visible multistep trace.
export interface KiboStepEvent {
  kind: 'step';
  agent: KiboAgentId | 'kibo';
  text: string;
}

export type KiboEvent =
  | KiboHandoffEvent | KiboAgentCardEvent | KiboReplyEvent
  | KiboScanEvent | KiboActionPromptEvent | KiboContextEvent | KiboStepEvent;

export interface ReporterResult {
  filed: boolean;
  document_id: string | null;
  complaint: { to_authority: string; authority_portal: string; subject: string; body: string };
  delivery: { channel: string; delivered: boolean; detail: string; message_id: string | null };
  summary: string;
}

export function fileReport(payload: ReporterPayload & { reply_to?: string }) {
  return request<ReporterResult>('/reporter/file', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface RecentReport {
  id: string;
  post_text: string;
  agency_name: string | null;
  account_handle: string | null;
  phone: string | null;
  corridor: string | null;
  scam_category: string | null;
  risk_score: number | null;
  verdict: string | null;
  source: string;
  date_reported: string | null;
}

export function getRecentReports(size = 20) {
  return request<{ reports: RecentReport[] }>(`/reporter/recent?size=${size}`);
}

export function kiboChat(
  question: string,
  context: { nationality: string; destination: string; purpose: string },
) {
  return request<{ events: KiboEvent[] }>('/kibo/chat', {
    method: 'POST',
    body: JSON.stringify({
      question,
      nationality: context.nationality,
      destination: context.destination,
      purpose: context.purpose,
    }),
  });
}
