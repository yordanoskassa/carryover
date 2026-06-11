import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from '@phosphor-icons/react';

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
        <div className="px-7 py-6 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">Carryover</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border rounded-full px-2 py-0.5">
              visa intelligence
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Name
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
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Choose an origin country
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Corridors most targeted by visa-agency scams.
            </p>
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

          <button
            onClick={submit}
            disabled={!ready}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
          >
            Start
            <ArrowRight size={15} weight="bold" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
