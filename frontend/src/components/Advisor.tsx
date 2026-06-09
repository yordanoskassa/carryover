import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, FileText, Clock, CurrencyDollar, ArrowSquareOut, CircleNotch, MagnifyingGlass } from '@phosphor-icons/react';
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

const selectStyles = "w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-emerald-500/50 transition-colors appearance-none cursor-pointer";

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
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
          Visa Requirements
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-[65ch]">
          Official, cited visa requirements for your route. All data sourced from government websites.
        </p>
      </div>

      {/* Form */}
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">
              Nationality
            </label>
            <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={selectStyles}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">
              Destination
            </label>
            <select value={destination} onChange={(e) => setDestination(e.target.value)} className={selectStyles}>
              {DESTINATIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">
              Visa type
            </label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={`${selectStyles} capitalize`}>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
            >
              {loading ? <CircleNotch size={16} className="animate-spin" /> : <MagnifyingGlass size={16} weight="bold" />}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <Globe size={18} weight="bold" className="text-emerald-400" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {COUNTRIES.find(c => c.code === nationality)?.name} to {DESTINATIONS.find(c => c.code === destination)?.name}
              </h3>
            </div>

            {results.length === 0 ? (
              <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-12 text-center">
                <p className="text-[var(--text-muted)] text-sm">No policy data found for this corridor yet.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {results.map((req, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                    className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--border-hover)] transition-colors"
                  >
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed max-w-[65ch]">
                      {req.requirement_text}
                    </p>

                    {req.documents_needed && (
                      <div className="mt-3 flex items-start gap-2.5 text-sm">
                        <FileText size={14} weight="bold" className="mt-0.5 shrink-0 text-emerald-400" />
                        <span className="text-[var(--text-secondary)]">{req.documents_needed}</span>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
                      {req.fee_usd && (
                        <span className="flex items-center gap-1.5">
                          <CurrencyDollar size={13} weight="bold" className="text-amber-400" />
                          ${req.fee_usd}
                        </span>
                      )}
                      {req.processing_days && (
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} weight="bold" className="text-blue-400" />
                          {req.processing_days} days
                        </span>
                      )}
                      {req.source_url && (
                        <a
                          href={req.source_url}
                          target="_blank"
                          rel="noopener"
                          className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <ArrowSquareOut size={13} weight="bold" />
                          {req.source_name || 'Source'}
                        </a>
                      )}
                      {req.last_updated && (
                        <span>Updated {req.last_updated}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
