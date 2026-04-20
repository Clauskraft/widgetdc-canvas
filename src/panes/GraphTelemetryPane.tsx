import { useEffect, useMemo, useState } from 'react';
import { graphRead } from '../lib/api';
import { useCanvasSession } from '../state/canvasSession';

interface RunFailureSnapshot {
  status: string;
  canonical_pattern: string | null;
  rejection_reason: string | null;
  duration_ms: number | null;
}

interface MoraineRecallRow {
  provider_id?: string | null;
  a2a_decision?: string | null;
  teacher_agent?: string | null;
  pheromone_domain?: string | null;
  pheromone_intensity?: number | null;
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

export function GraphTelemetryPane() {
  const composeBomrunId = useCanvasSession((s) => s.composeBomrunId);
  const composeEvents = useCanvasSession((s) => s.composeEvents);
  const composeOperatorStatus = useCanvasSession((s) => s.composeOperatorStatus);
  const [runState, setRunState] = useState<RunFailureSnapshot | null>(null);
  const [moraineRows, setMoraineRows] = useState<MoraineRecallRow[]>([]);

  useEffect(() => {
    if (!composeBomrunId) {
      setRunState(null);
      setMoraineRows([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      const rows = await graphRead(
        `MATCH (r:PhantomBOMRun {id: $bomrunId})
         RETURN r.status AS status,
                r.canonical_pattern AS canonical_pattern,
                r.rejection_reason AS rejection_reason,
                r.duration_ms AS duration_ms
         LIMIT 1`,
        { bomrunId: composeBomrunId },
      ).catch(() => []);

      const first = (rows as Array<Record<string, unknown>>)[0];
      if (!first || cancelled) return;

      const snapshot: RunFailureSnapshot = {
        status: String(first.status ?? 'unknown'),
        canonical_pattern: first.canonical_pattern ? String(first.canonical_pattern) : null,
        rejection_reason: first.rejection_reason ? String(first.rejection_reason) : null,
        duration_ms: toNumber(first.duration_ms),
      };
      setRunState(snapshot);

      if (!snapshot.rejection_reason) {
        setMoraineRows([]);
        return;
      }

      const recall = await graphRead(
        `MATCH (ft:FailureTrace)
         WHERE ft.failure_reason = $reason
         RETURN ft.provider_id AS provider_id,
                ft.a2a_decision AS a2a_decision,
                coalesce(ft.teacher_agent, ft.teacher_signal) AS teacher_agent,
                ft.pheromone_domain AS pheromone_domain,
                coalesce(ft.pheromone_intensity, ft.pheromone_score) AS pheromone_intensity
         ORDER BY coalesce(ft.observed_at, ft.updated_at, ft.created_at) DESC
         LIMIT 6`,
        { reason: snapshot.rejection_reason },
      ).catch(() => []);

      if (!cancelled) {
        setMoraineRows((recall as Array<Record<string, unknown>>).map((row) => ({
          provider_id: row.provider_id ? String(row.provider_id) : null,
          a2a_decision: row.a2a_decision ? String(row.a2a_decision) : null,
          teacher_agent: row.teacher_agent ? String(row.teacher_agent) : null,
          pheromone_domain: row.pheromone_domain ? String(row.pheromone_domain) : null,
          pheromone_intensity: toNumber(row.pheromone_intensity),
        })));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [composeBomrunId]);

  const latestArbitration = useMemo(
    () => [...composeEvents].reverse().find((event) => event.topic === 'composition.arbitration_triggered') ?? null,
    [composeEvents],
  );

  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of composeEvents) {
      counts.set(event.topic, (counts.get(event.topic) ?? 0) + 1);
    }
    return counts;
  }, [composeEvents]);
  const sortedTopicTail = [...eventCounts.entries()].sort((a, b) => b[1] - a[1]);
  const riskTone = runState?.rejection_reason ? 'var(--sc-danger)' : 'var(--sc-success)';

  return (
    <div
      className="sc-root"
      style={{
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr',
        height: '100%',
        minHeight: 0,
        background: '#0c0c0c',
        color: '#e6e6e6',
        padding: '14px 18px',
        gap: '12px',
      }}
    >
      <div className="sc-grid-three">
        {(['CT', 'tensorAB', 'projectConstraint', 'assemble', 'materialize'] as const).map((operator) => (
          <div key={operator} className="sc-kpi">
            <div className="sc-kpi-label">{operator}</div>
            <div className="sc-kpi-value" style={{ fontSize: '12px' }}>{composeOperatorStatus[operator]}</div>
          </div>
        ))}
        <div className="sc-kpi">
          <div className="sc-kpi-label">events</div>
          <div className="sc-kpi-value">{composeEvents.length}</div>
        </div>
      </div>

      <div className="sc-grid-two">
        <div className="sc-panel" style={{ padding: '12px', fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace' }}>
          <div style={{ color: '#7a7a7a', textTransform: 'uppercase', fontSize: '11px', marginBottom: '6px' }}>
            Tri-source arbitration
          </div>
          {latestArbitration ? (
            <>
              <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                {String(latestArbitration.payload.arbitration_mode ?? latestArbitration.payload.mode ?? 'triggered')}
              </div>
              <div style={{ fontSize: '11px', color: '#7a7a7a', marginBottom: '4px' }}>
                divergence {String(latestArbitration.payload.divergence_index ?? 'n/a')}
              </div>
              <div style={{ fontSize: '11px', color: '#e6e6e6' }}>
                {String(latestArbitration.payload.rationale ?? latestArbitration.payload.reason ?? 'no rationale')}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '11px', color: '#7a7a7a' }}>no arbitration event yet</div>
          )}
        </div>

        <div className="sc-panel" style={{ padding: '12px', fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace' }}>
          <div style={{ color: '#7a7a7a', textTransform: 'uppercase', fontSize: '11px', marginBottom: '6px' }}>
            Run failure
          </div>
          {runState ? (
            <>
              <div style={{ fontSize: '13px', marginBottom: '4px', color: riskTone }}>{runState.status}</div>
              <div style={{ fontSize: '11px', color: '#d4a44a', marginBottom: '4px' }}>
                {runState.rejection_reason ?? 'no rejection reason'}
              </div>
              <div style={{ fontSize: '11px', color: '#7a7a7a' }}>
                {runState.canonical_pattern ?? 'unknown pattern'} · {runState.duration_ms ?? 'n/a'} ms
              </div>
            </>
          ) : (
            <div style={{ fontSize: '11px', color: '#7a7a7a' }}>no bomrun selected</div>
          )}
        </div>
      </div>

      <div className="sc-grid-two" style={{ minHeight: 0 }}>
        <div className="sc-panel" style={{ overflowY: 'auto', padding: '10px' }}>
          <div style={{ color: '#7a7a7a', textTransform: 'uppercase', fontSize: '11px', marginBottom: '8px', fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace' }}>
            Topic tail
          </div>
          {sortedTopicTail.map(([topic, count]) => (
            <div
              key={topic}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #333333',
                padding: '6px 0',
                fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
                fontSize: '11px',
              }}
            >
              <span>{topic}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>

        <div className="sc-panel" style={{ overflowY: 'auto', padding: '10px' }}>
          <div style={{ color: '#7a7a7a', textTransform: 'uppercase', fontSize: '11px', marginBottom: '8px', fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace' }}>
            Moraine memory
          </div>
          {moraineRows.length === 0 ? (
            <div className="sc-empty" style={{ minHeight: '120px' }}>
              <div>No failure trace recall for the current rejection.</div>
              <div>Moraine memory becomes visible when a rejection reason maps to stored trace history.</div>
            </div>
          ) : (
            moraineRows.map((row, index) => (
              <div
                key={`${row.provider_id ?? 'provider'}:${index}`}
                style={{
                  borderBottom: '1px solid #333333',
                  padding: '8px 0',
                  fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
                  fontSize: '11px',
                }}
              >
                <div>{row.provider_id ?? 'unknown provider'}</div>
                <div style={{ color: '#7a7a7a', marginTop: '4px' }}>
                  teacher {row.teacher_agent ?? 'n/a'} · pheromone {row.pheromone_domain ?? 'n/a'} {row.pheromone_intensity ?? 'n/a'}
                </div>
                <div style={{ color: '#e6e6e6', marginTop: '4px' }}>{row.a2a_decision ?? 'no a2a decision stored'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
