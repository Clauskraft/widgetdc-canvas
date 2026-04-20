import { useEffect, useState } from 'react';
import { graphRead } from '../lib/api';

interface PatternRow {
  id: string;
  name: string;
  summary: string | null;
  source: string | null;
  observed_count: number | null;
  fitness_avg: number | null;
  last_audited: string | null;
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

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value;
  return null;
}

export function PatternPalettePane() {
  const [rows, setRows] = useState<PatternRow[]>([]);
  const [selected, setSelected] = useState<PatternRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await graphRead(
        `MATCH (p:Pattern)
         OPTIONAL MATCH (p)<-[obs:EXTRACTED_PATTERN]-(:HandoverRetrospective)
         RETURN p.id AS id,
                coalesce(p.name, p.title, p.id) AS name,
                coalesce(p.summary, p.semantic_summary) AS summary,
                p.source AS source,
                count(obs) AS observed_count,
                p.fitness_avg AS fitness_avg,
                toString(p.last_audited) AS last_audited
         ORDER BY coalesce(p.last_audited, datetime('1970-01-01T00:00:00Z')) DESC
         LIMIT 400`,
      ).catch(() => []);

      if (cancelled) return;
      const mapped = (data as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id ?? ''),
        name: String(row.name ?? row.id ?? ''),
        summary: toStringValue(row.summary),
        source: toStringValue(row.source),
        observed_count: toNumber(row.observed_count),
        fitness_avg: toNumber(row.fitness_avg),
        last_audited: toStringValue(row.last_audited),
      }));
      setRows(mapped);
      setSelected(mapped[0] ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sources = ['all', ...new Set(rows.map((row) => row.source ?? 'unknown'))];
  const filtered = rows.filter((row) => {
    const haystack = `${row.name} ${row.summary ?? ''} ${row.source ?? ''}`.toLowerCase();
    const queryMatch = haystack.includes(query.toLowerCase());
    const sourceMatch = sourceFilter === 'all' || (row.source ?? 'unknown') === sourceFilter;
    return queryMatch && sourceMatch;
  });

  return (
    <div
      className="sc-root"
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr 1fr',
        height: '100%',
        minHeight: 0,
        background: '#0c0c0c',
        color: '#e6e6e6',
      }}
    >
      <div style={{ borderRight: '1px solid #333333', padding: '12px', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '10px' }}>
          Sources
        </div>
        {sources.map((source) => (
          <button
            key={source}
            type="button"
            onClick={() => setSourceFilter(source)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '8px 0',
              borderBottom: '1px solid #333333',
              fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
              fontSize: '12px',
              background: 'transparent',
              color: sourceFilter === source ? '#7db4ff' : '#e6e6e6',
              cursor: 'pointer',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
            }}
          >
            {source}
          </button>
        ))}
      </div>

      <div style={{ borderRight: '1px solid #333333', display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: 0 }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #333333' }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="P · filter patterns" className="sc-input" />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
            <span className="sc-chip">{rows.length} total</span>
            <span className="sc-chip">{filtered.length} visible</span>
            <span className="sc-chip">{sourceFilter}</span>
          </div>
        </div>
        <div style={{ overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '12px', fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a' }}>
              loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="sc-empty" style={{ margin: '12px' }}>
              <div>No patterns match the current slice.</div>
              <div>Broaden the source filter or search text.</div>
            </div>
          ) : (
            filtered.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: '1px solid #333333',
                  background: selected?.id === row.id ? '#1e1e1e' : 'transparent',
                  color: '#e6e6e6',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
                }}
              >
                <div style={{ fontSize: '13px', marginBottom: '4px' }}>{row.name}</div>
                <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#7a7a7a' }}>
                  <span>{row.source ?? 'unknown'}</span>
                  <span>obs {row.observed_count ?? 0}</span>
                  <span>fit {row.fitness_avg ?? 'n/a'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div style={{ padding: '12px', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '10px' }}>
          Pattern detail
        </div>
        {selected ? (
          <>
            <div className="sc-panel" style={{ padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '14px', marginBottom: '8px' }}>
                {selected.name}
              </div>
              <div className="sc-grid-two">
                <div className="sc-kpi"><span className="sc-kpi-label">source</span><span className="sc-kpi-value" style={{ fontSize: '12px' }}>{selected.source ?? 'unknown'}</span></div>
                <div className="sc-kpi"><span className="sc-kpi-label">observed</span><span className="sc-kpi-value" style={{ fontSize: '12px' }}>{selected.observed_count ?? 0}</span></div>
                <div className="sc-kpi"><span className="sc-kpi-label">fitness avg</span><span className="sc-kpi-value" style={{ fontSize: '12px' }}>{selected.fitness_avg ?? 'n/a'}</span></div>
                <div className="sc-kpi"><span className="sc-kpi-label">last audited</span><span className="sc-kpi-value" style={{ fontSize: '12px' }}>{selected.last_audited ?? 'n/a'}</span></div>
              </div>
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {selected.name}
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#c7c7c7' }}>
              {selected.summary ?? 'No summary available.'}
            </div>
          </>
        ) : (
          <div className="sc-empty">
            <div>No pattern selected.</div>
            <div>Use the palette to lock the next run onto a more intentional route.</div>
          </div>
        )}
      </div>
    </div>
  );
}
