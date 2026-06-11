import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { getDashboard, getFlaggedAgencies, getFlaggedPhones, type DashboardData } from '../api';

const CORRIDOR_COLORS: Record<string, string> = {
  'ET->GB': '#10b981',
  'ET->US': '#06b6d4',
  'NG->US': '#8b5cf6',
  'NG->GB': '#f59e0b',
  'IN->US': '#ec4899',
  'IN->CA': '#f97316',
};

const tooltipStyle = {
  background: '#1a2035',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '11px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  padding: '6px 10px',
};

export interface DashboardStats {
  scams: number;
  policies: number;
  flaggedAgencies: number;
  sharedPhones: number;
}

export default function Dashboard({ onStats, refreshKey = 0 }: { onStats?: (stats: DashboardStats) => void; refreshKey?: number }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dash, ag, ph] = await Promise.all([
        getDashboard(),
        getFlaggedAgencies(),
        getFlaggedPhones(),
      ]);
      setData(dash);
      onStats?.({
        scams: dash.total_scams_indexed,
        policies: dash.total_policies_indexed,
        flaggedAgencies: ag.agencies.length,
        sharedPhones: ph.phones.length,
      });
    } catch {
      // Allow partial failures
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [refreshKey]);

  const corridorChartData = data?.corridor_stats
    .reduce<Record<string, { corridor: string; reports: number; agencies: number }>>((acc, s) => {
      if (!acc[s.corridor]) acc[s.corridor] = { corridor: s.corridor, reports: 0, agencies: 0 };
      acc[s.corridor].reports += s.total_reports;
      acc[s.corridor].agencies = Math.max(acc[s.corridor].agencies, s.unique_agencies);
      return acc;
    }, {});

  const barData = corridorChartData ? Object.values(corridorChartData).sort((a, b) => b.reports - a.reports) : [];

  const trendData = data?.trending
    .reduce<Record<string, { month: string; reports: number }>>((acc, t) => {
      const m = t.month.slice(0, 7);
      if (!acc[m]) acc[m] = { month: m, reports: 0 };
      acc[m].reports += t.report_count;
      return acc;
    }, {});
  const areaData = trendData ? Object.values(trendData).sort((a, b) => a.month.localeCompare(b.month)) : [];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="h-[140px] bg-muted rounded-lg animate-pulse" />
        <div className="h-[140px] bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Charts row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Reports by Corridor</span>
            <Button onClick={fetchAll} variant="ghost" size="sm" className="h-5 w-5 p-0">
              <ArrowsClockwise size={10} weight="bold" />
            </Button>
          </div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={barData}>
                <XAxis dataKey="corridor" tick={{ fill: '#8b949e', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b949e', fontSize: 9 }} axisLine={false} tickLine={false} width={25} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="reports" radius={[3, 3, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={CORRIDOR_COLORS[entry.corridor] || '#71717a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[130px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
          )}
        </div>

        <div className="border rounded-lg p-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Report Trend</span>
          {areaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={areaData}>
                <XAxis dataKey="month" tick={{ fill: '#8b949e', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b949e', fontSize: 9 }} axisLine={false} tickLine={false} width={25} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(0,0,0,0.06)' }} />
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#00d4aa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="reports" stroke="#00d4aa" fill="url(#trendGrad)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[130px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
          )}
        </div>
      </div>

      {/* Flagged agencies + shared phones render in the FlaggedIntel section
          below this card — not repeated here. */}
    </div>
  );
}
