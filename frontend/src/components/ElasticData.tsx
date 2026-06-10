import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Database, Sparkle, CircleNotch, Stack } from '@phosphor-icons/react';
import { getElasticOverview, type ElasticOverview } from '../api';

export default function ElasticData() {
  const [data, setData] = useState<ElasticOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getElasticOverview().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <CircleNotch size={16} className="animate-spin" /> Loading Elasticsearch indices...
      </div>
    );
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground p-6">Couldn't reach Elasticsearch.</p>;
  }

  const b = data.structured_breakdown;

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4">
      {/* Headline */}
      <div className="flex items-center justify-between border rounded-lg p-4 bg-card/40">
        <div className="flex items-center gap-3">
          <Database size={28} weight="bold" className="text-primary" />
          <div>
            <div className="text-2xl font-bold tabular-nums leading-none">{data.total_docs.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">documents indexed in Elasticsearch</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground font-mono">
          <div>{data.indices.length} indices</div>
          <div>{data.indices.filter((i) => i.semantic).length} ELSER-backed</div>
        </div>
      </div>

      {/* Index cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {data.indices.map((idx, i) => (
          <motion.div
            key={idx.index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="border rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <Stack size={14} className="text-primary shrink-0" />
                <span className="text-sm font-semibold truncate">{idx.label}</span>
                {idx.semantic && (
                  <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">ELSER</span>
                )}
              </div>
              <span className="text-base font-bold tabular-nums shrink-0">{idx.doc_count.toLocaleString()}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">{idx.description}</p>
            <p className="text-[10px] font-mono text-muted-foreground/70 mt-1.5 truncate">
              {idx.index} · {idx.source}
            </p>
          </motion.div>
        ))}
      </div>

      {/* How structured policies were produced */}
      <div className="border rounded-lg p-3">
        <h4 className="text-[10px] font-mono font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
          <Sparkle size={11} weight="fill" className="text-primary" /> Structured policies — by source
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Firecrawl', value: b.firecrawl, hint: 'gap pages' },
            { label: 'Gemini', value: b.gemini, hint: 'crawl + structure' },
            { label: 'Grounded', value: b.grounded, hint: 'Google Search fill' },
          ].map((s) => (
            <div key={s.label} className="bg-muted rounded-md p-2 text-center">
              <div className="text-lg font-bold tabular-nums">{s.value}</div>
              <div className="text-[10px] font-medium">{s.label}</div>
              <div className="text-[9px] text-muted-foreground">{s.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
