import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { Database, Warning, Phone, ArrowsClockwise, Shield } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function StatCard({ label, value, icon, accentColor }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentColor}`}>
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-muted rounded-lg animate-pulse ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <SkeletonBlock className="h-7 w-48 mb-2" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
        <SkeletonBlock className="h-9 w-24" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-8 w-8" />
              </div>
              <SkeletonBlock className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <SkeletonBlock className="h-4 w-36 mb-5" />
              <SkeletonBlock className="h-60 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid rgba(0,0,0,0.06)',
  borderRadius: '10px',
  color: '#09090b',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [agencies, setAgencies] = useState<Record<string, unknown>[]>([]);
  const [phones, setPhones] = useState<Record<string, unknown>[]>([]);
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
      setAgencies(ag.agencies);
      setPhones(ph.phones);
    } catch {
      // Allow partial failures
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) return <DashboardSkeleton />;

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Threat Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Real-time scam analytics powered by Elasticsearch
          </p>
        </div>
        <Button onClick={fetchAll} variant="outline" size="sm">
          <ArrowsClockwise size={14} weight="bold" />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Scam reports"
          value={data?.total_scams_indexed ?? 0}
          icon={<Database size={16} weight="bold" className="text-red-600" />}
          accentColor="bg-red-100"
        />
        <StatCard
          label="Policies indexed"
          value={data?.total_policies_indexed ?? 0}
          icon={<Shield size={16} weight="bold" className="text-emerald-600" />}
          accentColor="bg-emerald-100"
        />
        <StatCard
          label="Flagged agencies"
          value={agencies.length}
          icon={<Warning size={16} weight="bold" className="text-amber-600" />}
          accentColor="bg-amber-100"
        />
        <StatCard
          label="Shared phones"
          value={phones.length}
          icon={<Phone size={16} weight="bold" className="text-violet-600" />}
          accentColor="bg-violet-100"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Reports by corridor</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData}>
                  <XAxis dataKey="corridor" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="reports" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={CORRIDOR_COLORS[entry.corridor] || '#71717a'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Report trend</CardTitle>
          </CardHeader>
          <CardContent>
            {areaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={areaData}>
                  <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(0,0,0,0.06)' }} />
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#18181b" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#18181b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="reports" stroke="#18181b" fill="url(#trendGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Flagged agencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs">
                    <th className="text-left py-2.5 font-medium">Agency</th>
                    <th className="text-right py-2.5 font-medium">Reports</th>
                    <th className="text-right py-2.5 font-medium">Conf.</th>
                    <th className="text-right py-2.5 font-medium">Corridors</th>
                  </tr>
                </thead>
                <tbody>
                  {agencies.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                        No flagged agencies yet
                      </td>
                    </tr>
                  ) : agencies.map((a, i) => (
                    <tr key={i} className="border-t hover:bg-muted/50 transition-colors">
                      <td className="py-3 text-sm">{String(a.agency_name || 'Unknown')}</td>
                      <td className="py-3 text-right text-orange-600 font-mono tabular-nums text-sm">{String(a.report_count || 0)}</td>
                      <td className="py-3 text-right text-muted-foreground font-mono tabular-nums text-sm">{Number(a.avg_confidence || 0).toFixed(1)}</td>
                      <td className="py-3 text-right text-muted-foreground text-sm">{String(a.corridors || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Shared phone numbers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs">
                    <th className="text-left py-2.5 font-medium">Phone</th>
                    <th className="text-right py-2.5 font-medium">Agencies</th>
                    <th className="text-right py-2.5 font-medium">Posts</th>
                  </tr>
                </thead>
                <tbody>
                  {phones.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-10 text-muted-foreground text-sm">
                        No shared numbers detected
                      </td>
                    </tr>
                  ) : phones.map((p, i) => (
                    <tr key={i} className="border-t hover:bg-muted/50 transition-colors">
                      <td className="py-3 font-mono tabular-nums text-sm">{String(p.phone || 'N/A')}</td>
                      <td className="py-3 text-right text-violet-600 font-mono tabular-nums text-sm">{String(p.agency_count || 0)}</td>
                      <td className="py-3 text-right text-muted-foreground font-mono tabular-nums text-sm">{String(p.post_count || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policy changes */}
      {data && data.recent_policy_changes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent policy changes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recent_policy_changes.map((change, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-emerald-700">{change.route}</span>
                    <span className="text-muted-foreground mx-2">-</span>
                    <span>{change.diff_summary}</span>
                    <span className="text-muted-foreground text-xs ml-2">{change.snapshot_date}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
