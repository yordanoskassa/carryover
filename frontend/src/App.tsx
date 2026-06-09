import { useState, useEffect } from 'react';
import { Eye, Database, Shield, Warning, Phone } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import NewsTicker from './components/NewsTicker';
import Advisor from './components/Advisor';
import Inspector from './components/Inspector';
import Dashboard, { type DashboardStats } from './components/Dashboard';
import VisaOverview from './components/VisaOverview';
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

const DESTINATIONS = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'AU', name: 'Australia' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      <span className="font-bold tabular-nums text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

export default function App() {
  const [nationality, setNationality] = useState('ET');
  const [destination, setDestination] = useState('GB');
  const [name, setName] = useState(() => localStorage.getItem('ep_name') || '');
  const [editingName, setEditingName] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({ scams: 0, policies: 0, flaggedAgencies: 0, sharedPhones: 0 });

  useEffect(() => {
    if (name) localStorage.setItem('ep_name', name);
  }, [name]);

  return (
    <div className="h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header - 48px */}
      <header className="border-b bg-background/90 backdrop-blur-xl shrink-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={18} weight="bold" />
            <span className="text-sm font-semibold tracking-tight">ElastiPath</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="xs">EN</Button>
            <Button variant="ghost" size="xs" className="text-muted-foreground">amh</Button>
          </div>
        </div>
      </header>

      {/* Ticker - 32px */}
      <NewsTicker nationality={nationality} />

      {/* Top bar - 48px: greeting + route selectors + stats */}
      <div className="border-b shrink-0">
        <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center gap-4">
          {/* Greeting + name */}
          <div className="flex items-center gap-2 shrink-0">
            {editingName ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => { e.preventDefault(); setEditingName(false); }}
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-6 w-24 rounded border border-input bg-transparent px-1.5 text-xs outline-none focus-visible:border-ring"
                />
                <Button size="xs" type="submit" className="h-6 text-[10px]">OK</Button>
              </form>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-medium hover:text-foreground/70 transition-colors"
              >
                {getGreeting()}{name ? `, ${name}` : ''}.
              </button>
            )}
          </div>

          {/* Route selectors */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm">{countryFlag(nationality)}</span>
            <select
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none appearance-none cursor-pointer"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="text-sm">{countryFlag(destination)}</span>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none appearance-none cursor-pointer"
            >
              {DESTINATIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-border shrink-0" />

          {/* Stats */}
          <div className="flex items-center gap-4 overflow-x-auto">
            <StatPill icon={<Database size={12} weight="bold" className="text-red-500" />} value={stats.scams} label="Reports" />
            <StatPill icon={<Shield size={12} weight="bold" className="text-emerald-500" />} value={stats.policies} label="Policies" />
            <StatPill icon={<Warning size={12} weight="bold" className="text-amber-500" />} value={stats.flaggedAgencies} label="Flagged" />
            <StatPill icon={<Phone size={12} weight="bold" className="text-violet-500" />} value={stats.sharedPhones} label="Phones" />
          </div>
        </div>
      </div>

      {/* Main content - fills remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-4 py-3 space-y-3">
          {/* 3-column main panel */}
          <div className="grid grid-cols-12 gap-3" style={{ minHeight: '380px' }}>
            {/* Openness sidebar - narrow */}
            <div className="col-span-2 border rounded-lg p-3 overflow-y-auto">
              <VisaOverview nationality={nationality} />
            </div>

            {/* Advisor - mid */}
            <div className="col-span-5 border rounded-lg p-3 overflow-hidden">
              <Advisor nationality={nationality} destination={destination} />
            </div>

            {/* Inspector - mid */}
            <div className="col-span-5 border rounded-lg p-3 overflow-hidden">
              <Inspector />
            </div>
          </div>

          {/* Charts + tables (Dashboard) */}
          <Dashboard onStats={setStats} />
        </div>
      </div>
    </div>
  );
}
