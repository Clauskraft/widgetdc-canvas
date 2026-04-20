import { useEffect, useState } from 'react';
import { graphRead } from '../lib/api';
import { useCanvasSession } from '../state/canvasSession';

function extractNodeLabel(row: Record<string, unknown>): string {
  const node = row.n as Record<string, unknown> | undefined;
  if (!node) return 'unknown node';
  return String(node.name ?? node.title ?? node.id ?? 'unknown node');
}

export function EvidencePane() {
  const composeBomrunId = useCanvasSession((s) => s.composeBomrunId);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!composeBomrunId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const data = await graphRead(
        `MATCH (r:PhantomBOMRun {id: $bomrunId})-[rel*1..3]-(n)
         RETURN n, rel
         LIMIT 24`,
        { bomrunId: composeBomrunId },
      ).catch(() => []);
      if (!cancelled) {
        setRows(data as Array<Record<string, unknown>>);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [composeBomrunId]);

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
      <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: '10px' }}>
        Evidence inspector
      </div>
      <div className="sc-grid-two" style={{ marginBottom: '12px' }}>
        <div className="sc-kpi"><span className="sc-kpi-label">run</span><span className="sc-kpi-value" style={{ fontSize: '12px' }}>{composeBomrunId ?? 'no active bomrun'}</span></div>
        <div className="sc-kpi"><span className="sc-kpi-label">edges in view</span><span className="sc-kpi-value">{rows.length}</span></div>
      </div>
      {rows.length === 0 ? (
        <div className="sc-empty">
          <div>No evidence loaded.</div>
          <div>Trigger a composition or load provenance from the dock to inspect lineage here.</div>
        </div>
      ) : (
        rows.map((row, index) => (
          <div
            key={`${composeBomrunId ?? 'evidence'}:${index}`}
            style={{
              marginBottom: '10px',
              padding: '10px',
              border: '1px solid #333333',
              background: '#111111',
              color: '#e6e6e6',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace' }}>
              <span style={{ fontSize: '12px' }}>{extractNodeLabel(row)}</span>
              <span style={{ fontSize: '10px', color: '#7db4ff' }}>edge {index + 1}</span>
            </div>
            <pre
              style={{
                margin: 0,
                color: '#e6e6e6',
                fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
                fontSize: '11px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(row, null, 2)}
            </pre>
          </div>
        ))
      )}
    </div>
  );
}
