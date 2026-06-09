import { useState, useRef, useEffect } from 'react';
import { PaperPlaneRight, CircleNotch, Sparkle } from '@phosphor-icons/react';
import { chatWithKibo, type KiboMessage } from '../api';

interface KiboProps {
  nationality: string;
  destination: string;
  purpose: string;
}

export default function Kibo({ nationality, destination, purpose }: KiboProps) {
  const [messages, setMessages] = useState<KiboMessage[]>([
    { role: 'kibo', content: 'I\'m Kibo, your visa intelligence assistant. I have context on every destination, visa type, policy, and scam pattern. Ask me anything.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await chatWithKibo(q, { nationality, destination, purpose });
      const reply = res.output || res.reply || 'I couldn\'t get an answer right now. Try rephrasing your question.';
      setMessages((prev) => [...prev, { role: 'kibo', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'kibo', content: 'Connection error. The backend may not be running or the agent isn\'t configured yet.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkle size={12} weight="fill" className="text-primary" />
        </div>
        <div>
          <span className="text-sm font-bold">Kibo</span>
          <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">AI AGENT</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <CircleNotch size={12} className="animate-spin" /> Thinking...
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
            placeholder="Ask Kibo anything..."
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
