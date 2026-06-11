import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MagnifyingGlass, ShieldCheck, ShieldWarning, Flag, CircleNotch, TelegramLogo, Phone } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  evaluateAgency, reportScam, scanAgency,
  type InspectorResponse, type EvidenceItem, type ScanAgencyResponse,
} from '../api';

const CORRIDORS = [
  'ET->GB', 'ET->US', 'NG->US', 'NG->GB', 'IN->US', 'IN->CA',
  'NP->AU', 'PH->US', 'BD->GB', 'KE->US', 'GH->GB',
];

const EVIDENCE_LABELS: Record<string, string> = {
  SEMANTIC_MATCH: 'Semantic',
  POLICY_CONTRADICTION: 'Contradiction',
  IDENTITY_REUSE: 'ID Reuse',
  CATEGORY_MATCH: 'Category',
};

function getBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type === 'POLICY_CONTRADICTION') return 'destructive';
  if (type === 'IDENTITY_REUSE') return 'default';
  return 'secondary';
}

function RiskGauge({ score, verdict }: { score: number; verdict: string }) {
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - (score / 100) * circumference * 0.75;
  const colors: Record<string, string> = {
    LOW: '#059669',
    MEDIUM: '#d97706',
    HIGH: '#dc2626',
    CRITICAL: '#b91c1c',
  };
  const color = colors[verdict] || '#71717a';

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-[135deg]">
        <circle
          cx="50" cy="50" r="42" fill="none"
          stroke="hsl(var(--muted))" strokeWidth="6"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
        />
        <circle
          cx="50" cy="50" r="42" fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={dashOffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{score}</span>
        <span className="text-[11px] font-semibold" style={{ color }}>
          {verdict}
        </span>
      </div>
    </div>
  );
}

