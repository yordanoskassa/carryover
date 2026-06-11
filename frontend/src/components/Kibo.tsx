import { useState, useRef, useEffect } from 'react';
import {
  PaperPlaneRight, CircleNotch, Sparkle, Detective, FileText,
  ShareNetwork, Warning, Phone, FileX, ArrowRight, ChartBar,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import {
  kiboChat,
  type KiboEvent, type KiboAgentId,
  type InspectorCardData, type AdvisorCardData, type ScanAgencyResponse,
} from '../api';

interface KiboProps {
  nationality: string;
  destination: string;
  purpose: string;
  onInvestigation?: (data: ScanAgencyResponse) => void;
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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function AgentPill({ agent, working }: { agent: KiboAgentId; working: boolean }) {
  const meta = AGENT_META[agent];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border ${meta.bg} ${meta.border} ${meta.text}`}>
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
      className="flex items-start gap-2 pl-2 py-1 border-l-2 border-primary/50 text-[11px] text-muted-foreground"
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
        {reason ? <span className="block text-[10px] opacity-70 mt-0.5">{reason}</span> : null}
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
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${meta.text}`}>
          <meta.Icon size={14} weight="bold" /> Inspector
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${verdictClasses(data.verdict)}`}>
          Risk {data.risk_score}/100 · {data.verdict}
        </span>
      </div>
      <div className="space-y-1.5">
        {data.evidence_chain.slice(0, 3).map((e, i) => {
          const Icon = EVIDENCE_ICONS[e.type] ?? Warning;
          return (
            <div key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-foreground/90">
              <Icon size={13} className={`${meta.text} mt-0.5 shrink-0`} />
              <span>{e.description}</span>
            </div>
          );
        })}
        {data.evidence_chain.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No fraud signals matched in the scam database.</p>
        )}
      </div>
      <div className="mt-2 pt-1.5 border-t text-[9px] text-muted-foreground font-mono truncate">
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
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${meta.text}`}>
          <meta.Icon size={14} weight="bold" /> Advisor
        </span>
        {data.source_name && (
          <span className="text-[9px] text-muted-foreground truncate max-w-[45%]">
            {data.source_name} · official source
          </span>
        )}
      </div>
      {data.visa_name ? (
        <>
          <p className="text-[11px] font-semibold text-foreground">{data.visa_name}</p>
          {(data.fee || data.processing_time) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {data.fee && <>Fee {data.fee}</>}
              {data.fee && data.processing_time && ' · '}
              {data.processing_time && <>{data.processing_time}</>}
            </p>
          )}
          {data.requirements.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {data.requirements.map((r, i) => (
                <li key={i} className="text-[11px] leading-snug text-foreground/90 flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5">✓</span><span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">No official policy indexed for this route yet.</p>
      )}
      <div className="mt-2 pt-1.5 border-t text-[9px] text-muted-foreground font-mono truncate">
        {tools.join(' · ')}
      </div>
    </motion.div>
  );
}

const SUGGESTIONS = [
  'What do I need for a UK student visa?',
  'Check @gloryconsultancy',
  'Is a guaranteed 5-day visa real?',
];

export default function Kibo({ nationality, destination, purpose, onInvestigation }: KiboProps) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [workingAgents, setWorkingAgents] = useState<KiboAgentId[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const started = items.some((i) => i.kind === 'user');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, workingAgents]);

  const send = async (override?: string) => {
    const q = (override ?? input).trim();
    if (!q || loading) return;

    setItems((prev) => [...prev, { kind: 'user', content: q }]);
    setInput('');
    setLoading(true);

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
            <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">ORCHESTRATOR</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <AgentPill agent="inspector" working={workingAgents.includes('inspector')} />
          <AgentPill agent="advisor" working={workingAgents.includes('advisor')} />
        </div>
      </div>

      {!started ? (
        /* Empty state: floating centered composer */
        <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
            <Sparkle size={26} weight="fill" className="text-primary" />
          </div>
          <h2 className="text-lg font-bold text-center">How can I help you migrate safely?</h2>
          <p className="text-xs text-muted-foreground text-center mt-2 max-w-[380px] leading-relaxed">
            I coordinate Inspector (fraud checks) and Advisor (official policy). Ask anything, or drop an{' '}
            <span className="text-primary font-medium">@agency</span> handle and I'll scan it.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="w-full max-w-[480px] mt-7 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Kibo, or drop an @agency handle..."
              disabled={loading}
              autoFocus
              className="flex-1 h-12 rounded-xl border border-input bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring shadow-sm"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
            >
              <PaperPlaneRight size={18} weight="bold" />
            </button>
          </form>
          <div className="flex flex-wrap gap-2 justify-center mt-4 max-w-[480px]">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={loading}
                className="text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mt-7">
            Context: {nationality}→{destination} · {purpose}
          </p>
        </div>
      ) : (
      <>
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
                className="flex items-center gap-1.5 text-[11px] text-primary bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1.5"
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
                <div key={i} className="bg-card border rounded-lg p-2.5 text-[11px] text-muted-foreground">
                  <span className={`font-bold ${AGENT_META[item.agent].text}`}>{AGENT_META[item.agent].name}</span>
                  {' '}— {item.error ?? 'No data returned.'}
                </div>
              );
            }
            return item.agent === 'inspector'
              ? <InspectorCard key={i} data={item.data as InspectorCardData} tools={item.tools} />
              : <AdvisorCard key={i} data={item.data as AdvisorCardData} tools={item.tools} />;
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
                    <span className="block text-[9px] text-muted-foreground font-mono mt-1">synthesized by Gemini</span>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })}
        {loading && workingAgents.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CircleNotch size={12} className="animate-spin" />
              {workingAgents.map((a) => AGENT_META[a].name).join(' and ')} working
              <ArrowRight size={10} className="opacity-50" />
              searching Elastic
            </div>
          </div>
        )}
        {loading && workingAgents.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <CircleNotch size={12} className="animate-spin" /> Kibo is routing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input docked (follow-up) */}
      <div className="p-3 border-t">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-center gap-2 mx-auto w-full max-w-[660px]"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up, or drop an @agency handle..."
            disabled={loading}
            className="flex-1 h-10 rounded-xl border border-input bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
          >
            <PaperPlaneRight size={16} weight="bold" />
          </button>
        </form>
        <p className="text-[9px] text-muted-foreground mt-1.5 font-mono text-center">
          Context: {nationality}→{destination} · {purpose}
        </p>
      </div>
      </>
      )}
    </div>
  );
}
