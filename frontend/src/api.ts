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

export function getVisaOverview(nationality: string) {
  return request<VisaOverviewData>(`/dashboard/visa-overview?nationality=${nationality}`);
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
  requirements: {
    requirement_text: string;
    fee_usd: number | null;
    processing_days: number | null;
    source_url: string;
    source_name: string;
    last_updated: string | null;
  }[];
  total_found: number;
  purpose: string;
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

export type KiboEvent = KiboHandoffEvent | KiboAgentCardEvent | KiboReplyEvent;

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
