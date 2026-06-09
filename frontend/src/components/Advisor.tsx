import { useState } from 'react';
import { Globe, FileText, Clock, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import { getRequirements, type PolicyResult } from '../api';

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

const PURPOSES = ['student', 'work', 'family', 'tourist'];

export default function Advisor() {
  const [nationality, setNationality] = useState('ET');
  const [destination, setDestination] = useState('GB');
  const [purpose, setPurpose] = useState('student');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PolicyResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRequirements(nationality, destination, purpose);
      setResults(data.requirements);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requirements');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-white">Visa Requirements Advisor</h2>
        <p className="text-gray-400 mt-1">Get official, cited visa requirements for your route</p>
      </div>

      {/* Input form */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* From country */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Your nationality</label>
          <select
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* To country */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Destination</label>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition"
          >
            {DESTINATIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Purpose */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Visa type</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition capitalize"
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Search button */}
        <div className="flex items-end">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-medium py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Globe size={18} />}
            {loading ? 'Searching...' : 'Get Requirements'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">
            Requirements: {COUNTRIES.find(c => c.code === nationality)?.name} → {DESTINATIONS.find(c => c.code === destination)?.name}
          </h3>
          {results.length === 0 ? (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center text-gray-500">
              No policy data found for this corridor yet. Data is still being indexed.
            </div>
          ) : (
            <div className="grid gap-3">
              {results.map((req, i) => (
                <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition">
                  <p className="text-gray-200 leading-relaxed">{req.requirement_text}</p>
                  {req.documents_needed && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-gray-400">
                      <FileText size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                      <span>{req.documents_needed}</span>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                    {req.fee_usd && (
                      <span className="flex items-center gap-1">
                        <DollarSign size={12} className="text-yellow-500" />
                        ${req.fee_usd}
                      </span>
                    )}
                    {req.processing_days && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-blue-400" />
                        {req.processing_days} days
                      </span>
                    )}
                    {req.source_url && (
                      <a
                        href={req.source_url}
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                      >
                        <ExternalLink size={12} />
                        {req.source_name || 'Source'}
                      </a>
                    )}
                    {req.last_updated && (
                      <span className="text-gray-600">Updated: {req.last_updated}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
