import { useEffect, useState } from 'react';
import { Detective, Phone, CircleNotch, Warning } from '@phosphor-icons/react';
import { getFlaggedAgencies, getFlaggedPhones } from '../api';

interface FlaggedAgency {
  agency_name: string;
  report_count: number;
  avg_confidence: number;
  corridors: number;
}

interface FlaggedPhone {
  phone: string;
  agency_count: number;
  post_count: number;
}

// Drop ES|QL artifacts that aren't real phone numbers (price ranges etc.).
const looksLikePhone = (p: string) => /^\+?\d[\d\s()./-]{7,}$/.test(p) && !/^\d{4,}-\d{4,}$/.test(p);

// What Inspector already knows: agencies flagged in known-scams and phone
// numbers reused across agencies (the ES|QL identity-reuse signal), live from
// Elasticsearch. Fills the Inspector tab with the watchlist itself.
export default function FlaggedIntel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [agencies, setAgencies] = useState<FlaggedAgency[]>([]);
  const [phones, setPhones] = useState<FlaggedPhone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getFlaggedAgencies(), getFlaggedPhones()])
      .then(([ag, ph]) => {
        setAgencies((ag.agencies as unknown as FlaggedAgency[]).slice(0, 8));
        setPhones((ph.phones as unknown as FlaggedPhone[]).filter((p) => looksLikePhone(p.phone)).slice(0, 8));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center border rounded-lg">
        <CircleNotch size={16} className="animate-spin" /> Loading flagged intel from Elastic…
      </div>
    );
  }

  if (agencies.length === 0 && phones.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Flagged agencies */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-card/50 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-red-400 uppercase tracking-wider">
            <Detective size={14} weight="bold" /> Flagged agencies
          </h3>
          <span className="text-[10px] font-mono text-muted-foreground">known-scams · ES|QL</span>
        </div>
        <div className="divide-y divide-border">
          {agencies.map((a) => (
            <div key={a.agency_name} className="px-4 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-sm font-semibold truncate block">{a.agency_name}</span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {a.report_count} report{a.report_count === 1 ? '' : 's'}
                  {a.corridors > 1 ? ` · ${a.corridors} corridors` : ''}
                </span>
              </div>
              <span className="shrink-0 text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                {Math.round(a.avg_confidence * 100)}% confidence
              </span>
            </div>
          ))}
          {agencies.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">No agencies flagged yet.</p>
          )}
        </div>
      </div>

      {/* Reused phone numbers */}
      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-card/50 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <Phone size={14} weight="bold" /> Phones reused across agencies
          </h3>
          <span className="text-[10px] font-mono text-muted-foreground">identity reuse · ES|QL</span>
        </div>
        <div className="divide-y divide-border">
          {phones.map((p) => (
            <div key={p.phone} className="px-4 py-2 flex items-center justify-between gap-2">
              <span className="text-sm font-mono truncate">{p.phone}</span>
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                <Warning size={11} weight="bold" /> {p.agency_count} agencies · {p.post_count} posts
              </span>
            </div>
          ))}
          {phones.length === 0 && (
            <p className="px-4 py-3 text-xs text-muted-foreground">No shared phone numbers detected yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
