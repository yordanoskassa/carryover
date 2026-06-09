import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MagnifyingGlass, ShieldCheck, ShieldWarning, Flag, CircleNotch } from '@phosphor-icons/react';
import { evaluateAgency, reportScam, type InspectorResponse, type EvidenceItem } from '../api';

const CORRIDORS = [
  'ET->GB', 'ET->US', 'NG->US', 'NG->GB', 'IN->US', 'IN->CA',
  'NP->AU', 'PH->US', 'BD->GB', 'KE->US', 'GH->GB',
];

const EVIDENCE_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  SEMANTIC_MATCH: { text: 'text-orange-400', bg: 'bg-orange-500/5', border: 'border-orange-500/15' },
  POLICY_CONTRADICTION: { text: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/15' },
  IDENTITY_REUSE: { text: 'text-violet-400', bg: 'bg-violet-500/5', border: 'border-violet-500/15' },
  CATEGORY_MATCH: { text: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/15' },
};

const EVIDENCE_LABELS: Record<string, string> = {
  SEMANTIC_MATCH: 'Semantic Match',
  POLICY_CONTRADICTION: 'Policy Contradiction',
  IDENTITY_REUSE: 'Identity Reuse',
  CATEGORY_MATCH: 'Category Match',
};

function RiskGauge({ score, verdict }: { score: number; verdict: string }) {
  const circumference = 2 * Math.PI * 70;
  const dashOffset = circumference - (score / 100) * circumference * 0.75;
  const colors: Record<string, string> = {
    LOW: '#10b981',
    MEDIUM: '#f59e0b',
    HIGH: '#ef4444',
    CRITICAL: '#dc2626',
  };
  const color = colors[verdict] || '#82828c';

  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-[135deg]">
        <circle
          cx="80" cy="80" r="70" fill="none"
          stroke="rgba(255,255,255,0.04)" strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
        />
        <circle
          cx="80" cy="80" r="70" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-[var(--text-primary)] tabular-nums">{score}</span>
        <span className="text-xs font-semibold mt-1 uppercase tracking-wider" style={{ color }}>
          {verdict}
        </span>
      </div>
    </div>
  );
}

function EvidenceCard({ item, index }: { item: EvidenceItem; index: number }) {
  const styles = EVIDENCE_STYLES[item.type] || { text: 'text-zinc-400', bg: 'bg-zinc-500/5', border: 'border-zinc-500/15' };
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className={`${styles.bg} ${styles.border} border rounded-xl p-4`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-semibold ${styles.text}`}>
          {EVIDENCE_LABELS[item.type] || item.type}
        </span>
        <span className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
          {(item.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.description}</p>
      {item.source && (
        <p className="text-xs mt-2.5 text-[var(--text-muted)]">{item.source}</p>
      )}
    </motion.div>
  );
}

const inputStyles = "w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-500/50 transition-colors";

export default function Inspector() {
  const [postText, setPostText] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [corridor, setCorridor] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectorResponse | null>(null);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!postText.trim()) return;
    setLoading(true);
    setError(null);
    setReported(false);
    try {
      const data = await evaluateAgency(postText, agencyName || undefined, corridor || undefined);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async () => {
    try {
      await reportScam({
        post_text: postText,
        agency_name: agencyName || undefined,
        corridor: corridor || undefined,
      });
      setReported(true);
    } catch {
      // silent fail for now
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
          Agency Inspector
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1.5 max-w-[65ch]">
          Paste an agency post to check for scam patterns against known fraud databases.
        </p>
      </div>

      {/* Input area */}
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">
              Agency post or claim
            </label>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={5}
              placeholder={"Paste the agency's Telegram/Facebook post here...\n\nExample: 'Guaranteed UK visa! No passport needed! Pay only $2000 to our personal account and get your visa in 3 days!'"}
              className={`${inputStyles} resize-none`}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">
                Agency name
              </label>
              <input
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Optional"
                className={inputStyles}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">
                Corridor
              </label>
              <select
                value={corridor}
                onChange={(e) => setCorridor(e.target.value)}
                className={`${inputStyles} appearance-none cursor-pointer`}
              >
                <option value="">Select corridor...</option>
                {CORRIDORS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleEvaluate}
              disabled={loading || !postText.trim()}
              className="w-full bg-red-500 hover:bg-red-400 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
            >
              {loading ? <CircleNotch size={16} className="animate-spin" /> : <MagnifyingGlass size={16} weight="bold" />}
              {loading ? 'Analyzing...' : 'Evaluate'}
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
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Risk gauge panel */}
            <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-6 flex flex-col items-center">
              <RiskGauge score={result.risk_score} verdict={result.verdict} />

              <div className="mt-5 flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
                {result.verdict === 'LOW' ? (
                  <ShieldCheck size={20} weight="bold" className="text-emerald-400" />
                ) : (
                  <ShieldWarning size={20} weight="bold" className="text-red-400" />
                )}
                <span>{result.verdict} RISK</span>
              </div>

              {/* Stats */}
              <div className="mt-5 grid grid-cols-3 gap-2 w-full">
                {[
                  { label: 'Scam matches', value: result.matched_scams, color: 'text-orange-400' },
                  { label: 'Contradictions', value: result.contradictions, color: 'text-red-400' },
                  { label: 'ID reuse', value: result.identity_reuse_count, color: 'text-violet-400' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[var(--surface-2)] rounded-lg p-2.5 text-center">
                    <div className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Report button */}
              {result.risk_score >= 30 && (
                <button
                  onClick={handleReport}
                  disabled={reported}
                  className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50 text-sm active:scale-[0.98]"
                >
                  <Flag size={14} weight="bold" />
                  {reported ? 'Reported' : 'Report this scam'}
                </button>
              )}
            </div>

            {/* Evidence chain */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Evidence Chain</h3>
              {result.evidence_chain.length === 0 ? (
                <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-12 text-center">
                  <ShieldCheck size={32} weight="thin" className="text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">No evidence signals detected. This may be a legitimate post.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {result.evidence_chain.map((item, i) => (
                    <EvidenceCard key={i} item={item} index={i} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
