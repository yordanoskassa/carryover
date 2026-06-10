import { useEffect, useState } from 'react';
import { getVisaNews, getVisaOverview, type NewsItem } from '../api';

function toneDot(tone: string): string {
  if (tone === 'warning') return 'bg-red-500';
  if (tone === 'good') return 'bg-emerald-500';
  return 'bg-amber-500';
}

interface TickerEntry {
  text: string;
  dot: string;
  url?: string;
  source?: string;
}

export default function NewsTicker({ nationality }: { nationality: string }) {
  const [items, setItems] = useState<TickerEntry[]>([]);

  useEffect(() => {
    // Primary: real visa-news headlines indexed in Elastic.
    getVisaNews()
      .then((data) => {
        if (data.items && data.items.length > 0) {
          setItems(data.items.map((n: NewsItem) => ({
            text: n.title,
            source: n.source,
            url: n.url,
            dot: toneDot(n.tone),
          })));
        } else {
          throw new Error('no news');
        }
      })
      .catch(() => {
        // Fallback: policy updates from the corridor overview.
        getVisaOverview(nationality)
          .then((data) => {
            const entries: TickerEntry[] = [];
            for (const p of data.policy_updates) {
              const text = `${p.route || ''}${p.diff_summary ? ' - ' + p.diff_summary : ''}`;
              if (text.trim()) entries.push({ text, dot: 'bg-amber-500' });
            }
            setItems(entries.length ? entries : [{ text: 'No recent policy updates', dot: 'bg-zinc-400' }]);
          })
          .catch(() => setItems([{ text: 'Unable to load updates', dot: 'bg-zinc-400' }]));
      });
  }, [nationality]);

  if (items.length === 0) return null;

  const content = items.map((item, i) => {
    const inner = (
      <>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.dot}`} />
        <span>{item.text}</span>
        {item.source && <span className="text-foreground/50">· {item.source}</span>}
      </>
    );
    return item.url ? (
      <a key={i} href={item.url} target="_blank" rel="noopener"
         className="inline-flex items-center gap-1.5 mx-4 hover:text-foreground transition-colors">
        {inner}
      </a>
    ) : (
      <span key={i} className="inline-flex items-center gap-1.5 mx-4">{inner}</span>
    );
  });

  return (
    <div className="h-7 bg-card/50 border-b text-muted-foreground text-xs font-mono flex items-center overflow-hidden">
      <div className="ticker-track">
        {content}
        {content}
      </div>
    </div>
  );
}
