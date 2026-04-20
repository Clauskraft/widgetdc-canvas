import { useEffect, useMemo, useState } from 'react';
import { graphRead } from '../lib/api';

interface RunOption {
  id: string;
  status: string;
  canonical_pattern: string | null;
  fitness_average: number | null;
  duration_ms: number | null;
  rejection_reason: string | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.low === 'number') return record.low;
  }
  return null;
}

export function DiffViewPane() {
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await graphRead(
        `MATCH (r:PhantomBOMRun)
         RETURN r.id AS id,
                r.status AS status,
                r.canonical_pattern AS canonical_pattern,
                r.fitness_average AS fitness_average,
                r.duration_ms AS duration_ms,
                r.rejection_reason AS rejection_reason
         ORDER BY coalesce(r.completed_at, r.updated_at, r.created_at) DESC
         LIMIT 20`,
      ).catch(() => []);

      if (cancelled) return;
      const mapped = (data as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id ?? ''),
        status: String(row.status ?? 'unknown'),
        canonical_pattern: typeof row.canonical_pattern === 'string' ? row.canonical_pattern : null,
        fitness_average: toNumber(row.fitness_average),
        duration_ms: toNumber(row.duration_ms),
        rejection_reason: typeof row.rejection_reason === 'string' ? row.rejection_reason : null,
      }));
      setRuns(mapped);
      setLeftId(mapped[0]?.id ?? '');
      setRightId(mapped[1]?.id ?? mapped[0]?.id ?? '');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const left = useMemo(() => runs.find((run) => run.id === leftId) ?? null, [leftId, runs]);
  const right = useMemo(() => runs.find((run) => run.id === rightId) ?? null, [rightId, runs]);

  return (
    <div
      className="sc-root"
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        height: '100%',
        minHeight: 0,
        background: '#0c0c0c',
        color: '#e6e6e6',
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <select
          value={leftId}
          onChange={(event) => setLeftId(event.target.value)}
          style={{
            flex: 1,
            background: '#111111',
            border: '1px solid #333333',
            color: '#e6e6e6',
            fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
            fontSize: '12px',
            padding: '8px',
          }}
        >
          {runs.map((run) => (
            <option key={run.id} value={run.id}>{run.id}</option>
          ))}
        </select>
        <select
          value={rightId}
          onChange={(event) => setRightId(event.target.value)}
          style={{
            flex: 1,
            background: '#111111',
            border: '1px solid #333333',
            color: '#e6e6e6',
            fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
            fontSize: '12px',
            padding: '8px',
          }}
        >
          {runs.map((run) => (
            <option key={run.id} value={run.id}>{run.id}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minHeight: 0 }}>
        {[left, right].map((run, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #333333',
              padding: '12px',
              overflowY: 'auto',
              fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
            }}
          >
            {run ? (
              <>
                <div style={{ fontSize: '13px', marginBottom: '8px' }}>{run.id}</div>
                <div style={{ fontSize: '11px', color: '#7a7a7a', marginBottom: '4px' }}>
                  {run.canonical_pattern ?? 'unknown pattern'}
                </div>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>status {run.status}</div>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>fitness {run.fitness_average ?? 'n/a'}</div>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>duration {run.duration_ms ?? 'n/a'} ms</div>
                <div style={{ fontSize: '11px', color: run.rejection_reason ? '#d4a44a' : '#7a7a7a' }}>
                  {run.rejection_reason ?? 'no rejection'}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '11px', color: '#7a7a7a' }}>select two runs</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
