import { useEffect, useMemo } from 'react';
import { useCanvasSession } from '../state/canvasSession';

const OPERATOR_LABELS: Array<{ key: 'CT' | 'tensorAB' | 'projectConstraint' | 'assemble' | 'materialize'; label: string }> = [
  { key: 'CT', label: 'CT' },
  { key: 'tensorAB', label: 'tensorAB' },
  { key: 'projectConstraint', label: 'projectConstraint' },
  { key: 'assemble', label: 'assemble' },
  { key: 'materialize', label: 'materialize' },
];

function statusColor(status: string): string {
  if (status === 'done') return 'var(--sc-track-textual)';
  if (status === 'running') return 'var(--sc-track-architecture)';
  if (status === 'failed') return 'var(--sc-track-slide-flow)';
  return 'var(--sc-ink-fog)';
}

export function ComposeOpsDock() {
  const composeBomrunId = useCanvasSession((s) => s.composeBomrunId);
  const composeAcceptedAt = useCanvasSession((s) => s.composeAcceptedAt);
  const composeSseConnected = useCanvasSession((s) => s.composeSseConnected);
  const composeOperatorStatus = useCanvasSession((s) => s.composeOperatorStatus);
  const composeEvents = useCanvasSession((s) => s.composeEvents);
  const patternPalette = useCanvasSession((s) => s.patternPalette);
  const selectedPatternIds = useCanvasSession((s) => s.selectedPatternIds);
  const preSeededNodes = useCanvasSession((s) => s.preSeededNodes);
  const lineageEdges = useCanvasSession((s) => s.lineageEdges);
  const lineageLoading = useCanvasSession((s) => s.lineageLoading);
  const fetchPatternPalette = useCanvasSession((s) => s.fetchPatternPalette);
  const togglePatternSelection = useCanvasSession((s) => s.togglePatternSelection);
  const fetchProvenanceForCurrentRun = useCanvasSession((s) => s.fetchProvenanceForCurrentRun);
  const switchPane = useCanvasSession((s) => s.switchPane);
  const innovationTickets = useCanvasSession((s) => s.innovationTickets);
  const innovationLoading = useCanvasSession((s) => s.innovationLoading);
  const innovationActionPendingId = useCanvasSession((s) => s.innovationActionPendingId);
  const refreshInnovationBacklog = useCanvasSession((s) => s.refreshInnovationBacklog);
  const approveInnovationBacklogItem = useCanvasSession((s) => s.approveInnovationBacklogItem);
  const rejectInnovationBacklogItem = useCanvasSession((s) => s.rejectInnovationBacklogItem);

  useEffect(() => {
    void fetchPatternPalette();
    void refreshInnovationBacklog();
  }, [fetchPatternPalette, refreshInnovationBacklog]);

  const selectedSet = useMemo(() => new Set(selectedPatternIds), [selectedPatternIds]);
  const latestArbitrationEvent = useMemo(
    () => [...composeEvents].reverse().find((event) => event.topic === 'composition.arbitration_triggered') ?? null,
    [composeEvents],
  );
  const arbitrationMode = typeof latestArbitrationEvent?.payload?.arbitration_mode === 'string'
    ? latestArbitrationEvent.payload.arbitration_mode
    : typeof latestArbitrationEvent?.payload?.mode === 'string'
      ? latestArbitrationEvent.payload.mode
      : 'triggered';
  const rawDivergence = latestArbitrationEvent?.payload?.divergence_index;
  const divergenceIndex = typeof rawDivergence === 'number'
    ? rawDivergence
    : typeof rawDivergence === 'string'
      ? Number(rawDivergence)
      : Number.NaN;
  const arbitrationHint = typeof latestArbitrationEvent?.payload?.rationale === 'string'
    ? latestArbitrationEvent.payload.rationale
    : typeof latestArbitrationEvent?.payload?.reason === 'string'
      ? latestArbitrationEvent.payload.reason
      : 'Tri-source arbitration fired inside projectConstraint.';
  const latestFailedEvent = useMemo(
    () => [...composeEvents].reverse().find((event) => event.topic === 'composition.failed') ?? null,
    [composeEvents],
  );
  const latestCompletedEvent = useMemo(
    () => [...composeEvents].reverse().find((event) => event.topic === 'composition.completed') ?? null,
    [composeEvents],
  );
  const failureReason = typeof latestFailedEvent?.payload?.rejection_reason === 'string'
    ? latestFailedEvent.payload.rejection_reason
    : typeof latestFailedEvent?.payload?.reason === 'string'
      ? latestFailedEvent.payload.reason
      : null;
  const operatorDoneCount = OPERATOR_LABELS.filter((operator) => composeOperatorStatus[operator.key] === 'done').length;
  const operatorRunning = OPERATOR_LABELS.find((operator) => composeOperatorStatus[operator.key] === 'running')?.label ?? null;
  const artifactCount = composeEvents.filter((event) => event.topic === 'composition.artifact_ready').length;
  const latestDuration = typeof latestCompletedEvent?.payload?.total_duration_ms === 'number'
    ? latestCompletedEvent.payload.total_duration_ms
    : typeof latestCompletedEvent?.payload?.duration_ms === 'number'
      ? latestCompletedEvent.payload.duration_ms
      : null;

  return (
    <section
      aria-label="Wave G1 operations dock"
      style={{
        borderTop: '0.5px solid var(--sc-paper-whisper)',
        borderBottom: '0.5px solid var(--sc-paper-whisper)',
        padding: '10px var(--sc-pane-pad)',
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
        gap: '14px',
        background: 'var(--sc-surface-elevated)',
      }}
    >
      <div>
        <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', letterSpacing: 'var(--sc-tracking-label)', textTransform: 'uppercase', color: 'var(--sc-ink-fog)', marginBottom: '6px' }}>
          Composition telemetry {composeSseConnected ? '· live' : '· idle'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {OPERATOR_LABELS.map((operator) => (
            <span
              key={operator.key}
              style={{
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: 'var(--sc-radius-sm)',
                padding: '4px 8px',
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                color: statusColor(composeOperatorStatus[operator.key]),
              }}
            >
              {operator.label} · {composeOperatorStatus[operator.key]}
            </span>
          ))}
        </div>
        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span className="sc-chip">progress {operatorDoneCount}/5</span>
          <span className="sc-chip">artifacts {artifactCount}</span>
          <span className="sc-chip">{operatorRunning ? `live ${operatorRunning}` : 'awaiting next step'}</span>
          {latestDuration !== null && <span className="sc-chip">{latestDuration} ms</span>}
        </div>
        {latestArbitrationEvent && (
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: '999px',
                padding: '3px 8px',
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '8px',
                color: 'var(--sc-track-architecture)',
              }}
              title={arbitrationHint}
            >
              arbitration triggered
            </span>
            <button type="button" className="sc-button" data-tone="accent" onClick={() => switchPane('telemetry')}>
              open telemetry
            </button>
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '8px',
                color: 'var(--sc-ink-fog)',
              }}
            >
              {arbitrationMode}
              {Number.isFinite(divergenceIndex) ? ` · ${(divergenceIndex * 100).toFixed(0)}%` : ''}
            </span>
          </div>
        )}
        {failureReason && (
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: '999px',
                padding: '3px 8px',
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '8px',
                color: 'var(--sc-track-slide-flow)',
              }}
            >
              failed · {failureReason}
            </span>
            <button
              type="button"
              onClick={() => switchPane('telemetry')}
              style={{
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: '999px',
                padding: '3px 8px',
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '8px',
                background: 'transparent',
                color: 'var(--sc-ink-stone)',
                cursor: 'pointer',
              }}
            >
              inspect telemetry
            </button>
          </div>
        )}
        <div style={{ marginTop: '6px', fontFamily: 'var(--sc-font-mono)', fontSize: '8px', color: 'var(--sc-ink-fog)' }}>
          {composeBomrunId ? `bomrun ${composeBomrunId}` : 'no active bomrun'}
          {composeAcceptedAt ? ` · accepted ${new Date(composeAcceptedAt).toLocaleTimeString()}` : ''}
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const patternId = e.dataTransfer.getData('text/pattern-id');
          if (patternId) {
            togglePatternSelection(patternId);
          }
        }}
      >
        <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', letterSpacing: 'var(--sc-tracking-label)', textTransform: 'uppercase', color: 'var(--sc-ink-fog)', marginBottom: '6px' }}>
          Gulli pattern palette
        </div>
        <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', border: '0.5px solid var(--sc-paper-whisper)', borderRadius: 'var(--sc-radius-sm)', padding: '6px' }}>
          {patternPalette.slice(0, 80).map((pattern) => (
            <button
              key={pattern.id}
              type="button"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/pattern-id', pattern.id)}
              onClick={() => togglePatternSelection(pattern.id)}
              style={{
                textAlign: 'left',
                background: selectedSet.has(pattern.id) ? 'var(--sc-paper-deep)' : 'transparent',
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: 'var(--sc-radius-sm)',
                padding: '4px 6px',
                color: 'var(--sc-ink-stone)',
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                cursor: 'pointer',
              }}
              title={pattern.semantic_summary ?? pattern.id}
            >
              {pattern.name}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '6px', fontFamily: 'var(--sc-font-mono)', fontSize: '8px', color: 'var(--sc-ink-fog)' }}>
          Selected: {selectedPatternIds.length}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', letterSpacing: 'var(--sc-tracking-label)', textTransform: 'uppercase', color: 'var(--sc-ink-fog)' }}>
            Provenance audit
          </span>
          <button
            type="button"
            onClick={() => void fetchProvenanceForCurrentRun()}
            disabled={!composeBomrunId || lineageLoading}
            className="sc-button"
            style={{ cursor: composeBomrunId ? 'pointer' : 'not-allowed' }}
          >
            {lineageLoading ? 'loading...' : 'load lineage'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {preSeededNodes.slice(0, 8).map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => void fetchProvenanceForCurrentRun()}
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '8px',
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: 'var(--sc-radius-sm)',
                background: 'transparent',
                color: 'var(--sc-ink-stone)',
                padding: '3px 6px',
                cursor: 'pointer',
              }}
              title={`Audit ${node.label}`}
            >
              {node.label} ⓘ
            </button>
          ))}
        </div>
        <div style={{ maxHeight: '100px', overflowY: 'auto', border: '0.5px solid var(--sc-paper-whisper)', borderRadius: 'var(--sc-radius-sm)', padding: '6px' }}>
          {lineageEdges.length === 0 ? (
            <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '8px', color: 'var(--sc-ink-fog)' }}>
              No lineage loaded
            </span>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span className="sc-chip">{lineageEdges.length} edges</span>
                <button type="button" className="sc-button" onClick={() => switchPane('evidence')}>
                  open evidence
                </button>
              </div>
              {lineageEdges.slice(0, 8).map((edge, index) => (
                <div key={`${edge.rel_type}-${index}`} style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '8px', color: 'var(--sc-ink-stone)', marginBottom: '3px' }}>
                  {edge.rel_type}: {edge.to_label} · {edge.to_name}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', letterSpacing: 'var(--sc-tracking-label)', textTransform: 'uppercase', color: 'var(--sc-ink-fog)' }}>
            Innovation backlog
          </span>
          <button
            type="button"
            onClick={() => void refreshInnovationBacklog()}
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '8px',
              border: '0.5px solid var(--sc-paper-whisper)',
              borderRadius: 'var(--sc-radius-sm)',
              background: 'transparent',
              color: 'var(--sc-ink-stone)',
              padding: '3px 6px',
              cursor: 'pointer',
            }}
          >
            refresh
          </button>
        </div>
        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '0.5px solid var(--sc-paper-whisper)', borderRadius: 'var(--sc-radius-sm)', padding: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {innovationLoading ? (
            <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '8px', color: 'var(--sc-ink-fog)' }}>
              loading backlog...
            </span>
          ) : innovationTickets.length === 0 ? (
            <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '8px', color: 'var(--sc-ink-fog)' }}>
              no candidate tickets
            </span>
          ) : (
            innovationTickets.slice(0, 16).map((ticket) => (
              <div key={ticket.id} style={{ border: '0.5px solid var(--sc-paper-whisper)', borderRadius: 'var(--sc-radius-sm)', padding: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '8px', color: 'var(--sc-ink-stone)' }}>
                    {ticket.title}
                  </span>
                  <span
                    style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '8px', color: ticket.severity === 'high' ? 'var(--sc-track-slide-flow)' : ticket.severity === 'medium' ? 'var(--sc-track-architecture)' : 'var(--sc-track-textual)' }}
                    title={ticket.arbitration_rationale ?? (ticket.rationale.join(' · ') || 'No arbitration rationale')}
                  >
                    {ticket.severity} · {(ticket.divergence_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    disabled={innovationActionPendingId === ticket.id}
                    onClick={() => void approveInnovationBacklogItem(ticket.id)}
                    className="sc-button"
                    style={{ cursor: innovationActionPendingId === ticket.id ? 'wait' : 'pointer' }}
                  >
                    approve
                  </button>
                  <button
                    type="button"
                    disabled={innovationActionPendingId === ticket.id}
                    onClick={() => void rejectInnovationBacklogItem(ticket.id)}
                    className="sc-button"
                    data-tone="danger"
                    style={{ cursor: innovationActionPendingId === ticket.id ? 'wait' : 'pointer' }}
                  >
                    reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

