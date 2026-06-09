import { useState, useEffect } from 'react';
import { MagnifyingGlass, Warning, CircleNotch, FileText, Clock, CurrencyDollar, Link as LinkIcon } from '@phosphor-icons/react';

function BridgeIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="1" y="16" width="22" height="2.5" rx="1" fill="currentColor" />
      <rect x="5" y="6" width="2.5" height="10" rx="0.5" fill="currentColor" />
      <rect x="16.5" y="6" width="2.5" height="10" rx="0.5" fill="currentColor" />
      <rect x="4.5" y="5" width="3.5" height="1.5" rx="0.5" fill="currentColor" />
      <rect x="16" y="5" width="3.5" height="1.5" rx="0.5" fill="currentColor" />
      <path d="M1 8 Q6.25 14, 12 14 Q17.75 14, 23 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <line x1="8.5" y1="12.8" x2="8.5" y2="16" stroke="currentColor" strokeWidth="1" />
      <line x1="12" y1="14" x2="12" y2="16" stroke="currentColor" strokeWidth="1" />
      <line x1="15.5" y1="12.8" x2="15.5" y2="16" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
import Globe from './components/Globe';
import NewsTicker from './components/NewsTicker';
import Advisor from './components/Advisor';
import Inspector from './components/Inspector';
import Dashboard, { type DashboardStats } from './components/Dashboard';
import VisaOverview from './components/VisaOverview';
import Kibo from './components/Kibo';
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

