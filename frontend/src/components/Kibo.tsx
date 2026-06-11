import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  CircleNotch, Sparkle, Detective, FileText,
  ShareNetwork, Warning, Phone, FileX, ArrowRight, ChartBar,
  Megaphone, PaperPlaneTilt, CheckCircle, Buildings, CaretDown,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import {
  kiboChat, fileReport,
  type KiboEvent, type KiboAgentId,
  type InspectorCardData, type AdvisorCardData, type ScanAgencyResponse,
  type KiboActionPromptEvent, type ReporterResult,
} from '../api';

interface KiboProps {
  nationality: string;
  destination: string;
  purpose: string;
  onInvestigation?: (data: ScanAgencyResponse) => void;
  onBusyChange?: (busy: boolean) => void;
}

export interface KiboHandle {
  ask: (question: string) => void;
}

type ChatChip = { kind: 'panel_chip'; title: string };
type ChatItem = { kind: 'user'; content: string } | ChatChip | KiboEvent;

const AGENT_META: Record<KiboAgentId, {
  name: string;
  Icon: typeof Detective;
  text: string;
  bg: string;
  border: string;
  dot: string;
}> = {
  inspector: {
    name: 'Inspector',
    Icon: Detective,
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
  advisor: {
    name: 'Advisor',
    Icon: FileText,
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
  },
};

const EVIDENCE_ICONS: Record<string, typeof Warning> = {
  SEMANTIC_MATCH: Warning,
  POLICY_CONTRADICTION: FileX,
  IDENTITY_REUSE: Phone,
};

function verdictClasses(verdict: string) {
  if (verdict === 'CRITICAL' || verdict === 'HIGH') return 'bg-red-500/15 text-red-400';
  if (verdict === 'MEDIUM') return 'bg-amber-500/15 text-amber-400';
  return 'bg-emerald-500/15 text-emerald-400';
}

// Reporter is the action agent — distinct amber accent so it reads as "do",
// not "describe". It isn't a KiboAgentId (no specialist card), so its meta
// lives on its own.
const REPORTER_META = {
  name: 'Reporter',
  text: 'text-amber-400',
  bg: 'bg-amber-500/10',
  border: 'border-amber-500/20',
  dot: 'bg-amber-400',
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ReporterPill({ working }: { working: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${REPORTER_META.bg} ${REPORTER_META.border} ${REPORTER_META.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${REPORTER_META.dot} ${working ? 'animate-pulse' : 'opacity-60'}`} />
      {REPORTER_META.name}
    </span>
  );
}

// The one-click action card. Holds its own state: propose → filing → result.
function ReporterAction({ event }: { event: KiboActionPromptEvent }) {
  const [status, setStatus] = useState<'idle' | 'filing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ReporterResult | null>(null);
  const [showLetter, setShowLetter] = useState(false);

  const run = async () => {
    setStatus('filing');
    try {
      const res = await fileReport(event.payload);
      setResult(res);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg p-2.5 border ${REPORTER_META.border} ${REPORTER_META.bg}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${REPORTER_META.text}`}>
          <Megaphone size={14} weight="bold" /> Reporter
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">action agent</span>
      </div>

      {status !== 'done' && (
        <>
          <p className="text-xs leading-snug text-foreground/90">{event.description}</p>
          <button
            onClick={run}
            disabled={status === 'filing'}
            className={`mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold
              bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-60 transition-colors`}
          >
            {status === 'filing' ? (
              <><CircleNotch size={13} className="animate-spin" /> Filing report & sending complaint…</>
            ) : (
              <><PaperPlaneTilt size={13} weight="bold" /> {event.label}</>
            )}
          </button>
          {status === 'error' && (
            <p className="mt-1.5 text-[11px] text-red-400">Couldn't file right now — the backend may be unreachable.</p>
          )}
          <div className="mt-2 pt-1.5 border-t border-amber-500/15 text-[10px] text-muted-foreground font-mono truncate">
            {event.tools.join(' · ')}
          </div>
        </>
      )}

      {status === 'done' && result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          <p className="text-xs leading-snug text-foreground/90">{result.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {result.filed && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle size={11} weight="fill" /> Warning filed to Elastic
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${result.delivery.delivered ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {result.delivery.delivered ? <CheckCircle size={11} weight="fill" /> : <PaperPlaneTilt size={11} />}
              {result.delivery.delivered ? 'Complaint sent' : 'Complaint drafted'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Buildings size={12} className={REPORTER_META.text} />
            <span className="truncate">To: {result.complaint.to_authority}</span>
          </div>

          <button
            onClick={() => setShowLetter((s) => !s)}
            className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:underline"
          >
            <CaretDown size={11} className={`transition-transform ${showLetter ? 'rotate-180' : ''}`} />
            {showLetter ? 'Hide complaint' : 'View complaint'}
          </button>
          {showLetter && (
            <div className="rounded-md bg-background/60 border border-amber-500/15 p-2 space-y-1">
              <p className="text-[11px] font-semibold text-foreground/90">{result.complaint.subject}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{result.complaint.body}</p>
              {result.complaint.authority_portal && (
                <a
                  href={result.complaint.authority_portal}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:underline"
                >
                  File directly with {result.complaint.to_authority} <ArrowRight size={10} />
                </a>
              )}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">{result.delivery.detail}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

function AgentPill({ agent, working }: { agent: KiboAgentId; working: boolean }) {
  const meta = AGENT_META[agent];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${meta.bg} ${meta.border} ${meta.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${working ? 'animate-pulse' : 'opacity-60'}`} />
      {meta.name}
    </span>
  );
}

function HandoffRow({ agents, reason }: { agents: KiboAgentId[]; reason: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 pl-2 py-1 border-l-2 border-primary/50 text-xs text-muted-foreground"
    >
      <ShareNetwork size={13} className="text-primary mt-0.5 shrink-0" />
      <span>
        Kibo routed this to{' '}
        {agents.map((a, i) => (
          <span key={a}>
            <span className={`font-semibold ${AGENT_META[a].text}`}>{AGENT_META[a].name}</span>
            {i < agents.length - 1 ? ' and ' : ''}
          </span>
        ))}
        {reason ? <span className="block text-[11px] opacity-70 mt-0.5">{reason}</span> : null}
      </span>
    </motion.div>
  );
}

function InspectorCard({ data, tools }: { data: InspectorCardData; tools: string[] }) {
  const meta = AGENT_META.inspector;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border rounded-lg p-2.5"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${meta.text}`}>
          <meta.Icon size={14} weight="bold" /> Inspector
        </span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${verdictClasses(data.verdict)}`}>
          Risk {data.risk_score}/100 · {data.verdict}
        </span>
      </div>
      <div className="space-y-1.5">
        {data.evidence_chain.slice(0, 3).map((e, i) => {
          const Icon = EVIDENCE_ICONS[e.type] ?? Warning;
          return (
            <div key={i} className="flex items-start gap-1.5 text-xs leading-snug text-foreground/90">
              <Icon size={13} className={`${meta.text} mt-0.5 shrink-0`} />
              <span>{e.description}</span>
            </div>
          );
        })}
        {data.evidence_chain.length === 0 && (
          <p className="text-xs text-muted-foreground">No fraud signals matched in the scam database.</p>
        )}
      </div>
      <div className="mt-2 pt-1.5 border-t text-[10px] text-muted-foreground font-mono truncate">
        {tools.join(' · ')}
      </div>
    </motion.div>
  );
}

function AdvisorCard({ data, tools }: { data: AdvisorCardData; tools: string[] }) {
  const meta = AGENT_META.advisor;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border rounded-lg p-2.5"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${meta.text}`}>
          <meta.Icon size={14} weight="bold" /> Advisor
        </span>
        {data.source_name && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[45%]">
            {data.source_name} · official source
          </span>
        )}
      </div>
      {data.visa_name ? (
        <>
          <p className="text-xs font-semibold text-foreground">{data.visa_name}</p>
          {(data.fee || data.processing_time) && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {data.fee && <>Fee {data.fee}</>}
              {data.fee && data.processing_time && ' · '}
              {data.processing_time && <>{data.processing_time}</>}
            </p>
          )}
          {data.requirements.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {data.requirements.map((r, i) => (
                <li key={i} className="text-xs leading-snug text-foreground/90 flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">✓</span><span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No official policy indexed for this route yet.</p>
      )}
      <div className="mt-2 pt-1.5 border-t text-[10px] text-muted-foreground font-mono truncate">
        {tools.join(' · ')}
      </div>
    </motion.div>
  );
}

const Kibo = forwardRef<KiboHandle, KiboProps>(function Kibo(
  { nationality, destination, purpose, onInvestigation, onBusyChange }, ref,
) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingAgents, setWorkingAgents] = useState<KiboAgentId[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, workingAgents]);

  useImperativeHandle(ref, () => ({ ask: (q: string) => { void send(q); } }));

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    setItems((prev) => [...prev, { kind: 'user', content: q }]);
    setLoading(true);
    onBusyChange?.(true);

    try {
      const res = await kiboChat(q, { nationality, destination, purpose });
      for (const event of res.events) {
        if (event.kind === 'handoff') {
          setWorkingAgents(event.agents);
          setItems((prev) => [...prev, event]);
          await delay(500);
        } else if (event.kind === 'agent_card') {
          setItems((prev) => [...prev, event]);
          setWorkingAgents((prev) => prev.filter((a) => a !== event.agent));
          await delay(450);
        } else if (event.kind === 'scan_result') {
          // Heavy result goes to the dashboard panel, not the chat —
          // leave only a slim chip behind.
          onInvestigation?.(event.data);
          setItems((prev) => [...prev, { kind: 'panel_chip', title: event.data.agency.title }]);
          setWorkingAgents([]);
          await delay(300);
        } else {
          setWorkingAgents([]);
          setItems((prev) => [...prev, event]);
        }
      }
    } catch {
      setItems((prev) => [...prev, {
        kind: 'kibo',
        content: 'Connection error. The backend may not be running or the agents aren\'t configured yet.',
        engine: 'elastic-fallback',
      }]);
    } finally {
      setWorkingAgents([]);
      setLoading(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header: orchestrator + agent roster */}
      <div className="px-3 py-2.5 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Sparkle size={12} weight="fill" className="text-primary" />
          </div>
          <div className="truncate">
            <span className="text-sm font-bold">Kibo</span>
            <span className="text-[11px] text-muted-foreground ml-1.5 font-mono">ORCHESTRATOR</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <AgentPill agent="inspector" working={workingAgents.includes('inspector')} />
          <AgentPill agent="advisor" working={workingAgents.includes('advisor')} />
          <ReporterPill working={false} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 mx-auto w-full max-w-[660px]">
        {items.map((item, i) => {
          if (item.kind === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed bg-primary text-primary-foreground">
                  {item.content}
                </div>
              </div>
            );
          }
          if (item.kind === 'handoff') {
            return <HandoffRow key={i} agents={item.agents} reason={item.reason} />;
          }
          if (item.kind === 'panel_chip') {
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1.5"
              >
                <ChartBar size={13} weight="bold" />
                <span className="font-medium truncate">{item.title}</span>
                <span className="text-muted-foreground">opened in dashboard →</span>
              </motion.div>
            );
          }
          if (item.kind === 'agent_card') {
            if (item.error || !item.data) {
              return (
                <div key={i} className="bg-card border rounded-lg p-2.5 text-xs text-muted-foreground">
                  <span className={`font-bold ${AGENT_META[item.agent].text}`}>{AGENT_META[item.agent].name}</span>
                  {' '}— {item.error ?? 'No data returned.'}
                </div>
              );
            }
            return item.agent === 'inspector'
              ? <InspectorCard key={i} data={item.data as InspectorCardData} tools={item.tools} />
              : <AdvisorCard key={i} data={item.data as AdvisorCardData} tools={item.tools} />;
          }
          if (item.kind === 'action_prompt') {
            return <ReporterAction key={i} event={item} />;
          }
          if (item.kind === 'kibo') {
            return (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkle size={10} weight="fill" className="text-primary" />
                </div>
                <div className="max-w-[88%] rounded-lg px-3 py-2 text-xs leading-relaxed bg-muted text-foreground">
                  {item.content}
                  {item.engine === 'gemini' && (
                    <span className="block text-[10px] text-muted-foreground font-mono mt-1">synthesized by Gemini</span>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })}
        {loading && workingAgents.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <CircleNotch size={12} className="animate-spin" />
              {workingAgents.map((a) => AGENT_META[a].name).join(' and ')} working
              <ArrowRight size={10} className="opacity-50" />
              searching Elastic
            </div>
          </div>
        )}
        {loading && workingAgents.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <CircleNotch size={12} className="animate-spin" /> Kibo is routing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

    </div>
  );
});

export default Kibo;
