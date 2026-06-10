import { motion } from 'motion/react';
import { TelegramLogo, Phone, X, ShieldWarning, ShieldCheck } from '@phosphor-icons/react';
import type { ScanAgencyResponse } from '../api';

const verdictColor = (v: string) =>
  v === 'LOW' ? 'text-emerald-400'
    : v === 'MEDIUM' ? 'text-amber-400'
    : 'text-red-400';

export default function AgencyInvestigation({
  data,
  onClose,
}: {
  data: ScanAgencyResponse;
  onClose?: () => void;
}) {
  const risky = data.verdict === 'HIGH' || data.verdict === 'CRITICAL';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b bg-card/50">
        <div className="flex items-center gap-2.5 min-w-0">
          {risky
            ? <ShieldWarning size={22} weight="bold" className="text-red-400 shrink-0" />
            : <ShieldCheck size={22} weight="bold" className="text-emerald-400 shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <TelegramLogo size={14} weight="bold" className="text-primary shrink-0" />
              <h3 className="text-sm font-bold truncate">{data.agency.title}</h3>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground truncate">
              @{data.agency.handle} · {data.posts_scanned} posts scanned · {data.posts_indexed} indexed to Elastic
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-[9px] font-mono text-muted-foreground uppercase">Risk</div>
            <div className={`text-lg font-bold tabular-nums leading-none ${verdictColor(data.verdict)}`}>
              {data.aggregate_risk}
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5" aria-label="Close investigation">
              <X size={15} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {/* Shared identifiers — the ES|QL identity-reuse surface */}
      {data.phones_found.length > 0 && (
        <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1">
            <Phone size={11} /> Reused contacts
          </span>
          {data.phones_found.map((p) => (
            <span key={p} className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">{p}</span>
          ))}
        </div>
      )}

      {/* Posts by risk */}
      <div className="divide-y max-h-[320px] overflow-y-auto">
        {data.posts.map((p, i) => (
          <div key={i} className="px-4 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[11px] font-bold tabular-nums ${verdictColor(p.verdict)}`}>
                {p.risk_score} {p.verdict}
              </span>
              {p.date && <span className="text-[9px] text-muted-foreground font-mono">{p.date.slice(0, 10)}</span>}
            </div>
            <p className="text-[11px] text-foreground/90 leading-snug line-clamp-2">{p.text}</p>
            {p.evidence.map((e, j) => (
              <p key={j} className="text-[10px] text-amber-400/80 mt-1 leading-snug">• {e.description}</p>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
