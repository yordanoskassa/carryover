import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { Database, AlertTriangle, Phone, TrendingUp, RefreshCw, Loader2, Shield } from 'lucide-react';
import { getDashboard, getFlaggedAgencies, getFlaggedPhones, type DashboardData } from '../api';

const CORRIDOR_COLORS: Record<string, string> = {
  'ET->GB': '#10b981',
  'ET->US': '#06b6d4',
  'NG->US': '#8b5cf6',
  'NG->GB': '#f59e0b',
  'IN->US': '#ec4899',
  'IN->CA': '#f97316',
};

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

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
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Threat Intelligence Dashboard</h2>
          <p className="text-gray-400 mt-1">Real-time scam analytics powered by Elasticsearch ES|QL</p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 hover:text-white transition text-sm"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Scam Reports Indexed"
          value={data?.total_scams_indexed ?? 0}
          icon={<Database size={16} className="text-white" />}
          color="bg-red-600/20"
        />
        <StatCard
          label="Visa Policies Indexed"
          value={data?.total_policies_indexed ?? 0}
          icon={<Shield size={16} className="text-white" />}
          color="bg-emerald-600/20"
        />
        <StatCard
          label="Flagged Agencies"
          value={agencies.length}
          icon={<AlertTriangle size={16} className="text-white" />}
          color="bg-orange-600/20"
        />
        <StatCard
          label="Shared Phone Numbers"
          value={phones.length}
          icon={<Phone size={16} className="text-white" />}
          color="bg-purple-600/20"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reports by corridor */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className="text-orange-400" />
            Reports by Corridor
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <XAxis dataKey="corridor" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }}
                />
                <Bar dataKey="reports" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={CORRIDOR_COLORS[entry.corridor] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-600">No data yet</div>
          )}
        </div>

        {/* Trend over time */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-cyan-400" />
            Report Trend Over Time
          </h3>
          {areaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={areaData}>
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb' }}
                />
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="reports" stroke="#06b6d4" fill="url(#grad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-600">No data yet</div>
          )}
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flagged agencies */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            Flagged Agencies
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase">
                  <th className="text-left py-2">Agency</th>
                  <th className="text-right py-2">Reports</th>
                  <th className="text-right py-2">Confidence</th>
                  <th className="text-right py-2">Corridors</th>
                </tr>
              </thead>
              <tbody>
                {agencies.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-gray-600">No flagged agencies yet</td></tr>
                ) : agencies.map((a, i) => (
                  <tr key={i} className="border-t border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-2 text-gray-200">{String(a.agency_name || 'Unknown')}</td>
                    <td className="py-2 text-right text-orange-400 font-mono">{String(a.report_count || 0)}</td>
                    <td className="py-2 text-right text-gray-400 font-mono">{Number(a.avg_confidence || 0).toFixed(1)}</td>
                    <td className="py-2 text-right text-gray-500">{String(a.corridors || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shared phone numbers */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Phone size={14} className="text-purple-400" />
            Shared Phone Numbers (Identity Reuse)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase">
                  <th className="text-left py-2">Phone</th>
                  <th className="text-right py-2">Agencies</th>
                  <th className="text-right py-2">Posts</th>
                </tr>
              </thead>
              <tbody>
                {phones.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-6 text-gray-600">No shared numbers detected</td></tr>
                ) : phones.map((p, i) => (
                  <tr key={i} className="border-t border-gray-800/50 hover:bg-gray-800/20">
                    <td className="py-2 text-gray-200 font-mono">{String(p.phone || 'N/A')}</td>
                    <td className="py-2 text-right text-purple-400 font-mono">{String(p.agency_count || 0)}</td>
                    <td className="py-2 text-right text-gray-400 font-mono">{String(p.post_count || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Policy changes */}
      {data && data.recent_policy_changes.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <RefreshCw size={14} className="text-cyan-400" />
            Recent Policy Changes (Watchtower)
          </h3>
          <div className="space-y-2">
            {data.recent_policy_changes.map((change, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-cyan-900/10 border border-cyan-900/30 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-cyan-300">{change.route}</span>
                  <span className="text-gray-400 mx-2">—</span>
                  <span className="text-gray-300">{change.diff_summary}</span>
                  <span className="text-gray-600 text-xs ml-2">{change.snapshot_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
