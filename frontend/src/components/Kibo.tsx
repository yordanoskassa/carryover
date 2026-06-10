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
  const top = data.requirements.slice(0, 2);
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
        {top[0]?.source_name && (
          <span className="text-[9px] text-muted-foreground truncate max-w-[45%]">
            {top[0].source_name} · official source
          </span>
        )}
      </div>
      <div className="space-y-2">
        {top.map((r, i) => (
          <div key={i} className="text-[11px] leading-snug text-foreground/90">
            <p>{r.requirement_text}</p>
            {(r.fee_usd != null || r.processing_days != null) && (
              <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                {r.fee_usd != null && <>Fee ${Math.round(r.fee_usd)}</>}
                {r.fee_usd != null && r.processing_days != null && ' · '}
                {r.processing_days != null && <>~{r.processing_days} days processing</>}
              </p>
            )}
          </div>
        ))}
        {top.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No official policy indexed for this route yet.</p>
        )}
      </div>
      <div className="mt-2 pt-1.5 border-t text-[9px] text-muted-foreground font-mono truncate">
        {tools.join(' · ')}
      </div>
    </motion.div>
  );
}

export default function Kibo({ nationality, destination, purpose, onInvestigation }: KiboProps) {
  const [items, setItems] = useState<ChatItem[]>([
    {
      kind: 'kibo',
      content: 'I\'m Kibo. I coordinate a team of agents — Inspector checks agencies for fraud, Advisor pulls official visa policy. Give me an agency handle like @someagency and I\'ll scan it, or ask me anything.',
      engine: 'elastic-fallback',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [workingAgents, setWorkingAgents] = useState<KiboAgentId[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items, workingAgents]);

  const send = async () => {
    const q = input.trim();
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
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

      {/* Input */}
      <div className="p-2 border-t">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-center gap-1.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask, or drop an @agency handle..."
            disabled={loading}
            className="flex-1 h-8 rounded-lg border border-input bg-card px-3 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
          >
            <PaperPlaneRight size={14} weight="bold" />
          </button>
        </form>
        <p className="text-[9px] text-muted-foreground mt-1 font-mono text-center">
          Context: {nationality}→{destination} · {purpose}
        </p>
      </div>
    </div>
  );
}
