import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Clock, CurrencyDollar, ArrowSquareOut, CircleNotch, ArrowRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { getRequirements, type PolicyResult } from '../api';

const PURPOSES = ['student', 'work', 'family', 'tourist'];

const COUNTRIES: Record<string, string> = {
  ET: 'Ethiopia', NG: 'Nigeria', IN: 'India', NP: 'Nepal',
  PH: 'Philippines', BD: 'Bangladesh', KE: 'Kenya', GH: 'Ghana',
  PK: 'Pakistan', EG: 'Egypt',
};

const DESTINATIONS: Record<string, string> = {
  GB: 'United Kingdom', US: 'United States', CA: 'Canada', DE: 'Germany',
  AU: 'Australia', FR: 'France', NL: 'Netherlands', SE: 'Sweden',
};

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

interface AdvisorProps {
  nationality: string;
  destination: string;
}

export default function Advisor({ nationality, destination }: AdvisorProps) {
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
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{countryFlag(nationality)}</span>
          <span>{COUNTRIES[nationality] || nationality}</span>
          <ArrowRight size={14} />
          <span>{countryFlag(destination)}</span>
          <span>{DESTINATIONS[destination] || destination}</span>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 appearance-none cursor-pointer capitalize"
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>{p} visa</option>
            ))}
          </select>

          <Button onClick={handleSearch} disabled={loading} size="default">
            {loading ? (
              <CircleNotch size={15} className="animate-spin" />
            ) : (
              <ArrowRight size={15} weight="bold" />
            )}
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {results.length === 0 ? (
              <div className="bg-muted rounded-xl p-12 text-center">
                <p className="text-muted-foreground text-sm">No policy data found for this corridor yet.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {results.map((req, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                    className="bg-card border rounded-xl p-5 hover:ring-1 hover:ring-ring/20 transition-all"
                  >
                    <p className="text-sm leading-relaxed max-w-[65ch]">{req.requirement_text}</p>

                    {req.documents_needed && (
                      <div className="mt-3 flex items-start gap-2.5 text-sm">
                        <FileText size={14} weight="bold" className="mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">{req.documents_needed}</span>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      {req.fee_usd && (
                        <span className="flex items-center gap-1.5">
                          <CurrencyDollar size={13} weight="bold" />${req.fee_usd}
                        </span>
                      )}
                      {req.processing_days && (
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} weight="bold" />{req.processing_days} days
                        </span>
                      )}
                      {req.source_url && (
                        <a
                          href={req.source_url}
                          target="_blank"
                          rel="noopener"
                          className="flex items-center gap-1.5 text-foreground hover:underline transition-colors"
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