/** Parse long requirement_text into structured sections */
function parseRequirementText(text: string): { summary: string; bullets: string[] } {
  if (!text) return { summary: '', bullets: [] };
  // Split on sentence boundaries or newlines
  const parts = text.split(/(?:\.\s+|\n+|;\s+)/).map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return { summary: text, bullets: [] };
  // First part is the summary, rest are bullets
  return { summary: parts[0] + '.', bullets: parts.slice(1).map(b => b.replace(/\.$/, '')) };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('destinations');
  const [nationality, setNationality] = useState(() => localStorage.getItem('co_nationality') || 'ET');
  const [selectedDest, setSelectedDest] = useState(() => localStorage.getItem('co_dest') || 'US');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<DashboardStats>({ scams: 0, policies: 0, flaggedAgencies: 0, sharedPhones: 0 });
  const [name] = useState(() => localStorage.getItem('co_name') || 'Traveler');

  const [visaData, setVisaData] = useState<VisaOverviewData | null>(null);
  const [visaLoading, setVisaLoading] = useState(true);

  const [detailReqs, setDetailReqs] = useState<PolicyResult[]>([]);
  const [detailPurpose, setDetailPurpose] = useState('student');
  const [detailLoading, setDetailLoading] = useState(false);

  // Persist selections
  useEffect(() => { localStorage.setItem('co_nationality', nationality); }, [nationality]);
  useEffect(() => { localStorage.setItem('co_dest', selectedDest); }, [selectedDest]);

  useEffect(() => {
    setVisaLoading(true);
    getVisaOverview(nationality)
      .then(setVisaData)
      .catch(() => {})
      .finally(() => setVisaLoading(false));
  }, [nationality]);

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

  const filteredDests = (visaData?.destinations || []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const m = DEST_DATA[d.code];
    return d.name.toLowerCase().includes(q) || (m?.region || '').toLowerCase().includes(q);
  });

  const natName = COUNTRIES.find(c => c.code === nationality)?.name || nationality;

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      {/* ── Header: logo + right-side info ── */}
      <header className="border-b shrink-0 z-50">
        <div className="mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BridgeIcon size={22} className="text-primary" />
            <span className="text-base font-bold tracking-tight text-foreground">Carryover</span>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center divide-x divide-border">
              {[
                { label: 'DESTINATIONS', value: visaData?.destinations.length ?? 0, color: 'text-primary' },
                { label: 'BLACKLISTED', value: stats.flaggedAgencies, color: 'text-red-400' },
                { label: 'REPORTS', value: stats.scams, color: 'text-amber-400' },
                { label: 'POLICIES', value: stats.policies, color: 'text-emerald-400' },
              ].map((s) => (
                <div key={s.label} className="px-3 py-1 text-center">
                  <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider">{s.label}</div>
                  <div className={`text-sm font-bold tabular-nums leading-tight ${s.color}`}>
                    {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                  </div>
                </div>
              ))}
            </div>
            <span className="text-[9px] text-muted-foreground font-mono hidden lg:inline">community-reported, updated daily</span>
          </div>
        </div>
      </header>

      {/* ── Greeting + Globe + Country Selectors ── */}
      <div className="border-b shrink-0">
        <div className="mx-auto px-5 py-3 flex items-center gap-6">
          {/* Globe */}
          <div className="shrink-0 hidden sm:block" style={{ width: 120, height: 120 }}>
            <Globe nationality={nationality} destination={selectedDest} />
          </div>

          {/* Greeting + selectors */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">
              Hello, {name}
              <span className="text-muted-foreground font-normal text-base ml-2">
                {countryFlag(nationality)}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              Honest visa intelligence for {natName} travelers. No paid placements.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              {/* From */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">From</span>
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-card px-3 text-sm outline-none appearance-none cursor-pointer"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{countryFlag(c.code)} {c.name}</option>
                  ))}
                </select>
              </div>

              <span className="text-muted-foreground text-lg">→</span>

              {/* To */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">To</span>
                <select
                  value={selectedDest}
                  onChange={(e) => setSelectedDest(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-card px-3 text-sm outline-none appearance-none cursor-pointer"
                >
                  {Object.entries(DESTINATIONS).map(([code, label]) => (
                    <option key={code} value={code}>{countryFlag(code)} {label}</option>
                  ))}
                </select>
              </div>

              {/* Purpose */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-muted-foreground uppercase">Purpose</span>
                <div className="flex gap-1">
                  {['student', 'work', 'family', 'tourist'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setDetailPurpose(p)}
                      className={`text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors capitalize ${
                        detailPurpose === p
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input bg-card hover:border-foreground/30'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Ticker ── */}
      <NewsTicker nationality={nationality} />

      {/* ── Tab nav ── */}
      <div className="border-b shrink-0">
        <div className="mx-auto px-5 flex items-center h-9">
          <nav className="flex items-center gap-8 h-full">
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
          </nav>
        </div>
      </div>

      {/* ── Main area: content + Kibo sidebar ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <main className="flex-1 min-w-0 overflow-hidden">
          {/* DESTINATIONS TAB */}
          {activeTab === 'destinations' && (
            <div className="h-full flex">
              {/* Left: search + country list */}
              <div className="w-[280px] border-r flex flex-col shrink-0">
                <div className="px-3 py-2 border-b">
                  <div className="flex items-center gap-2 h-7 rounded-lg border border-input bg-card px-2.5">
                    <MagnifyingGlass size={13} className="text-muted-foreground shrink-0" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search country..."
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
              <div className="flex-1 overflow-y-auto">
                {/* Country header */}
                <div className="border-b px-6 py-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{countryFlag(selectedDest)}</span>
                    <div>
                      <h2 className="text-xl font-bold">{destName}</h2>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {meta?.region || 'INTERNATIONAL'} · {meta?.visaTypes.map((v) => v.code).join(', ') || 'Various'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase">Acceptance</div>
                    <div className={`text-3xl font-bold tabular-nums ${
                      (selectedDestData?.score ?? 0) >= 65 ? 'text-emerald-400' :
                      (selectedDestData?.score ?? 0) >= 45 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {selectedDestData?.score ?? '—'}%
                    </div>
                  </div>
                </div>

                {/* Quick stats row */}
                <div className="grid grid-cols-4 divide-x divide-border border-b">
                  <div className="px-4 py-2.5">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase">Visa Fee</div>
                    <div className="text-base font-bold mt-0.5 tabular-nums">
                      {detailReqs[0]?.fee_usd ? `$${detailReqs[0].fee_usd}` : 'Varies'}
                    </div>
                  </div>
                  <div className="px-4 py-2.5">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase">Processing</div>
                    <div className="text-base font-bold mt-0.5 tabular-nums">
                      {detailReqs[0]?.processing_days ? `${detailReqs[0].processing_days} days` : 'Varies'}
                    </div>
                  </div>
                  <div className="px-4 py-2.5">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase">PR Timeline</div>
                    <div className="text-sm font-bold mt-0.5">
                      {meta?.prTimeline.split('(')[0].trim() || 'Varies'}
                    </div>
                  </div>
                  <div className="px-4 py-2.5">
                    <div className="text-[9px] font-mono text-muted-foreground uppercase">Scam Reports</div>
                    <div className="text-base font-bold mt-0.5 tabular-nums text-red-400">
                      {selectedDestData?.scam_reports ?? 0}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 space-y-5">
                  {/* ── Policy Requirements (structured) ── */}
                  <div>
                    <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">
                      Policy Requirements - {detailPurpose}
                    </h3>

                    {detailLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                        <CircleNotch size={14} className="animate-spin" /> Loading requirements...
                      </div>
                    ) : detailReqs.length > 0 ? (
                      <div className="space-y-3">
                        {detailReqs.map((req, i) => {
                          const parsed = parseRequirementText(req.requirement_text);
                          return (
                            <div key={i} className="border rounded-lg overflow-hidden">
                              {/* Requirement metadata bar */}
                              <div className="grid grid-cols-4 divide-x divide-border bg-card/50 border-b">
                                <div className="px-3 py-2 flex items-center gap-1.5">
                                  <CurrencyDollar size={13} className="text-primary shrink-0" />
                                  <div>
                                    <div className="text-[8px] font-mono text-muted-foreground uppercase">Fee</div>
                                    <div className="text-xs font-bold tabular-nums">{req.fee_usd ? `$${req.fee_usd}` : 'N/A'}</div>
                                  </div>
                                </div>
                                <div className="px-3 py-2 flex items-center gap-1.5">
                                  <Clock size={13} className="text-primary shrink-0" />
                                  <div>
                                    <div className="text-[8px] font-mono text-muted-foreground uppercase">Processing</div>
                                    <div className="text-xs font-bold tabular-nums">{req.processing_days ? `${req.processing_days} days` : 'N/A'}</div>
                                  </div>
                                </div>
                                <div className="px-3 py-2 flex items-center gap-1.5">
                                  <FileText size={13} className="text-primary shrink-0" />
                                  <div>
                                    <div className="text-[8px] font-mono text-muted-foreground uppercase">Documents</div>
                                    <div className="text-xs font-bold truncate max-w-[140px]">{req.documents_needed || 'See details'}</div>
                                  </div>
                                </div>
                                <div className="px-3 py-2 flex items-center gap-1.5">
                                  <LinkIcon size={13} className="text-primary shrink-0" />
                                  <div>
                                    <div className="text-[8px] font-mono text-muted-foreground uppercase">Source</div>
                                    {req.source_url ? (
                                      <a href={req.source_url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline truncate block max-w-[140px]">
                                        {req.source_name || 'Official'}
                                      </a>
                                    ) : (
                                      <div className="text-xs text-muted-foreground">{req.source_name || 'N/A'}</div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Requirement text - structured */}
                              <div className="p-4">
                                {parsed.summary && (
                                  <p className="text-sm leading-relaxed">{parsed.summary}</p>
                                )}
                                {parsed.bullets.length > 0 && (
                                  <ul className="mt-2 space-y-1">
                                    {parsed.bullets.map((b, j) => (
                                      <li key={j} className="text-xs text-muted-foreground flex items-start gap-2">
                                        <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                        <span>{b}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {req.last_updated && (
                                  <div className="mt-2 text-[10px] font-mono text-muted-foreground">
                                    Updated: {req.last_updated}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No requirements data for this route yet.</p>
                    )}
                  </div>

                  {/* Visa types */}
                  {meta?.visaTypes && (
                    <div>
                      <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">Visa Types</h3>
                      <div className="flex flex-wrap gap-2">
                        {meta.visaTypes.map((v) => (
                          <span key={v.code} className={`text-xs font-mono px-2.5 py-1 rounded border ${
                            v.type === 'immigrant'
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'border-border text-foreground'
                          }`}>
                            {v.code} <span className="text-muted-foreground">({v.type})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Economy + work */}
                  {meta && (
                    <div className="border rounded-lg overflow-hidden grid grid-cols-2 divide-x divide-border">
                      <div className="p-3">
                        <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-1">Economy</h3>
                        <p className="text-sm">{meta.economy}</p>
                      </div>
                      <div className="p-3">
                        <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-1">Work Opportunities</h3>
                        <p className="text-sm">{meta.workOpportunities}</p>
                      </div>
                    </div>
                  )}

                  {/* Top cities */}
                  {meta?.topCities && (
                    <div>
                      <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">
                        Top Cities · {countryFlag(nationality)} diaspora
                      </h3>
                      <div className="border rounded-lg overflow-hidden grid grid-cols-3 divide-x divide-border">
                        {meta.topCities.slice(0, 3).map((city) => (
                          <div key={city.name} className="p-3">
                            <span className="text-sm font-semibold">{city.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground block">{city.monthlyCost}/mo</span>
                            {city.diaspora[nationality] ? (
                              <span className="text-xs text-primary font-mono">
                                ~{city.diaspora[nationality]} {natName}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground font-mono">Small community</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {meta.topCities.length > 3 && (
                        <div className="border border-t-0 rounded-b-lg overflow-hidden grid grid-cols-3 divide-x divide-border">
                          {meta.topCities.slice(3).map((city) => (
                            <div key={city.name} className="p-3">
                              <span className="text-sm font-semibold">{city.name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground block">{city.monthlyCost}/mo</span>
                              {city.diaspora[nationality] ? (
                                <span className="text-xs text-primary font-mono">
                                  ~{city.diaspora[nationality]} {natName}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground font-mono">Small community</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Top schools (student) */}
                  {meta?.topSchools && detailPurpose === 'student' && (
                    <div>
                      <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">
                        Cheapest Tuition (International Students)
                      </h3>
                      <div className="border rounded-lg overflow-hidden divide-y divide-border">
                        {meta.topSchools.map((school) => (
                          <div key={school.name} className="px-4 py-2 flex items-center justify-between">
                            <span className="text-xs font-semibold">{school.name}</span>
                            <span className="text-xs font-mono text-primary tabular-nums">{school.annualTuition}/yr</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top earning fields */}
                  {meta?.topMajors && (
                    <div>
                      <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-2">Top Earning Fields</h3>
                      <div className="border rounded-lg overflow-hidden divide-y divide-border">
                        {meta.topMajors.map((m) => (
                          <div key={m.name} className="px-4 py-2 flex items-center justify-between">
                            <span className="text-xs font-mono">{m.name}</span>
                            <span className="text-xs font-mono text-emerald-400 tabular-nums">{m.avgSalary}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scams + real talk */}
                  <div className="border rounded-lg overflow-hidden divide-y divide-border">
                    {meta?.scams && (
                      <div className="p-4">
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
                    {meta?.realTalk && (
                      <div className="p-4 border-l-2 border-l-primary">
                        <h3 className="text-[10px] font-mono text-primary uppercase tracking-wider mb-1">Real Talk</h3>
                        <p className="text-sm italic leading-relaxed">{meta.realTalk}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AGENCY WATCH TAB */}
          {activeTab === 'agency' && (
            <div className="p-5 overflow-y-auto h-full space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <Inspector />
                </div>
                <div className="border rounded-lg p-4">
                  <Dashboard onStats={setStats} />
                </div>
              </div>
            </div>
          )}

          {/* VISA PATHWAYS TAB */}
          {activeTab === 'pathways' && (
            <div className="p-5 overflow-y-auto h-full">
              <div className="border rounded-lg p-6">
                <Advisor nationality={nationality} destination={selectedDest} />
              </div>
            </div>
          )}
        </main>

        {/* Kibo sidebar */}
        <aside className="w-[320px] border-l shrink-0 flex flex-col">
          <Kibo nationality={nationality} destination={selectedDest} purpose={detailPurpose} />
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t shrink-0">
        <div className="mx-auto px-5 h-7 flex items-center justify-center">
          <span className="text-[9px] font-mono text-muted-foreground">
            Carryover is independent. We accept no payments from agencies. Report scams: report@carryover.africa
          </span>
        </div>
      </footer>
    </div>
  );
}
