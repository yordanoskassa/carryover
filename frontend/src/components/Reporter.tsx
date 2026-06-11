import { useEffect, useState } from 'react';
import { Megaphone, CheckCircle, Phone, At, CircleNotch } from '@phosphor-icons/react';
import { getRecentReports, type RecentReport } from '../api';

function verdictClasses(verdict: string | null) {
  if (verdict === 'CRITICAL' || verdict === 'HIGH') return 'bg-red-500/15 text-red-400';
  if (verdict === 'MEDIUM') return 'bg-amber-500/15 text-amber-400';
  return 'bg-emerald-500/15 text-emerald-400';
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

// The Reporter tab: the visible record of what the action agent has done —
// every community warning filed back into Elasticsearch, newest first.
export default function Reporter({ refreshKey = 0 }: { refreshKey?: number }) {
  const [reports, setReports] = useState<RecentReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRecentReports(25)
      .then((r) => setReports(r.reports))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-amber-400">
            <Megaphone size={18} weight="bold" /> Reporter
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-[60ch]">
            The action agent. When Inspector confirms a scam, Reporter files a
            community warning into Elasticsearch and drafts a formal complaint to
            the corridor's fraud authority. Every report below now protects the
            next person who checks that agency.
          </p>
        </div>
        <span className="shrink-0 text-xs font-mono text-muted-foreground px-2 py-1 rounded-md border">
          {reports.length} filed
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <CircleNotch size={16} className="animate-spin" /> Loading filed reports…
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No reports filed yet. When Kibo confirms a scam, tap{' '}
          <span className="text-amber-400 font-semibold">Report this agency</span> to file the first one.
        </div>
      )}

      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className="border rounded-lg p-3 bg-card">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold truncate">
                  {r.agency_name || r.account_handle || 'Unnamed agency'}
                </span>
                {r.corridor && (
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">{r.corridor}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {r.verdict && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${verdictClasses(r.verdict)}`}>
                    {r.risk_score != null ? `${r.risk_score}/100 · ` : ''}{r.verdict}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">{timeAgo(r.date_reported)}</span>
              </div>
            </div>

            <p className="text-sm text-foreground/85 leading-snug line-clamp-2">{r.post_text}</p>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle size={11} weight="fill" /> Warning live in Elastic
              </span>
              {r.account_handle && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                  <At size={11} />{r.account_handle.replace(/^@/, '')}
                </span>
              )}
              {r.phone && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                  <Phone size={11} />{r.phone}
                </span>
              )}
              {r.scam_category && (
                <span className="text-[11px] text-muted-foreground font-mono">{r.scam_category}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
