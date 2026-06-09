import { useState } from 'react';
import { ShieldCheck, MagnifyingGlass, ChartBar, Eye } from '@phosphor-icons/react';
import Advisor from './components/Advisor';
import Inspector from './components/Inspector';
import Dashboard from './components/Dashboard';
import './index.css';

type Tab = 'advisor' | 'inspector' | 'dashboard';

const tabs: { id: Tab; label: string; icon: React.ReactNode; }[] = [
  { id: 'advisor', label: 'Advisor', icon: <ShieldCheck size={18} weight="bold" /> },
  { id: 'inspector', label: 'Inspector', icon: <MagnifyingGlass size={18} weight="bold" /> },
  { id: 'dashboard', label: 'Dashboard', icon: <ChartBar size={18} weight="bold" /> },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('advisor');

  return (
    <div className="min-h-[100dvh] bg-[var(--surface-0)] text-[var(--text-secondary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface-1)]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-5 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Eye size={18} weight="bold" className="text-emerald-400" />
            </div>
            <span className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight">
              ElastiPath
            </span>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-[var(--text-primary)] bg-[var(--surface-3)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Language toggle */}
          <div className="flex items-center gap-1.5">
            <button className="text-xs px-2.5 py-1.5 rounded-md bg-[var(--surface-3)] text-[var(--text-primary)] font-medium">
              EN
            </button>
            <button className="text-xs px-2.5 py-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors">
              amh
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-5 py-8">
        {activeTab === 'advisor' && <Advisor />}
        {activeTab === 'inspector' && <Inspector />}
        {activeTab === 'dashboard' && <Dashboard />}
      </main>
    </div>
  );
}