function EvidenceCard({ item, index }: { item: EvidenceItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="border rounded-lg p-2.5"
    >
      <div className="flex items-center justify-between mb-1">
        <Badge variant={getBadgeVariant(item.type)} className="text-[11px] px-1.5 py-0">
          {EVIDENCE_LABELS[item.type] || item.type}
        </Badge>
        <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
          {(item.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
    </motion.div>
  );
}

const verdictColor = (verdict: string) =>
  verdict === 'LOW' ? 'text-emerald-400'
    : verdict === 'MEDIUM' ? 'text-amber-400'
    : 'text-red-400';

export default function Inspector() {
  const [mode, setMode] = useState<'post' | 'handle'>('post');
  const [postText, setPostText] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [handle, setHandle] = useState('');
  const [corridor, setCorridor] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectorResponse | null>(null);
  const [scan, setScan] = useState<ScanAgencyResponse | null>(null);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEvaluate = async () => {
    if (!postText.trim()) return;
    setLoading(true);
    setError(null);
    setReported(false);
    setScan(null);
    try {
      const data = await evaluateAgency(postText, agencyName || undefined, corridor || undefined);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!handle.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setScan(null);
    try {
      const data = await scanAgency(handle, corridor || undefined);
      setScan(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      setError(msg.includes('404') ? 'No public posts found — channel may be private or the handle is wrong.' : msg);
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agency Inspector</h3>
        <div className="flex rounded-md border border-border overflow-hidden text-[11px] font-medium">
          <button
            onClick={() => { setMode('post'); setError(null); }}
            className={`px-2 py-1 transition-colors ${mode === 'post' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
          >
            Paste post
          </button>
          <button
            onClick={() => { setMode('handle'); setError(null); }}
            className={`px-2 py-1 transition-colors flex items-center gap-1 ${mode === 'handle' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
          >
            <TelegramLogo size={11} weight="bold" /> Scan handle
          </button>
        </div>
      </div>

      {mode === 'post' ? (
        <>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            rows={2}
            placeholder="Paste agency post..."
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring resize-none mb-2"
          />
          <div className="flex items-center gap-1.5 mb-2">
            <input
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Agency name"
              className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
            />
            <select
              value={corridor}
              onChange={(e) => setCorridor(e.target.value)}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring appearance-none cursor-pointer"
            >
              <option value="">Corridor</option>
              {CORRIDORS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Button
              onClick={handleEvaluate}
              disabled={loading || !postText.trim()}
              variant="destructive"
              size="sm"
              className="h-7 text-xs px-2.5 bg-red-600 hover:bg-red-700"
            >
              {loading ? <CircleNotch size={12} className="animate-spin" /> : <MagnifyingGlass size={12} weight="bold" />}
              {loading ? 'Analyzing' : 'Evaluate'}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-1.5 mb-2">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
            placeholder="@agency_handle or t.me/..."
            className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
          />
          <select
            value={corridor}
            onChange={(e) => setCorridor(e.target.value)}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring appearance-none cursor-pointer"
          >
            <option value="">Corridor</option>
            {CORRIDORS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Button
            onClick={handleScan}
            disabled={loading || !handle.trim()}
            variant="destructive"
            size="sm"
            className="h-7 text-xs px-2.5 bg-red-600 hover:bg-red-700"
          >
            {loading ? <CircleNotch size={12} className="animate-spin" /> : <MagnifyingGlass size={12} weight="bold" />}
            {loading ? 'Scanning' : 'Scan'}
          </Button>
        </div>
      )}

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

      <div className="flex-1 overflow-y-auto min-h-0" style={{ maxHeight: '280px' }}>
        <AnimatePresence>
          {scan && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2.5">
              <div className="border rounded-lg p-2.5 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <TelegramLogo size={15} weight="bold" className="text-primary shrink-0" />
                    <span className="text-xs font-semibold truncate">{scan.agency.title}</span>
                  </div>
                  <span className={`text-xs font-bold tabular-nums shrink-0 ${verdictColor(scan.verdict)}`}>
                    {scan.aggregate_risk} {scan.verdict}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  @{scan.agency.handle} · {scan.posts_scanned} posts scanned · {scan.posts_indexed} indexed to Elastic
                </p>
                {scan.phones_found.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <Phone size={11} className="text-amber-400" />
                    {scan.phones_found.map((p) => (
                      <span key={p} className="text-[11px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                )}
              </div>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase">Posts by risk</h4>
              {scan.posts.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border rounded-lg p-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold tabular-nums ${verdictColor(p.verdict)}`}>
                      {p.risk_score} {p.verdict}
                    </span>
                    {p.date && <span className="text-[10px] text-muted-foreground font-mono">{p.date.slice(0, 10)}</span>}
                  </div>
                  <p className="text-xs text-foreground/90 leading-snug line-clamp-2">{p.text}</p>
                  {p.evidence.map((e, j) => (
                    <p key={j} className="text-[11px] text-muted-foreground mt-1 leading-snug">• {e.description}</p>
                  ))}
                </motion.div>
              ))}
            </motion.div>
          )}
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <RiskGauge score={result.risk_score} verdict={result.verdict} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    {result.verdict === 'LOW' ? (
                      <ShieldCheck size={14} weight="bold" className="text-emerald-600" />
                    ) : (
                      <ShieldWarning size={14} weight="bold" className="text-red-600" />
                    )}
                    <span>{result.verdict} RISK</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Matches', value: result.matched_scams, color: 'text-orange-600' },
                      { label: 'Conflicts', value: result.contradictions, color: 'text-red-600' },
                      { label: 'ID reuse', value: result.identity_reuse_count, color: 'text-violet-600' },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-muted rounded-md p-1.5 text-center">
                        <div className={`text-sm font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                        <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {result.risk_score >= 30 && (
                    <Button
                      onClick={handleReport}
                      disabled={reported}
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] px-2 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Flag size={10} weight="bold" />
                      {reported ? 'Reported' : 'Report scam'}
                    </Button>
                  )}
                </div>
              </div>

              {result.evidence_chain.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase">Evidence</h4>
                  {result.evidence_chain.map((item, i) => (
                    <EvidenceCard key={i} item={item} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
