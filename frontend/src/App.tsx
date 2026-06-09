import { useState, useEffect } from 'react';
import { Eye } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Globe from './components/Globe';
import Advisor from './components/Advisor';
import Inspector from './components/Inspector';
import Dashboard from './components/Dashboard';
import VisaOverview from './components/VisaOverview';
import './index.css';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

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

export default function App() {
  const [nationality, setNationality] = useState('ET');
  const [destination, setDestination] = useState('GB');
  const [name, setName] = useState(() => localStorage.getItem('ep_name') || '');
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (name) localStorage.setItem('ep_name', name);
  }, [name]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-background/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Eye size={20} weight="bold" />
            <span className="text-sm font-semibold tracking-tight">ElastiPath</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="xs">EN</Button>
            <Button variant="ghost" size="xs" className="text-muted-foreground">amh</Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6">
        {/* Hero */}
        <section className="py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight">
                  {getGreeting()}
                  {name ? `, ${name}` : ''}.
                </h1>
                {!name && !editingName && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-sm text-muted-foreground mt-1.5 hover:text-foreground transition-colors underline underline-offset-4 decoration-border"
                  >
                    Set your name
                  </button>
                )}
                {editingName && (
                  <form
                    className="flex items-center gap-2 mt-2"
                    onSubmit={(e) => { e.preventDefault(); setEditingName(false); }}
                  >
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your first name"
                      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <Button size="sm" type="submit">Save</Button>
                  </form>
                )}
                {name && !editingName && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-sm text-muted-foreground mt-1.5 block hover:text-foreground transition-colors"
                  >
                    Verify visa requirements and check agencies before you travel.
                  </button>
                )}
                {!name && !editingName && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Verify visa requirements and check agencies before you travel.
                  </p>
                )}
              </div>

              {/* Route selector */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{countryFlag(nationality)}</span>
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">I'm from</label>
                    <select
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 appearance-none cursor-pointer"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{countryFlag(destination)}</span>
                  <div className="flex-1">
                    <label className="block text-xs text-muted-foreground mb-1">Going to</label>
                    <select
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 appearance-none cursor-pointer"
                    >
                      {DESTINATIONS.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Globe */}
            <div className="flex justify-center lg:justify-end">
              <Globe nationality={nationality} destination={destination} />
            </div>
          </div>
        </section>

        {/* Visa overview + News */}
        <section className="pb-10">
          <VisaOverview nationality={nationality} />
        </section>

        {/* Advisor */}
        <section className="border-t py-10">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Visa Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <Advisor nationality={nationality} destination={destination} />
            </CardContent>
          </Card>
        </section>

        {/* Inspector */}
        <section className="border-t py-10">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Check an Agency</CardTitle>
            </CardHeader>
            <CardContent>
              <Inspector />
            </CardContent>
          </Card>
        </section>

        {/* Dashboard */}
        <section className="border-t py-10">
          <Dashboard />
        </section>
      </main>
    </div>
  );
}
