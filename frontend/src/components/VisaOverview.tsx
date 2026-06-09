import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getVisaOverview, type VisaOverviewData } from '../api';

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

function getBarColor(score: number): string {
  if (score >= 65) return 'bg-emerald-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

function getLabelColor(score: number): string {
  if (score >= 65) return 'text-emerald-700';
  if (score >= 45) return 'text-amber-700';
  return 'text-red-700';
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-muted rounded-lg animate-pulse ${className}`} />;
}

export default function VisaOverview({ nationality }: { nationality: string }) {
  const [data, setData] = useState<VisaOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getVisaOverview(nationality)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [nationality]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-5 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonBlock className="w-8 h-5" />
                <SkeletonBlock className="w-24 h-4" />
                <SkeletonBlock className="flex-1 h-2.5" />
                <SkeletonBlock className="w-16 h-4" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
        {error || 'No data available'}
      </div>
    );
  }

  const maxScore = Math.max(...data.destinations.map((e) => e.score), 1);
  const hasUpdates = data.policy_updates.length > 0 || data.crawled_sources.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Visa Openness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visa openness index</CardTitle>
        </CardHeader>
        <CardContent>
          {data.destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No visa data indexed for this nationality yet.
            </p>
          ) : (
            <div className="space-y-3">
              {data.destinations.map((entry) => (
                <div key={entry.code} className="flex items-center gap-3">
                  <span className="text-base leading-none w-8 shrink-0">{countryFlag(entry.code)}</span>
                  <span className="text-sm w-24 shrink-0 truncate">{entry.name}</span>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getBarColor(entry.score)}`}
                      style={{ width: `${(entry.score / maxScore) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium w-16 text-right ${getLabelColor(entry.score)}`}>
                    {entry.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Based on {data.destinations.reduce((sum, d) => sum + d.policy_count, 0)} indexed policies
            and {data.destinations.reduce((sum, d) => sum + d.scam_reports, 0)} scam reports from Elasticsearch.
          </p>
        </CardContent>
      </Card>

      {/* Updates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy updates</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasUpdates ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No policy changes detected yet. Updates appear when crawled sources change.
            </p>
          ) : (
            <div className="space-y-1">
              {/* Policy changes from policy-history index */}
              {data.policy_updates.map((item, i) => (
                <div
                  key={`policy-${i}`}
                  className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
                >
                  <div className="mt-1.5 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">
                      <span className="font-medium">{item.route}</span>
                      {item.diff_summary ? ` - ${item.diff_summary}` : ''}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {item.snapshot_date ? new Date(item.snapshot_date).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
              ))}

              {/* Crawled source updates */}
              {data.crawled_sources.map((item, i) => (
                <div
                  key={`crawled-${i}`}
                  className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
                >
                  <div className="mt-1.5 shrink-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{item.title || item.host}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{item.host}</span>
                      {item.crawled_at && (
                        <span className="text-xs text-muted-foreground">
                          Crawled {new Date(item.crawled_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
