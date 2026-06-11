import { motion } from 'motion/react';
import {
  LinkSimple, CircleNotch, Sparkle,
  CheckCircle, FileText, ListNumbers,
} from '@phosphor-icons/react';
import type { StructuredPolicy } from '../api';

export default function PolicyCard({
  policy,
  loading,
}: {
  policy: StructuredPolicy | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <CircleNotch size={16} className="animate-spin" /> Structuring policy with Gemini...
      </div>
    );
  }
  if (!policy || !policy.found) {
    return <p className="text-sm text-muted-foreground py-2">No official policy indexed for this route yet.</p>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="border rounded-lg overflow-hidden"
    >
      {/* Header: visa name + AI badge */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b bg-card/50">
        <h4 className="text-sm font-bold truncate">{policy.visa_name || 'Visa requirements'}</h4>
        {policy.ai_structured && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
            <Sparkle size={9} weight="fill" /> structured by Gemini
          </span>
        )}
      </div>

      {/* Source row — fee & processing live in the country stats grid above,
          so the card only adds what's unique: where this policy comes from. */}
      <div className="px-4 py-2 border-b flex items-center gap-1.5 min-w-0">
        <LinkSimple size={14} className="text-primary shrink-0" />
        <span className="text-[10px] font-mono text-muted-foreground uppercase shrink-0">Source</span>
        {policy.source_url ? (
          <a href={policy.source_url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline truncate">
            {policy.source_name || 'Official'}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground truncate">{policy.source_name || 'N/A'}</span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {policy.summary && <p className="text-sm leading-relaxed">{policy.summary}</p>}

        {policy.key_requirements.length > 0 && (
          <div>
            <h5 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase mb-1.5">Requirements</h5>
            <ul className="space-y-1">
              {policy.key_requirements.map((r, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <CheckCircle size={14} weight="fill" className="text-emerald-500 mt-0.5 shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {policy.documents.length > 0 && (
          <div>
            <h5 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <FileText size={11} /> Documents needed
            </h5>
            <div className="flex flex-wrap gap-1.5">
              {policy.documents.map((d, i) => (
                <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded text-foreground/90">{d}</span>
              ))}
            </div>
          </div>
        )}

        {policy.steps.length > 0 && (
          <div>
            <h5 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
              <ListNumbers size={11} /> How to apply
            </h5>
            <ol className="space-y-1">
              {policy.steps.map((s, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </motion.div>
  );
}
