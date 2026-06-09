import { useState } from 'react';
import { Search, AlertTriangle, ShieldCheck, ShieldAlert, ShieldX, Flag, Loader2 } from 'lucide-react';
import { evaluateAgency, reportScam, type InspectorResponse, type EvidenceItem } from '../api';

const CORRIDORS = [
  'ET->GB', 'ET->US', 'NG->US', 'NG->GB', 'IN->US', 'IN->CA',
  'NP->AU', 'PH->US', 'BD->GB', 'KE->US', 'GH->GB',
];

const EVIDENCE_COLORS: Record<string, string> = {
  SEMANTIC_MATCH: 'text-orange-400 bg-orange-900/20 border-orange-800',
  POLICY_CONTRADICTION: 'text-red-400 bg-red-900/20 border-red-800',
  IDENTITY_REUSE: 'text-purple-400 bg-purple-900/20 border-purple-800',
  CATEGORY_MATCH: 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
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
  const color = colors[verdict] || '#6b7280';

  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg viewBox="0 0 160 160" className="w-full h-full -rotate-[135deg]">
        <circle cx="80" cy="80" r="70" fill="none" stroke="#1f2937" strokeWidth="10" strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`} />
        <circle cx="80" cy="80" r="70" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`} strokeDashoffset={dashOffset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-sm font-semibold mt-1" style={{ color }}>{verdict}</span>
      </div>
    </div>
  );
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const colorClasses = EVIDENCE_COLORS[item.type] || 'text-gray-400 bg-gray-900/20 border-gray-800';
  return (
    <div className={`border rounded-lg p-3 ${colorClasses}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-mono font-semibold uppercase">
          {EVIDENCE_LABELS[item.type] || item.type}
        </span>
        <span className="text-xs opacity-60">{(item.confidence * 100).toFixed(0)}% confidence</span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{item.description}</p>
      {item.source && (
        <p className="text-xs mt-2 opacity-50">{item.source}</p>
      )}
    </div>
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
      // silent fail for now
    }
  };

  const VerdictIcon = result?.verdict === 'LOW' ? ShieldCheck :
    result?.verdict === 'MEDIUM' ? AlertTriangle : ShieldX;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Agency Inspector</h2>
        <p className="text-gray-400 mt-1">Paste an agency post to check for scam patterns</p>
      </div>

      {/* Input area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <label className="block text-sm text-gray-400 mb-1.5">Agency post / claim</label>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            rows={5}
            placeholder="Paste the agency's Telegram/Facebook post here...&#10;&#10;Example: 'Guaranteed UK visa! No passport needed! Pay only $2000 to our personal account and get your visa in 3 days!'"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition resize-none"
          />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Agency name (optional)</label>
            <input
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="e.g. Star Travel Agency"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Corridor</label>
            <select
              value={corridor}
              onChange={(e) => setCorridor(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition"
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
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-medium py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            {loading ? 'Analyzing...' : 'Evaluate'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Risk gauge */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 flex flex-col items-center">
            <RiskGauge score={result.risk_score} verdict={result.verdict} />
            <div className="mt-4 flex items-center gap-2 text-lg font-semibold">
              <VerdictIcon size={20} />
              <span>{result.verdict} RISK</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 w-full text-center text-xs">
              <div className="bg-gray-800/50 rounded-lg p-2">
                <div className="text-lg font-bold text-orange-400">{result.matched_scams}</div>
                <div className="text-gray-500">Scam matches</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2">
                <div className="text-lg font-bold text-red-400">{result.contradictions}</div>
                <div className="text-gray-500">Contradictions</div>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-2">
                <div className="text-lg font-bold text-purple-400">{result.identity_reuse_count}</div>
                <div className="text-gray-500">ID reuse</div>
              </div>
            </div>
            {/* Report button — memory write-back */}
            {result.risk_score >= 30 && (
              <button
                onClick={handleReport}
                disabled={reported}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-red-800 text-red-400 hover:bg-red-900/30 transition disabled:opacity-50 text-sm"
              >
                <Flag size={14} />
                {reported ? 'Reported — knowledge base updated' : 'Confirm & report this scam'}
              </button>
            )}
          </div>

          {/* Evidence chain */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-lg font-semibold text-white">Evidence Chain</h3>
            {result.evidence_chain.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 text-center text-gray-500">
                No evidence signals detected. This may be a legitimate post.
              </div>
            ) : (
              <div className="space-y-2">
                {result.evidence_chain.map((item, i) => (
                  <EvidenceCard key={i} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
