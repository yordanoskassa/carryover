import { useEffect, useState } from 'react';
import { getVisaOverview, type VisaOverviewData } from '../api';

function dotColor(type: 'policy' | 'source', text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('raise') || lower.includes('suspend') || lower.includes('close') || lower.includes('reject'))
    return 'bg-red-500';
  if (lower.includes('open') || lower.includes('new') || lower.includes('fast') || lower.includes('launch'))
    return 'bg-emerald-500';
  return type === 'policy' ? 'bg-amber-500' : 'bg-emerald-500';
}

export default function NewsTicker({ nationality }: { nationality: string }) {
  const [items, setItems] = useState<{ text: string; dot: string }[]>([]);

  useEffect(() => {
    getVisaOverview(nationality)
      .then((data: VisaOverviewData) => {
        const entries: { text: string; dot: string }[] = [];
        for (const p of data.policy_updates) {
          const text = `${p.route || ''}${p.diff_summary ? ' - ' + p.diff_summary : ''}`;
          if (text.trim()) entries.push({ text, dot: dotColor('policy', text) });
        }
        for (const s of data.crawled_sources) {
          const text = s.title || s.host;
          if (text) entries.push({ text, dot: dotColor('source', text) });
        }
        if (entries.length === 0) {
          entries.push({ text: 'No recent policy updates', dot: 'bg-zinc-400' });
        }
        setItems(entries);
      })
      .catch(() => {
        setItems([{ text: 'Unable to load updates', dot: 'bg-zinc-400' }]);
      });
  }, [nationality]);

  if (items.length === 0) return null;

  const content = items.map((item, i) => (
    <span key={i} className="inline-flex items-center gap-1.5 mx-4">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
      <span>{item.text}</span>
    </span>
  ));

  return (
    <div className="h-7 bg-card/50 border-b text-muted-foreground text-xs font-mono flex items-center overflow-hidden">
      <div className="ticker-track">
        {content}
        {content}
      </div>
    </div>
  );
}
