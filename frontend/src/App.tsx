import { useState, useEffect } from 'react';
import { MagnifyingGlass, Warning, CircleNotch } from '@phosphor-icons/react';
import { Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Globe from './components/Globe';
import NewsTicker from './components/NewsTicker';
import Advisor from './components/Advisor';
import Inspector from './components/Inspector';
import Dashboard, { type DashboardStats } from './components/Dashboard';
import VisaOverview from './components/VisaOverview';
import { getVisaOverview, getRequirements, getDashboard, getFlaggedAgencies, getFlaggedPhones, type VisaOverviewData, type PolicyResult } from './api';
import { DEST_DATA } from './data/destinations';
import './index.css';

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

const COUNTRIES = [
  { code: 'ET', name: 'Ethiopia' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'IN', name: 'India' },
  { code: 'NP', name: 'Nepal' },
  { code: 'PH', name: 'Philippines' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'KE', name: 'Kenya' },
  { code: 'GH', name: 'Ghana' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'EG', name: 'Egypt' },
];

const DESTINATIONS: Record<string, string> = {
  GB: 'United Kingdom', US: 'United States', CA: 'Canada', DE: 'Germany',
  AU: 'Australia', FR: 'France', NL: 'Netherlands', SE: 'Sweden',
};

type Tab = 'destinations' | 'agency' | 'pathways';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('destinations');
  const [nationality, setNationality] = useState('ET');
  const [selectedDest, setSelectedDest] = useState('US');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<DashboardStats>({ scams: 0, policies: 0, flaggedAgencies: 0, sharedPhones: 0 });

  // Visa overview data (destinations list)
  const [visaData, setVisaData] = useState<VisaOverviewData | null>(null);
  const [visaLoading, setVisaLoading] = useState(true);

  // Detail panel: auto-fetched requirements
  const [detailReqs, setDetailReqs] = useState<PolicyResult[]>([]);
  const [detailPurpose, setDetailPurpose] = useState('student');
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch visa overview when nationality changes
  useEffect(() => {
    setVisaLoading(true);
    getVisaOverview(nationality)
      .then(setVisaData)
      .catch(() => {})
      .finally(() => setVisaLoading(false));
  }, [nationality]);

  // Fetch stats on mount
  useEffect(() => {
    Promise.all([getDashboard(), getFlaggedAgencies(), getFlaggedPhones()])
      .then(([dash, ag, ph]) => {
        setStats({
          scams: dash.total_scams_indexed,
          policies: dash.total_policies_indexed,
          flaggedAgencies: ag.agencies.length,
          sharedPhones: ph.phones.length,
        });
      })
      .catch(() => {});
  }, []);

  // Auto-fetch requirements when dest/nationality/purpose changes
  useEffect(() => {
    setDetailLoading(true);
    getRequirements(nationality, selectedDest, detailPurpose)
      .then((data) => setDetailReqs(data.requirements))
      .catch(() => setDetailReqs([]))
      .finally(() => setDetailLoading(false));
  }, [nationality, selectedDest, detailPurpose]);

  const selectedDestData = visaData?.destinations.find((d) => d.code === selectedDest);
  const meta = DEST_DATA[selectedDest];
  const destName = DESTINATIONS[selectedDest] || selectedDest;

  // Filter destinations by search
  const filteredDests = (visaData?.destinations || []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const m = DEST_DATA[d.code];
    return d.name.toLowerCase().includes(q) || (m?.region || '').toLowerCase().includes(q);
  });

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="border-b shrink-0 z-50">
        <div className="max-w-[1600px] mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Route size={20} className="text-primary" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">
                <span className="text-primary">Carry</span>over
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono hidden md:inline ml-2">
              HONEST TRAVEL INTEL · NO PAID PLACEMENTS · BUILT FOR AFRICA
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 shrink-0 hidden sm:block">
              <Globe nationality={nationality} destination={selectedDest} />
            </div>
            <span className="text-[10px] text-primary font-mono hidden lg:inline">
              ● community-reported · updated daily
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-base">{countryFlag(nationality)}</span>
              <select
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                className="h-7 rounded border border-input bg-transparent px-2 text-xs outline-none appearance-none cursor-pointer"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <Button variant="secondary" size="xs">EN</Button>
            <Button variant="ghost" size="xs" className="text-muted-foreground">amh</Button>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <NewsTicker nationality={nationality} />

      {/* Tab nav */}
      <nav className="border-b shrink-0">
        <div className="max-w-[1600px] mx-auto px-5 flex items-center gap-8 h-10">
          {([
            ['destinations', 'DESTINATIONS'],
            ['agency', 'BAD AGENCY WATCH'],
            ['pathways', 'VISA PATHWAYS'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-mono uppercase tracking-wider h-full border-b-2 transition-colors ${
                activeTab === tab
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Stats row */}
      <div className="border-b shrink-0">
        <div className="max-w-[1600px] mx-auto px-5 py-3 grid grid-cols-4 gap-4">
          {[
            { label: 'DESTINATIONS COVERED', value: visaData?.destinations.length ?? 0, color: 'text-primary' },
            { label: 'AGENCIES BLACKLISTED', value: stats.flaggedAgencies, color: 'text-red-400' },
            { label: 'COMMUNITY REPORTS', value: stats.scams, color: 'text-amber-400' },
            { label: 'POLICIES TRACKED', value: stats.policies, color: 'text-emerald-400' },
          ].map((s) => (
            <div key={s.label} className="bg-card border rounded-lg px-4 py-3">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">{s.label}</span>
              <div className={`text-2xl font-bold tabular-nums mt-1 ${s.color}`}>
                {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {/* ─── DESTINATIONS TAB ─── */}
        {activeTab === 'destinations' && (
          <div className="max-w-[1600px] mx-auto h-full flex">
            {/* Left: search + country list */}
            <div className="w-[360px] border-r flex flex-col shrink-0">
              <div className="px-3 py-2.5 border-b">
                <div className="flex items-center gap-2 h-8 rounded-lg border border-input bg-card px-3">
                  <MagnifyingGlass size={14} className="text-muted-foreground shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for a country or region..."
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <VisaOverview
                  destinations={filteredDests}
                  selected={selectedDest}
                  onSelect={setSelectedDest}
                  loading={visaLoading}
                />
              </div>
            </div>

            {/* Right: detail panel */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Country header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-5xl">{countryFlag(selectedDest)}</span>
                  <div>
                    <h2 className="text-2xl font-bold">{destName}</h2>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {meta?.region || 'INTERNATIONAL'} · {meta?.visaTypes.map((v) => v.code).join(', ') || 'Various'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Acceptance for African Applicants</span>
                  <div className={`text-4xl font-bold tabular-nums ${
                    (selectedDestData?.score ?? 0) >= 65 ? 'text-emerald-400' :
                    (selectedDestData?.score ?? 0) >= 45 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {selectedDestData?.score ?? '—'}%
                  </div>
                </div>
              </div>

              {/* Key stats grid */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-card border rounded-lg p-3">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Visa Fee</span>
                  <div className="text-lg font-bold mt-1 tabular-nums">
                    {detailReqs[0]?.fee_usd ? `$${detailReqs[0].fee_usd}` : 'Varies'}
                  </div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Processing</span>
                  <div className="text-lg font-bold mt-1 tabular-nums">
                    {detailReqs[0]?.processing_days ? `${detailReqs[0].processing_days} days` : 'Varies'}
                  </div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">PR Timeline</span>
                  <div className="text-sm font-bold mt-1">
                    {meta?.prTimeline.split('(')[0].trim() || 'Varies'}
                  </div>
                </div>
                <div className="bg-card border rounded-lg p-3">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Scam Reports</span>
                  <div className="text-lg font-bold mt-1 tabular-nums text-red-400">
                    {selectedDestData?.scam_reports ?? 0}
                  </div>
                </div>
              </div>

              {/* Visa types */}
              {meta?.visaTypes && (
                <div className="mb-6">
                  <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">Visa Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {meta.visaTypes.map((v) => (
                      <span key={v.code} className={`text-xs font-mono px-2.5 py-1 rounded border ${
                        v.type === 'immigrant'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-border bg-card text-foreground'
                      }`}>
                        {v.code} <span className="text-muted-foreground">({v.type})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Economy + work */}
              {meta && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-card border rounded-lg p-4">
                    <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">Economy</h3>
                    <p className="text-sm">{meta.economy}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-4">
                    <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">Work Opportunities</h3>
                    <p className="text-sm">{meta.workOpportunities}</p>
                  </div>
                </div>
              )}

              {/* Top cities + diaspora */}
              {meta?.topCities && (
                <div className="mb-6">
                  <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">
                    Top Cities · {countryFlag(nationality)} diaspora
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {meta.topCities.map((city) => (
                      <div key={city.name} className="bg-card border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">{city.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{city.monthlyCost}/mo</span>
                        </div>
                        {city.diaspora[nationality] && (
                          <span className="text-xs text-primary font-mono">
                            ~{city.diaspora[nationality]} {COUNTRIES.find((c) => c.code === nationality)?.name || nationality} community
                          </span>
                        )}
                        {!city.diaspora[nationality] && (
                          <span className="text-xs text-muted-foreground font-mono">Small community</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Purpose selector + requirements */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider">Requirements for:</h3>
                  {['student', 'work', 'family', 'tourist'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setDetailPurpose(p)}
                      className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors capitalize ${
                        detailPurpose === p
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input hover:border-foreground/30'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {detailLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                    <CircleNotch size={14} className="animate-spin" /> Loading requirements...
                  </div>
                ) : detailReqs.length > 0 ? (
                  <div className="space-y-2">
                    {detailReqs.map((req, i) => (
                      <div key={i} className="bg-card border rounded-lg p-4">
                        <p className="text-sm leading-relaxed">{req.requirement_text}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {req.fee_usd && <span className="font-mono">${req.fee_usd}</span>}
                          {req.processing_days && <span className="font-mono">{req.processing_days} days</span>}
                          {req.documents_needed && <span>{req.documents_needed}</span>}
                          {req.source_url && (
                            <a href={req.source_url} target="_blank" rel="noopener" className="text-primary hover:underline">
                              {req.source_name || 'Source'}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No requirements data available for this route yet.</p>
                )}
              </div>

              {/* Top schools (show when student purpose) */}
              {meta?.topSchools && detailPurpose === 'student' && (
                <div className="mb-6">
                  <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">
                    Cheapest Tuition (International Students)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {meta.topSchools.map((school) => (
                      <div key={school.name} className="bg-card border rounded-lg p-3 flex items-center justify-between">
                        <span className="text-xs font-semibold">{school.name}</span>
                        <span className="text-xs font-mono text-primary tabular-nums">{school.annualTuition}/yr</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top earning majors */}
              {meta?.topMajors && (
                <div className="mb-6">
                  <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">Top Earning Fields</h3>
                  <div className="flex flex-wrap gap-2">
                    {meta.topMajors.map((m) => (
                      <span key={m.name} className="text-xs bg-card border rounded-lg px-3 py-1.5 font-mono">
                        {m.name} <span className="text-emerald-400">{m.avgSalary}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Common scams */}
              {meta?.scams && (
                <div className="mb-6">
                  <h3 className="text-[10px] font-mono text-red-400 uppercase tracking-wider mb-2">Common Scams to Avoid</h3>
                  <div className="space-y-1.5">
                    {meta.scams.map((scam, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Warning size={14} weight="bold" className="text-amber-400 mt-0.5 shrink-0" />
                        <span className="text-sm">{scam}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Real talk */}
              {meta?.realTalk && (
                <div className="border-l-2 border-primary pl-4 mb-6">
                  <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-1">Real Talk</h3>
                  <p className="text-sm italic leading-relaxed">{meta.realTalk}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── AGENCY WATCH TAB ─── */}
        {activeTab === 'agency' && (
          <div className="max-w-[1600px] mx-auto p-5 overflow-y-auto h-full space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card border rounded-lg p-4">
                <Inspector />
              </div>
              <div className="bg-card border rounded-lg p-4">
                <Dashboard onStats={setStats} />
              </div>
            </div>
          </div>
        )}

        {/* ─── VISA PATHWAYS TAB ─── */}
        {activeTab === 'pathways' && (
          <div className="max-w-[1600px] mx-auto p-5 overflow-y-auto h-full">
            <div className="bg-card border rounded-lg p-6">
              <Advisor nationality={nationality} destination={selectedDest} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t shrink-0">
        <div className="max-w-[1600px] mx-auto px-5 h-8 flex items-center justify-center">
          <span className="text-[10px] font-mono text-muted-foreground">
            Carryover is independent. We accept no payments from agencies. Report scams: report@carryover.africa
          </span>
        </div>
      </footer>
    </div>
  );
}
