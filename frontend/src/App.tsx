import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlass, Warning, GraduationCap, Briefcase, UsersThree, AirplaneTilt, Sparkle, PaperPlaneRight, CircleNotch, CaretDown, Database, FileText, Detective, Megaphone } from '@phosphor-icons/react';

// Official Elastic mark (multicolor) — header co-branding.
function ElasticIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-label="Elastic">
      <path d="M32 16.77c0-2.678-1.664-5.03-4.166-5.937a9.14 9.14 0 0 0 .162-1.718c0-5-4.057-9.048-9.035-9.048-2.92 0-5.626 1.393-7.33 3.746a4.78 4.78 0 0 0-2.935-1c-2.65 0-4.8 2.15-4.8 4.8 0 .582.108 1.15.298 1.677A6.36 6.36 0 0 0 0 15.243a6.31 6.31 0 0 0 4.179 5.951 9.02 9.02 0 0 0-.162 1.718 9.03 9.03 0 0 0 9.021 9.021c2.92 0 5.626-1.407 7.317-3.76.84.663 1.866 1.028 2.935 1.028 2.65 0 4.8-2.15 4.8-4.8 0-.582-.108-1.15-.298-1.677A6.37 6.37 0 0 0 32 16.771" fill="#fff"/>
      <path d="M12.578 13.795l7.006 3.192 7.06-6.194a7.4 7.4 0 0 0 .149-1.555 7.91 7.91 0 0 0-7.899-7.899 7.89 7.89 0 0 0-6.505 3.435l-1.177 6.1z" fill="#fed10a"/>
      <path d="M5.33 21.207a7.66 7.66 0 0 0-.15 1.582c0 4.37 3.557 7.912 7.926 7.912a7.92 7.92 0 0 0 6.546-3.462l1.163-6.073-1.555-2.975-7.033-3.205z" fill="#24bbb1"/>
      <path d="M5.288 9.09l4.8 1.136 1.055-5.45c-.65-.5-1.46-.77-2.3-.77A3.79 3.79 0 0 0 5.058 7.79c0 .446.08.893.23 1.298" fill="#ef5098"/>
      <path d="M4.87 10.238c-2.137.703-3.638 2.76-3.638 5.018 0 2.205 1.366 4.166 3.408 4.95l6.735-6.086-1.23-2.637z" fill="#17a8e0"/>
      <path d="M20.87 27.24a3.8 3.8 0 0 0 2.286.784 3.79 3.79 0 0 0 3.787-3.787 3.82 3.82 0 0 0-.23-1.312l-4.788-1.123z" fill="#93c83e"/>
      <path d="M21.843 20.544l5.275 1.23a5.33 5.33 0 0 0 3.638-5.031 5.29 5.29 0 0 0-3.408-4.937l-6.898 6.046z" fill="#0779a1"/>
    </svg>
  );
}

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
import Inspector from './components/Inspector';
import Reporter from './components/Reporter';
import FlaggedIntel from './components/FlaggedIntel';
import Dashboard, { type DashboardStats } from './components/Dashboard';
import VisaOverview from './components/VisaOverview';
import Kibo, { type KiboHandle } from './components/Kibo';
import AgencyInvestigation from './components/AgencyInvestigation';
import PolicyCard from './components/PolicyCard';
import ElasticData from './components/ElasticData';
import { getVisaOverview, getStructuredPolicy, getDashboard, getFlaggedAgencies, getFlaggedPhones, type VisaOverviewData, type StructuredPolicy, type ScanAgencyResponse } from './api';
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
  IE: 'Ireland', NO: 'Norway', FI: 'Finland', CH: 'Switzerland',
  ES: 'Spain', IT: 'Italy', NZ: 'New Zealand', SG: 'Singapore',
  JP: 'Japan', KR: 'South Korea', AT: 'Austria', BE: 'Belgium',
  CZ: 'Czechia', GR: 'Greece', PT: 'Portugal', PL: 'Poland',
  AE: 'United Arab Emirates', SA: 'Saudi Arabia', QA: 'Qatar',
  TR: 'Turkey', ZA: 'South Africa',
};

