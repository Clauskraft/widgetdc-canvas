import { useEffect, useState } from 'react';
import { graphRead } from '../lib/api';
import { useCanvasSession } from '../state/canvasSession';

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
      <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a', marginBottom: '12px' }}>
        {composeBomrunId ? `run ${composeBomrunId}` : 'no active bomrun'}
      </div>
      {rows.length === 0 ? (
        <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a' }}>
          no evidence loaded
        </div>
      ) : (
        rows.map((row, index) => (
          <pre
            key={`${composeBomrunId ?? 'evidence'}:${index}`}
            style={{
              margin: 0,
              marginBottom: '10px',
              padding: '10px',
              border: '1px solid #333333',
              background: '#111111',
              color: '#e6e6e6',
              fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
              fontSize: '11px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(row, null, 2)}
          </pre>
        ))
      )}
    </div>
  );
}
