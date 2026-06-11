import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ShieldCheck } from '@phosphor-icons/react';

function flag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

interface OnboardingProps {
  countries: { code: string; name: string }[];
  onComplete: (name: string, nationality: string) => void;
}

// First-run gate: no account, no tracking — just a name and an origin country
// stored in localStorage so the whole app (greeting, corridors, Kibo context)
// starts personalized. Blocks the app until completed.
export default function Onboarding({ countries, onComplete }: OnboardingProps) {
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState<string | null>(null);

  const ready = name.trim().length > 0 && origin !== null;
  const submit = () => {
    if (ready) onComplete(name.trim(), origin!);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-7 pt-7 pb-5 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg font-bold tracking-tight">Carryover</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
              visa intelligence
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-snug">
            Before we start, two quick things
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Carryover personalizes visa guidance and fraud checks to your
            migration corridor.
          </p>
        </div>

        <div className="px-7 py-5 space-y-5">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              What should we call you?
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Your name"
              maxLength={40}
              className="w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-base outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Where are you from?
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {countries.map((c) => (
                <button
                  key={c.code}
                  onClick={() => setOrigin(c.code)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                    origin === c.code
                      ? 'border-primary bg-primary/10 text-foreground font-medium'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-background'
                  }`}
                >
                  <span className="text-base leading-none">{flag(c.code)}</span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-7 pb-7 pt-1">
          <button
            onClick={submit}
            disabled={!ready}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            Start exploring
            <ArrowRight size={15} weight="bold" />
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-3.5">
            <ShieldCheck size={13} />
            Stored only on this device — no account, no tracking.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