const PURPOSE_META: Record<string, { icon: typeof GraduationCap; label: string }> = {
  student: { icon: GraduationCap, label: 'Student' },
  work: { icon: Briefcase, label: 'Work' },
  family: { icon: UsersThree, label: 'Family' },
  tourist: { icon: AirplaneTilt, label: 'Tourist' },
};

type Tab = 'destinations' | 'agency' | 'reporter' | 'elastic';

// The three specialists, as the user sees them: each main tab IS an agent.
// Colors match the agent cards in the Kibo chat (Advisor blue, Inspector red,
// Reporter amber).
const AGENT_TABS: { tab: Tab; label: string; Icon: typeof FileText; active: string; dot: string }[] = [
  { tab: 'destinations', label: 'Advisor', Icon: FileText, active: 'text-blue-400 border-blue-400', dot: 'bg-blue-400' },
  { tab: 'agency', label: 'Inspector', Icon: Detective, active: 'text-red-400 border-red-400', dot: 'bg-red-400' },
  { tab: 'reporter', label: 'Reporter', Icon: Megaphone, active: 'text-amber-400 border-amber-400', dot: 'bg-amber-400' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('destinations');
  const [nationality, setNationality] = useState(() => localStorage.getItem('co_nationality') || 'ET');
  const [selectedDest, setSelectedDest] = useState(() => localStorage.getItem('co_dest') || 'US');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<DashboardStats>({ scams: 0, policies: 0, flaggedAgencies: 0, sharedPhones: 0 });
  const [name] = useState(() => localStorage.getItem('co_name') || 'Traveler');

  const [visaData, setVisaData] = useState<VisaOverviewData | null>(null);
  const [visaLoading, setVisaLoading] = useState(true);

  const [policy, setPolicy] = useState<StructuredPolicy | null>(null);
  const [detailPurpose, setDetailPurpose] = useState('student');
  const [detailLoading, setDetailLoading] = useState(false);

  // Kibo-driven agency investigation pushed into the dashboard panel.
  const [investigation, setInvestigation] = useState<ScanAgencyResponse | null>(null);
  const [dashRefresh, setDashRefresh] = useState(0);

  // Kibo command bar (floating, bottom-center) — the sidebar is output-only.
  const kiboRef = useRef<KiboHandle>(null);
  const [kiboInput, setKiboInput] = useState('');
  const [kiboBusy, setKiboBusy] = useState(false);
  const [kiboStarted, setKiboStarted] = useState(false);
  const [mobileKiboOpen, setMobileKiboOpen] = useState(false);

  const askKibo = (q?: string) => {
    const question = (q ?? kiboInput).trim();
    if (!question || kiboBusy) return;
    setKiboStarted(true);
    setMobileKiboOpen(true);
    setKiboInput('');
    // Defer one tick so the sidebar (and Kibo's ref) mounts on first prompt.
    setTimeout(() => kiboRef.current?.ask(question), 50);
  };

  const handleInvestigation = (data: ScanAgencyResponse) => {
    setInvestigation(data);
    setActiveTab('agency');
    setDashRefresh((k) => k + 1); // scan indexed new posts → re-pull dashboard
  };

  // Kibo noticed the question switched corridors ("what about the US?") or
  // purpose ("how about a work visa") — the dashboard follows. Only apply
  // values the UI actually knows.
  const handleContextChange = (ctx: { nationality: string; destination: string; purpose?: string }) => {
    if (DESTINATIONS[ctx.destination]) setSelectedDest(ctx.destination);
    if (COUNTRIES.some((c) => c.code === ctx.nationality)) setNationality(ctx.nationality);
    if (ctx.purpose && ['student', 'work', 'family', 'tourist'].includes(ctx.purpose)) {
      setDetailPurpose(ctx.purpose);
    }
  };

  // Kibo's routing drives the main view: an Inspector question lands on the
  // Inspector tab, an Advisor question on the Advisor tab.
  const handleAgentRoute = (agents: string[]) => {
    if (agents.includes('inspector')) setActiveTab('agency');
    else if (agents.includes('advisor')) setActiveTab('destinations');
  };

  useEffect(() => { localStorage.setItem('co_nationality', nationality); }, [nationality]);
  useEffect(() => { localStorage.setItem('co_dest', selectedDest); }, [selectedDest]);

  useEffect(() => {
    setVisaLoading(true);
    getVisaOverview(nationality, detailPurpose)
      .then(setVisaData)
      .catch(() => {})
      .finally(() => setVisaLoading(false));
  }, [nationality, detailPurpose]);

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
    setPolicy(null);
    getStructuredPolicy(nationality, selectedDest, detailPurpose)
      .then((data) => setPolicy(data))
      .catch(() => setPolicy(null))
      .finally(() => setDetailLoading(false));
  }, [nationality, selectedDest, detailPurpose]);

  const selectedDestData = visaData?.destinations.find((d) => d.code === selectedDest);
  const meta = DEST_DATA[selectedDest];
  const destName = DESTINATIONS[selectedDest] || selectedDest;
  const natName = COUNTRIES.find(c => c.code === nationality)?.name || nationality;

  const filteredDests = (visaData?.destinations || []).filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const m = DEST_DATA[d.code];
    return d.name.toLowerCase().includes(q) || (m?.region || '').toLowerCase().includes(q);
  });

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden relative">
      {/* ── Header ── */}
      <header className="border-b shrink-0 z-50">
        <div className="mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BridgeIcon size={27} className="text-primary" />
            <span className="text-lg font-bold tracking-tight text-foreground">Carryover</span>
            <span className="hidden sm:flex items-center gap-1.5 pl-3 ml-0.5 border-l border-border">
              <span className="text-[11px] text-muted-foreground">powered by</span>
              <ElasticIcon size={17} />
              <span className="text-sm font-semibold text-foreground">Elastic</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-muted-foreground font-mono hidden lg:inline">
              community-reported, updated daily
            </span>
            <button
              onClick={() => setActiveTab(activeTab === 'elastic' ? 'destinations' : 'elastic')}
              title="Behind the scenes: everything indexed in Elasticsearch"
              className={`flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded-md border transition-colors ${
                activeTab === 'elastic'
                  ? 'border-primary/50 text-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-ring'
              }`}
            >
              <Database size={12} weight="bold" />
              Elastic Data
            </button>
          </div>
        </div>
      </header>

      {/* ── Ticker ── */}
      <NewsTicker nationality={nationality} />

      {/* ── Body: left content + Kibo full-height right ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left: everything */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* ── Hero grid: Globe | Greeting+Selectors / Purpose tabs ── */}
          <div className="border-b shrink-0">
            <div className="grid grid-cols-1 lg:grid-cols-[152px_1fr] lg:divide-x divide-border">
              {/* Globe cell - spans 2 rows (hidden on mobile to save space) */}
              <div className="hidden lg:flex row-span-2 items-center justify-center bg-card/30 p-2">
                <Globe nationality={nationality} destination={selectedDest} />
              </div>

              {/* Greeting + inline origin picker + destination */}
              <div className="px-4 lg:px-5 py-3 border-b">
                <div className="flex flex-wrap items-center justify-between gap-y-2">
                  <div>
                    <h1 className="text-2xl font-bold leading-tight">
                      Hello, {name} {countryFlag(nationality)}
                    </h1>
                    <p className="text-[15px] text-muted-foreground mt-0.5">
                      Visa intelligence for{' '}
                      <span className="relative inline-flex items-center">
                        <select
                          value={nationality}
                          onChange={(e) => setNationality(e.target.value)}
                          aria-label="Your country of origin"
                          className="appearance-none bg-transparent text-primary font-semibold cursor-pointer outline-none border-b border-dashed border-primary/50 hover:border-primary pr-4 transition-colors"
                        >
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </select>
                        <CaretDown size={10} weight="bold" className="absolute right-0 text-primary pointer-events-none" />
                      </span>{' '}
                      travelers
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold text-muted-foreground uppercase">Destination</span>
                    <select
                      value={selectedDest}
                      onChange={(e) => setSelectedDest(e.target.value)}
                      className="h-8 rounded-md border border-input bg-card px-2.5 text-sm outline-none appearance-none cursor-pointer hover:border-ring transition-colors"
                    >
                      {Object.entries(DESTINATIONS).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Purpose toggle — flat divided cells with active underline */}
              <div className="grid grid-cols-4 divide-x divide-border">
                {Object.entries(PURPOSE_META).map(([key, { icon: Icon, label }]) => (
                  <button
                    key={key}
                    onClick={() => setDetailPurpose(key)}
                    className={`flex items-center justify-center gap-1.5 py-3 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                      detailPurpose === key
                        ? 'bg-primary/10 text-primary font-semibold border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-card/40'
                    }`}
                  >
                    <Icon size={14} weight={detailPurpose === key ? 'fill' : 'regular'} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Tab nav + stats ── */}
          <div className="border-b shrink-0">
            <div className="mx-auto px-3 lg:px-5 flex items-center h-10 justify-between gap-3">
              <nav className="flex items-center gap-4 lg:gap-6 h-full overflow-x-auto no-scrollbar shrink min-w-0">
                {AGENT_TABS.map(({ tab, label, Icon, active, dot }) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider h-full border-b-2 transition-colors ${
                      activeTab === tab
                        ? `${active} font-semibold`
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dot} ${activeTab === tab ? '' : 'opacity-40'}`} />
                    <Icon size={14} weight={activeTab === tab ? 'fill' : 'regular'} />
                    {label}
                  </button>
                ))}
                <span className="hidden xl:inline text-[11px] text-muted-foreground normal-case font-sans shrink-0">
                  three agents, one orchestrator
                </span>
              </nav>

              <div className="hidden md:flex items-center divide-x divide-border shrink-0">
                {[
                  { label: 'INDEXED', value: visaData?.destinations.length ?? 0, color: 'text-primary' },
                  { label: 'FLAGGED', value: stats.flaggedAgencies, color: 'text-red-400' },
                  { label: 'REPORTS', value: stats.scams, color: 'text-amber-400' },
                  { label: 'POLICIES', value: stats.policies, color: 'text-emerald-400' },
                ].map((s) => (
                  <div key={s.label} className="px-3 text-center">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{s.label}</div>
                    <div className={`text-sm font-bold tabular-nums leading-tight ${s.color}`}>
                      {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Tab content ── */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {/* DESTINATIONS */}
            {activeTab === 'destinations' && (
              <div className="h-full flex">
                {/* Country list (hidden on mobile — use the Destination dropdown) */}
                <div className="hidden lg:flex w-[240px] border-r flex-col shrink-0">
                  <div className="px-2 py-1.5 border-b">
                    <div className="flex items-center gap-1.5 h-7 rounded border border-input bg-card px-2">
                      <MagnifyingGlass size={12} className="text-muted-foreground shrink-0" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
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

                {/* Detail panel */}
                <div className="flex-1 overflow-y-auto pb-28">
                  {/* Country header + acceptance */}
                  <div className="border-b px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{countryFlag(selectedDest)}</span>
                      <div>
                        <h2 className="text-xl font-bold leading-tight">{destName}</h2>
                        <p className="text-xs font-mono text-muted-foreground">
                          {meta?.region || 'INTERNATIONAL'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-mono text-muted-foreground uppercase">Acceptance</div>
                      <div className={`text-3xl font-bold tabular-nums ${
                        (selectedDestData?.score ?? 0) >= 65 ? 'text-emerald-400' :
                        (selectedDestData?.score ?? 0) >= 45 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {selectedDestData?.score ?? '—'}%
                      </div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border border-b">
                    <div className="px-4 py-2.5">
                      <div className="text-[11px] font-mono text-muted-foreground uppercase">Fee</div>
                      <div className="text-base font-bold tabular-nums">
                        {policy?.fee || 'Varies'}
                      </div>
                    </div>
                    <div className="px-4 py-2.5">
                      <div className="text-[11px] font-mono text-muted-foreground uppercase">Processing</div>
                      <div className="text-base font-bold">
                        {policy?.processing_time || 'Varies'}
                      </div>
                    </div>
                    <div className="px-4 py-2.5">
                      <div className="text-[11px] font-mono text-muted-foreground uppercase">PR Timeline</div>
                      <div className="text-sm font-bold">{meta?.prTimeline.split('(')[0].trim() || 'Varies'}</div>
                    </div>
                    <div className="px-4 py-2.5">
                      <div className="text-[11px] font-mono text-muted-foreground uppercase">Scam Reports</div>
                      <div className="text-base font-bold tabular-nums text-red-400">{selectedDestData?.scam_reports ?? 0}</div>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-5">
                    {/* Requirements (structured) */}
                    <div>
                      <h3 className="text-xs font-mono font-semibold text-primary uppercase tracking-wider mb-2">
                        Policy Requirements - {detailPurpose}
                      </h3>
                      <PolicyCard policy={policy} loading={detailLoading} />
                    </div>

                    {/* Visa types */}
                    {meta?.visaTypes && (
                      <div>
                        <h3 className="text-xs font-mono font-semibold text-primary uppercase tracking-wider mb-2">Visa Types</h3>
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

                    {/* Economy + work grid */}
                    {meta && (
                      <div className="border rounded-lg overflow-hidden grid grid-cols-2 divide-x divide-border">
                        <div className="p-4">
                          <h3 className="text-[11px] font-mono font-semibold text-primary uppercase tracking-wider mb-1">Economy</h3>
                          <p className="text-sm leading-relaxed">{meta.economy}</p>
                        </div>
                        <div className="p-4">
                          <h3 className="text-[11px] font-mono font-semibold text-primary uppercase tracking-wider mb-1">Work</h3>
                          <p className="text-sm leading-relaxed">{meta.workOpportunities}</p>
                        </div>
                      </div>
                    )}

                    {/* Cities grid */}
                    {meta?.topCities && (
                      <div>
                        <h3 className="text-xs font-mono font-semibold text-primary uppercase tracking-wider mb-2">
                          Top Cities · {countryFlag(nationality)} diaspora
                        </h3>
                        <div className="border rounded-lg overflow-hidden">
                          <div className="grid grid-cols-3 divide-x divide-border">
                            {meta.topCities.slice(0, 3).map((city) => (
                              <div key={city.name} className="p-3">
                                <span className="text-sm font-semibold">{city.name}</span>
                                <span className="text-[11px] font-mono text-muted-foreground block">{city.monthlyCost}/mo</span>
                                <span className="text-xs text-primary font-mono">
                                  {city.diaspora[nationality] ? `~${city.diaspora[nationality]} ${natName}` : 'Small community'}
                                </span>
                              </div>
                            ))}
                          </div>
                          {meta.topCities.length > 3 && (
                            <div className="grid grid-cols-3 divide-x divide-border border-t">
                              {meta.topCities.slice(3).map((city) => (
                                <div key={city.name} className="p-3">
                                  <span className="text-sm font-semibold">{city.name}</span>
                                  <span className="text-[11px] font-mono text-muted-foreground block">{city.monthlyCost}/mo</span>
                                  <span className="text-xs text-primary font-mono">
                                    {city.diaspora[nationality] ? `~${city.diaspora[nationality]} ${natName}` : 'Small community'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Schools (student only) */}
                    {meta?.topSchools && detailPurpose === 'student' && (
                      <div>
                        <h3 className="text-xs font-mono font-semibold text-primary uppercase tracking-wider mb-2">Cheapest Tuition</h3>
                        <div className="border rounded-lg overflow-hidden divide-y divide-border">
                          {meta.topSchools.map((school) => (
                            <div key={school.name} className="px-4 py-2 flex items-center justify-between">
                              <span className="text-sm font-semibold">{school.name}</span>
                              <span className="text-sm font-mono text-primary tabular-nums">{school.annualTuition}/yr</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top fields */}
                    {meta?.topMajors && (
                      <div>
                        <h3 className="text-xs font-mono font-semibold text-primary uppercase tracking-wider mb-2">Top Earning Fields</h3>
                        <div className="border rounded-lg overflow-hidden divide-y divide-border">
                          {meta.topMajors.map((m) => (
                            <div key={m.name} className="px-4 py-2 flex items-center justify-between">
                              <span className="text-sm font-mono">{m.name}</span>
                              <span className="text-sm font-mono text-emerald-400 tabular-nums">{m.avgSalary}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scams + real talk */}
                    <div className="border rounded-lg overflow-hidden divide-y divide-border">
                      {meta?.scams && (
                        <div className="p-4">
                          <h3 className="text-[11px] font-mono font-semibold text-red-400 uppercase tracking-wider mb-2">Common Scams</h3>
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
                          <h3 className="text-[11px] font-mono font-semibold text-primary uppercase tracking-wider mb-1">Real Talk</h3>
                          <p className="text-sm italic leading-relaxed">{meta.realTalk}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AGENCY WATCH */}
            {activeTab === 'agency' && (
              <div className="p-4 pb-28 overflow-y-auto h-full space-y-3">
                {investigation && (
                  <AgencyInvestigation
                    data={investigation}
                    onClose={() => setInvestigation(null)}
                  />
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="border rounded-lg p-4">
                    <Inspector />
                  </div>
                  <div className="border rounded-lg p-4">
                    <Dashboard onStats={setStats} refreshKey={dashRefresh} />
                  </div>
                </div>
                <FlaggedIntel refreshKey={dashRefresh} />
              </div>
            )}

            {/* ELASTIC DATA */}
            {activeTab === 'elastic' && <ElasticData />}

            {/* REPORTER — community-filed reports (the action agent's record) */}
            {activeTab === 'reporter' && (
              <div className="p-4 pb-28 overflow-y-auto h-full">
                <Reporter refreshKey={dashRefresh} />
              </div>
            )}
          </div>
        </div>

        {/* ── Kibo: side panel on desktop, full-screen overlay on mobile ── */}
        {kiboStarted && (
          <aside
            className={`border-l bg-background flex-col lg:relative lg:flex lg:w-[420px] xl:w-[480px] lg:shrink-0 ${
              mobileKiboOpen ? 'absolute inset-0 z-40 flex' : 'hidden lg:flex'
            }`}
          >
            <button
              onClick={() => setMobileKiboOpen(false)}
              className="lg:hidden flex items-center gap-1.5 px-4 py-3 border-b text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <CaretDown size={14} weight="bold" className="rotate-90" />
              Back to dashboard
            </button>
            <Kibo
              ref={kiboRef}
              nationality={nationality}
              destination={selectedDest}
              purpose={detailPurpose}
              onInvestigation={handleInvestigation}
              onBusyChange={setKiboBusy}
              onContextChange={handleContextChange}
              onAgentRoute={handleAgentRoute}
            />
          </aside>
        )}
      </div>

      {/* ── Kibo command bar: floating, bottom-center of the app ── */}
      <div className="absolute bottom-4 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(850px,calc(100%-1.5rem))] flex flex-col items-center gap-2.5 pointer-events-none">
        {!kiboStarted && (
          <div className="flex flex-wrap gap-2 justify-center pointer-events-auto">
            {[
              'What do I need for a UK student visa?',
              'Check @gloryconsultancy',
              'Is a guaranteed 5-day visa real?',
            ].map((s) => (
              <button
                key={s}
                onClick={() => askKibo(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-background/85 backdrop-blur text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); askKibo(); }}
          className="w-full flex items-center gap-3 rounded-2xl border border-white/25 bg-card px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_30px_-4px_rgba(255,255,255,0.30),0_16px_44px_rgba(0,0,0,0.6)] pointer-events-auto transition-shadow focus-within:border-white/50 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_40px_-2px_rgba(255,255,255,0.45),0_16px_44px_rgba(0,0,0,0.6)]"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            {kiboBusy
              ? <CircleNotch size={17} className="text-primary animate-spin" />
              : <Sparkle size={17} weight="fill" className="text-primary" />}
          </div>
          <input
            value={kiboInput}
            onChange={(e) => setKiboInput(e.target.value)}
            placeholder={kiboBusy ? 'Kibo is working...' : 'Ask Kibo anything, or drop an @agency handle…'}
            disabled={kiboBusy}
            className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/80"
          />
          <span className="text-xs text-muted-foreground font-mono hidden sm:inline shrink-0 px-2 py-1 rounded bg-muted/60">
            {nationality}→{selectedDest}
          </span>
          <button
            type="submit"
            disabled={kiboBusy || !kiboInput.trim()}
            className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 hover:brightness-110 transition-all"
          >
            <PaperPlaneRight size={16} weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
}
