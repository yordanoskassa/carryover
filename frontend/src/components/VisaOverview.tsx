import { type VisaDestEntry } from '../api';
import { DEST_DATA } from '../data/destinations';

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

interface VisaOverviewProps {
  destinations: VisaDestEntry[];
  selected: string;
  onSelect: (code: string) => void;
  loading?: boolean;
}

export default function VisaOverview({ destinations, selected, onSelect, loading }: VisaOverviewProps) {
  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (destinations.length === 0) {
    return <p className="text-xs text-muted-foreground p-4 text-center">No destinations indexed yet.</p>;
  }

  return (
    <div>
      {destinations.map((entry) => {
        const meta = DEST_DATA[entry.code];
        const isSelected = entry.code === selected;
        return (
          <button
            key={entry.code}
            onClick={() => onSelect(entry.code)}
            className={`w-full text-left px-4 py-3.5 border-b border-border flex items-center gap-3 transition-colors ${
              isSelected
                ? 'bg-primary/10 border-l-2 border-l-primary'
                : 'hover:bg-muted/50 border-l-2 border-l-transparent'
            }`}
          >
            <span className="text-2xl shrink-0">{countryFlag(entry.code)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{entry.name}</div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase">
                {meta?.region || 'INTERNATIONAL'}
              </div>
            </div>
            <span className={`text-sm font-bold font-mono tabular-nums shrink-0 ${
              entry.score >= 65 ? 'text-emerald-400' :
              entry.score >= 45 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {entry.score}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
