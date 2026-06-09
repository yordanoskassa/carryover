import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MagnifyingGlass, ShieldCheck, ShieldWarning, Flag, CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { evaluateAgency, reportScam, type InspectorResponse, type EvidenceItem } from '../api';

const CORRIDORS = [
  'ET->GB', 'ET->US', 'NG->US', 'NG->GB', 'IN->US', 'IN->CA',
  'NP->AU', 'PH->US', 'BD->GB', 'KE->US', 'GH->GB',
];

const EVIDENCE_LABELS: Record<string, string> = {
  SEMANTIC_MATCH: 'Semantic Match',
  POLICY_CONTRADICTION: 'Policy Contradiction',
  IDENTITY_REUSE: 'Identity Reuse',
  CATEGORY_MATCH: 'Category Match',
};

function getBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type === 'POLICY_CONTRADICTION') return 'destructive';
  if (type === 'IDENTITY_REUSE') return 'default';
  return 'secondary';
}

function RiskGauge({ score, verdict }: { score: number; verdict: string }) {
  const circumference = 2 * Math.PI * 70;
  const dashOffset = circumference - (score / 100) * circumference * 0.75;
  const colors: Record<string, string> = {
    LOW: '#059669',
    MEDIUM: '#d97706',
    HIGH: '#dc2626',
    CRITICAL: '#b91c1c',
  };
  const color = colors[verdict] || '#71717a';

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-[135deg]">
        <circle
          cx="80" cy="80" r="70" fill="none"
          stroke="hsl(var(--muted))" strokeWidth="8"
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
        <span className="text-3xl font-bold tabular-nums">{score}</span>
        <span className="text-xs font-semibold mt-1" style={{ color }}>
          {verdict}
        </span>
      </div>
    </div>
  );
}

function EvidenceCard({ item, index }: { item: EvidenceItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className="bg-card border rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <Badge variant={getBadgeVariant(item.type)}>
          {EVIDENCE_LABELS[item.type] || item.type}
        </Badge>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {(item.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
      {item.source && (
        <p className="text-xs mt-2.5 text-muted-foreground/70">{item.source}</p>
      )}
    </motion.div>
  );
}

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
      // silent fail
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground max-w-[65ch]">
        Paste an agency post to check for scam patterns against known fraud databases.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            rows={4}
            placeholder={"Paste the agency's Telegram or Facebook post here..."}
            className="resize-none"
          />
        </div>

        <div className="space-y-3">
          <Input
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Agency name (optional)"
          />
          <select
            value={corridor}
            onChange={(e) => setCorridor(e.target.value)}
            className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 appearance-none cursor-pointer"
          >
            <option value="">Corridor (optional)</option>
            {CORRIDORS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button
            onClick={handleEvaluate}
            disabled={loading || !postText.trim()}
            variant="destructive"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? <CircleNotch size={15} className="animate-spin" /> : <MagnifyingGlass size={15} weight="bold" />}
            {loading ? 'Analyzing...' : 'Evaluate'}
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
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="bg-card border rounded-xl p-6 flex flex-col items-center">
              <RiskGauge score={result.risk_score} verdict={result.verdict} />

              <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
                {result.verdict === 'LOW' ? (
                  <ShieldCheck size={18} weight="bold" className="text-emerald-600" />
                ) : (
                  <ShieldWarning size={18} weight="bold" className="text-red-600" />
                )}
                <span>{result.verdict} RISK</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 w-full">
                {[
                  { label: 'Matches', value: result.matched_scams, color: 'text-orange-600' },
                  { label: 'Conflicts', value: result.contradictions, color: 'text-red-600' },
                  { label: 'ID reuse', value: result.identity_reuse_count, color: 'text-violet-600' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-muted rounded-lg p-2.5 text-center">
                    <div className={`text-lg font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {result.risk_score >= 30 && (
                <Button
                  onClick={handleReport}
                  disabled={reported}
                  variant="outline"
                  className="mt-4 w-full text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Flag size={14} weight="bold" />
                  {reported ? 'Reported' : 'Report this scam'}
                </Button>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-semibold">Evidence Chain</h3>
              {result.evidence_chain.length === 0 ? (
                <div className="bg-muted rounded-xl p-12 text-center">
                  <ShieldCheck size={32} weight="thin" className="text-emerald-600 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No evidence signals detected. This may be a legitimate post.</p>
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
