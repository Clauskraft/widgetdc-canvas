import { useEffect, useState } from 'react';
import { graphRead } from '../lib/api';
import { useCanvasSession } from '../state/canvasSession';

interface TimelineRow {
  id: string;
  status: string;
  track: string | null;
  fitness_average: number | null;
  duration_ms: number | null;
  rejection_reason: string | null;
  completed_at: string | null;
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

export function TimelinePane() {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const switchPane = useCanvasSession((s) => s.switchPane);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await graphRead(
        `MATCH (r:PhantomBOMRun)
         RETURN r.id AS id,
                r.status AS status,
                r.track AS track,
                r.fitness_average AS fitness_average,
                r.duration_ms AS duration_ms,
                r.rejection_reason AS rejection_reason,
                toString(coalesce(r.completed_at, r.updated_at, r.created_at)) AS completed_at
         ORDER BY coalesce(r.completed_at, r.updated_at, r.created_at) DESC
         LIMIT 50`,
      ).catch(() => []);
      if (cancelled) return;
      setRows((data as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id ?? ''),
        status: String(row.status ?? 'unknown'),
        track: typeof row.track === 'string' ? row.track : null,
        fitness_average: toNumber(row.fitness_average),
        duration_ms: toNumber(row.duration_ms),
        rejection_reason: typeof row.rejection_reason === 'string' ? row.rejection_reason : null,
        completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
      })));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const filtered = rows.filter((row) =>
    `${row.id} ${row.track ?? ''} ${row.rejection_reason ?? ''} ${row.status}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className="sc-root"
      style={{
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        background: '#0c0c0c',
        color: '#e6e6e6',
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
          Timeline scrubber
        </div>
        <button type="button" onClick={() => switchPane('diff')} className="sc-button">
          open diff
        </button>
      </div>
      <div className="sc-grid-three" style={{ marginBottom: '12px' }}>
        <div className="sc-kpi"><span className="sc-kpi-label">runs</span><span className="sc-kpi-value">{rows.length}</span></div>
        <div className="sc-kpi"><span className="sc-kpi-label">visible</span><span className="sc-kpi-value">{filtered.length}</span></div>
        <div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="filter id · track · failure" className="sc-input" /></div>
      </div>
      {loading ? (
        <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a' }}>
          loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="sc-empty">
          <div>No runs match the current filter.</div>
          <div>Clear the query to bring the run stream back.</div>
        </div>
      ) : (
        filtered.map((row) => (
          <div
            key={row.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2.2fr 0.8fr 0.8fr 0.8fr 1.2fr',
              gap: '10px',
              borderBottom: '1px solid #333333',
              padding: '8px 0',
              fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
              fontSize: '11px',
            }}
          >
            <span>{row.id}</span>
            <span>{row.track ?? 'n/a'}</span>
            <span>{row.fitness_average ?? 'n/a'}</span>
            <span>{row.duration_ms ?? 'n/a'} ms</span>
            <span style={{ color: row.rejection_reason ? '#d4a44a' : '#7a7a7a' }}>
              {row.rejection_reason ?? row.status}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
