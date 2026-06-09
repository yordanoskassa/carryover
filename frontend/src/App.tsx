import { useState } from 'react';
import { Shield, Search, BarChart3, Eye } from 'lucide-react';
import Advisor from './components/Advisor';
import Inspector from './components/Inspector';
import Dashboard from './components/Dashboard';
import './index.css';

type Tab = 'advisor' | 'inspector' | 'dashboard';

const tabs: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'advisor', label: 'Advisor', icon: <Shield size={18} />, desc: 'Visa Requirements' },
  { id: 'inspector', label: 'Inspector', icon: <Search size={18} />, desc: 'Agency Check' },
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={18} />, desc: 'Threat Intel' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('advisor');

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-[#0d0d14]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <Eye size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white leading-tight">ElastiPath</h1>
              <p className="text-xs text-gray-500">Your safe path to migrate</p>
            </div>
          </div>

          {/* Nav tabs */}
          <nav className="flex gap-1 bg-gray-900/50 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gray-800 text-white shadow-lg shadow-black/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Language toggle placeholder */}
          <div className="flex items-center gap-2">
            <button className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-white transition">
              EN
            </button>
            <button className="text-xs px-2 py-1 rounded bg-gray-800/40 text-gray-500 hover:text-white transition">
              አማ
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'advisor' && <Advisor />}
        {activeTab === 'inspector' && <Inspector />}
        {activeTab === 'dashboard' && <Dashboard />}
      </main>
    </div>
  );
}
