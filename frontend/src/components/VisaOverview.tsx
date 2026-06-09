import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

interface VisaEntry {
  code: string;
  name: string;
  score: number;
  label: string;
}

const RESTRICTION_DATA: Record<string, VisaEntry[]> = {
  ET: [
    { code: 'CA', name: 'Canada', score: 62, label: 'Moderate' },
    { code: 'SE', name: 'Sweden', score: 55, label: 'Moderate' },
    { code: 'NL', name: 'Netherlands', score: 50, label: 'Moderate' },
    { code: 'DE', name: 'Germany', score: 48, label: 'Restricted' },
    { code: 'FR', name: 'France', score: 45, label: 'Restricted' },
    { code: 'AU', name: 'Australia', score: 40, label: 'Restricted' },
    { code: 'GB', name: 'United Kingdom', score: 35, label: 'Restricted' },
    { code: 'US', name: 'United States', score: 28, label: 'Restricted' },
  ],
  NG: [
    { code: 'CA', name: 'Canada', score: 58, label: 'Moderate' },
    { code: 'DE', name: 'Germany', score: 50, label: 'Moderate' },
    { code: 'SE', name: 'Sweden', score: 48, label: 'Restricted' },
    { code: 'NL', name: 'Netherlands', score: 45, label: 'Restricted' },
    { code: 'FR', name: 'France', score: 42, label: 'Restricted' },
    { code: 'AU', name: 'Australia', score: 38, label: 'Restricted' },
    { code: 'GB', name: 'United Kingdom', score: 32, label: 'Restricted' },
    { code: 'US', name: 'United States', score: 25, label: 'Restricted' },
  ],
  IN: [
    { code: 'CA', name: 'Canada', score: 70, label: 'Open' },
    { code: 'DE', name: 'Germany', score: 65, label: 'Moderate' },
    { code: 'NL', name: 'Netherlands', score: 60, label: 'Moderate' },
    { code: 'FR', name: 'France', score: 58, label: 'Moderate' },
    { code: 'AU', name: 'Australia', score: 55, label: 'Moderate' },
    { code: 'SE', name: 'Sweden', score: 52, label: 'Moderate' },
    { code: 'GB', name: 'United Kingdom', score: 45, label: 'Restricted' },
    { code: 'US', name: 'United States', score: 40, label: 'Restricted' },
  ],
};

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

interface NewsItem {
  type: 'positive' | 'negative' | 'neutral';
  text: string;
  date: string;
}

const NEWS: NewsItem[] = [
  { type: 'positive', text: 'Canada expands Express Entry for skilled workers from Africa', date: 'Jun 2026' },
  { type: 'negative', text: 'UK raises financial requirements for student visas', date: 'May 2026' },
  { type: 'positive', text: 'Australia launches fast-track visa for healthcare workers', date: 'May 2026' },
  { type: 'neutral', text: 'Germany updates Blue Card salary threshold for 2026', date: 'Apr 2026' },
  { type: 'positive', text: 'Sweden simplifies work permit renewal process', date: 'Apr 2026' },
  { type: 'negative', text: 'France tightens language requirements for long-stay visas', date: 'Mar 2026' },
];

export default function VisaOverview({ nationality }: { nationality: string }) {
  const entries = RESTRICTION_DATA[nationality] || RESTRICTION_DATA['ET'];
  const maxScore = Math.max(...entries.map((e) => e.score));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Visa Openness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visa openness index</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {entries.map((entry) => (
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
          <p className="text-xs text-muted-foreground mt-4">
            Based on visa approval rates, processing times, and documentation requirements.
          </p>
        </CardContent>
      </Card>

      {/* Updates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policy updates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {NEWS.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
              >
                <div className="mt-1.5 shrink-0">
                  {item.type === 'positive' && (
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                  {item.type === 'negative' && (
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                  {item.type === 'neutral' && (
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{item.text}</p>
                  <span className="text-xs text-muted-foreground">{item.date}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
