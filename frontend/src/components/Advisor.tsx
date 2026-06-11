import { useState, useEffect } from 'react';
import { getStructuredPolicy, type StructuredPolicy } from '../api';
import PolicyCard from './PolicyCard';

const PURPOSES = ['student', 'work', 'family', 'tourist'];

interface AdvisorProps {
  nationality: string;
  destination: string;
}

export default function Advisor({ nationality, destination }: AdvisorProps) {
  const [purpose, setPurpose] = useState('student');
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<StructuredPolicy | null>(null);

  useEffect(() => {
    setLoading(true);
    setPolicy(null);
    getStructuredPolicy(nationality, destination, purpose)
      .then(setPolicy)
      .catch(() => setPolicy(null))
      .finally(() => setLoading(false));
  }, [nationality, destination, purpose]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Visa Requirements · {nationality}→{destination}
        </h3>
        <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
          {PURPOSES.map((p) => (
            <button
              key={p}
              onClick={() => setPurpose(p)}
              className={`px-2.5 py-1 capitalize transition-colors ${
                purpose === p ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <PolicyCard policy={policy} loading={loading} />
    </div>
  );
}
