import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, Clock, CurrencyDollar, ArrowSquareOut, CircleNotch, ArrowRight } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { getRequirements, type PolicyResult } from '../api';

const PURPOSES = ['student', 'work', 'family', 'tourist'];

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
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">Visa Requirements</h3>

      <div className="flex items-center gap-1.5 mb-2">
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring appearance-none cursor-pointer capitalize flex-1"
        >
          {PURPOSES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <Button onClick={handleSearch} disabled={loading} size="sm" className="h-7 text-xs px-2.5">
          {loading ? (
            <CircleNotch size={12} className="animate-spin" />
          ) : (
            <ArrowRight size={12} weight="bold" />
          )}
          {loading ? 'Searching' : 'Search'}
        </Button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-destructive/10 border border-destructive/20 rounded-md p-2 text-destructive text-xs mb-2"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '320px' }}>
        <AnimatePresence>
          {results && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {results.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No policy data found.</p>
              ) : (
                results.map((req, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border rounded-lg p-3"
                  >
                    <p className="text-xs leading-relaxed">{req.requirement_text}</p>

                    {req.documents_needed && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <FileText size={11} weight="bold" className="mt-0.5 shrink-0" />
                        <span>{req.documents_needed}</span>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      {req.fee_usd && (
                        <span className="flex items-center gap-1">
                          <CurrencyDollar size={10} weight="bold" />${req.fee_usd}
                        </span>
                      )}
                      {req.processing_days && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} weight="bold" />{req.processing_days}d
                        </span>
                      )}
                      {req.source_url && (
                        <a
                          href={req.source_url}
                          target="_blank"
                          rel="noopener"
                          className="flex items-center gap-1 text-foreground hover:underline"
                        >
                          <ArrowSquareOut size={10} weight="bold" />
                          {req.source_name || 'Source'}
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
