import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { Database, Warning, Phone, ArrowsClockwise, CircleNotch, Shield } from '@phosphor-icons/react';
import { getDashboard, getFlaggedAgencies, getFlaggedPhones, type DashboardData } from '../api';

const CORRIDOR_COLORS: Record<string, string> = {
  'ET->GB': '#10b981',
  'ET->US': '#06b6d4',
  'NG->US': '#8b5cf6',
  'NG->GB': '#f59e0b',
  'IN->US': '#ec4899',
  'IN->CA': '#f97316',
};

function StatCard({ label, value, icon, accentColor, index }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accentColor: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentColor}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </motion.div>
  );
}

const tooltipStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  color: 'var(--text-primary)',
  fontSize: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <CircleNotch size={28} className="animate-spin text-emerald-400" />
      </div>
    );
  }

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
          <h2 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            Threat Intelligence
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1.5">
            Real-time scam analytics powered by Elasticsearch
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors text-xs font-medium active:scale-[0.98]"
        >
          <ArrowsClockwise size={14} weight="bold" />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Scam Reports"
          value={data?.total_scams_indexed ?? 0}
          icon={<Database size={16} weight="bold" className="text-red-400" />}
          accentColor="bg-red-500/10"
          index={0}
        />
        <StatCard
          label="Policies Indexed"
          value={data?.total_policies_indexed ?? 0}
          icon={<Shield size={16} weight="bold" className="text-emerald-400" />}
          accentColor="bg-emerald-500/10"
          index={1}
        />
        <StatCard
          label="Flagged Agencies"
          value={agencies.length}
          icon={<Warning size={16} weight="bold" className="text-amber-400" />}
          accentColor="bg-amber-500/10"
          index={2}
        />
        <StatCard
          label="Shared Phones"
          value={phones.length}
          icon={<Phone size={16} weight="bold" className="text-violet-400" />}
          accentColor="bg-violet-500/10"
          index={3}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reports by corridor */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5"
        >
          <h3 className="text-xs font-medium text-[var(--text-muted)] mb-5 uppercase tracking-wider">
            Reports by Corridor
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <XAxis dataKey="corridor" tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="reports" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={CORRIDOR_COLORS[entry.corridor] || '#52525b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-[var(--text-muted)] text-sm">
              No data yet
            </div>
          )}
        </motion.div>

        {/* Trend over time */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5"
        >
          <h3 className="text-xs font-medium text-[var(--text-muted)] mb-5 uppercase tracking-wider">
            Report Trend
          </h3>
          {areaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={areaData}>
                <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 11, fontFamily: 'Geist Mono' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(255,255,255,0.06)' }} />
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="reports" stroke="#10b981" fill="url(#trendGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-[var(--text-muted)] text-sm">
              No data yet
            </div>
          )}
        </motion.div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flagged agencies */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5"
        >
          <h3 className="text-xs font-medium text-[var(--text-muted)] mb-4 uppercase tracking-wider">
            Flagged Agencies
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
                  <th className="text-left py-2.5 font-medium">Agency</th>
                  <th className="text-right py-2.5 font-medium">Reports</th>
                  <th className="text-right py-2.5 font-medium">Conf.</th>
                  <th className="text-right py-2.5 font-medium">Corridors</th>
                </tr>
              </thead>
              <tbody>
                {agencies.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-[var(--text-muted)] text-sm">
                      No flagged agencies yet
                    </td>
                  </tr>
                ) : agencies.map((a, i) => (
                  <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td className="py-3 text-[var(--text-primary)] text-sm">{String(a.agency_name || 'Unknown')}</td>
                    <td className="py-3 text-right text-orange-400 font-mono tabular-nums text-sm">{String(a.report_count || 0)}</td>
                    <td className="py-3 text-right text-[var(--text-secondary)] font-mono tabular-nums text-sm">{Number(a.avg_confidence || 0).toFixed(1)}</td>
                    <td className="py-3 text-right text-[var(--text-muted)] text-sm">{String(a.corridors || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Shared phone numbers */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5"
        >
          <h3 className="text-xs font-medium text-[var(--text-muted)] mb-4 uppercase tracking-wider">
            Shared Phone Numbers
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-muted)] text-[11px] uppercase tracking-wider">
                  <th className="text-left py-2.5 font-medium">Phone</th>
                  <th className="text-right py-2.5 font-medium">Agencies</th>
                  <th className="text-right py-2.5 font-medium">Posts</th>
                </tr>
              </thead>
              <tbody>
                {phones.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-10 text-[var(--text-muted)] text-sm">
                      No shared numbers detected
                    </td>
                  </tr>
                ) : phones.map((p, i) => (
                  <tr key={i} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td className="py-3 text-[var(--text-primary)] font-mono tabular-nums text-sm">{String(p.phone || 'N/A')}</td>
                    <td className="py-3 text-right text-violet-400 font-mono tabular-nums text-sm">{String(p.agency_count || 0)}</td>
                    <td className="py-3 text-right text-[var(--text-secondary)] font-mono tabular-nums text-sm">{String(p.post_count || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Policy changes */}
      {data && data.recent_policy_changes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5"
        >
          <h3 className="text-xs font-medium text-[var(--text-muted)] mb-4 uppercase tracking-wider">
            Recent Policy Changes
          </h3>
          <div className="space-y-2">
            {data.recent_policy_changes.map((change, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-emerald-400">{change.route}</span>
                  <span className="text-[var(--text-muted)] mx-2">-</span>
                  <span className="text-[var(--text-secondary)]">{change.diff_summary}</span>
                  <span className="text-[var(--text-muted)] text-xs ml-2">{change.snapshot_date}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
