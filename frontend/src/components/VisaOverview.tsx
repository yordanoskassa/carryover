import { useEffect, useState } from 'react';
import { getVisaOverview, type VisaOverviewData } from '../api';

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

function getBarColor(score: number): string {
  if (score >= 65) return 'bg-emerald-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

function getLabelColor(score: number): string {
  if (score >= 65) return 'text-emerald-600';
  if (score >= 45) return 'text-amber-600';
  return 'text-red-600';
}

export default function VisaOverview({ nationality }: { nationality: string }) {
  const [data, setData] = useState<VisaOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getVisaOverview(nationality)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [nationality]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-6 h-4 bg-muted rounded animate-pulse" />
            <div className="flex-1 h-1.5 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.destinations.length === 0) {
    return <p className="text-xs text-muted-foreground">No visa data indexed yet.</p>;
  }

  const maxScore = Math.max(...data.destinations.map((e) => e.score), 1);

  return (
    <div className="space-y-0.5">
      <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Openness Index</h3>
      {data.destinations.map((entry) => (
        <div key={entry.code} className="flex items-center gap-2 py-1">
          <span className="text-xs leading-none shrink-0">{countryFlag(entry.code)}</span>
          <span className="text-xs w-14 shrink-0 truncate">{entry.name}</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarColor(entry.score)}`}
              style={{ width: `${(entry.score / maxScore) * 100}%` }}
            />
          </div>
          <span className={`text-[10px] font-medium w-12 text-right ${getLabelColor(entry.score)}`}>
            {entry.label}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground mt-2">
        {data.destinations.reduce((sum, d) => sum + d.policy_count, 0)} policies
        · {data.destinations.reduce((sum, d) => sum + d.scam_reports, 0)} reports
      </p>
    </div>
  );
}
