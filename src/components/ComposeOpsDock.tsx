import { useEffect, useMemo, useState } from 'react';
import { useCanvasSession } from '../state/canvasSession';
import { graphRead } from '../lib/api';

const OPERATOR_LABELS: Array<{ key: 'CT' | 'tensorAB' | 'projectConstraint' | 'assemble' | 'materialize'; label: string }> = [
  { key: 'CT', label: 'CT' },
  { key: 'tensorAB', label: 'tensorAB' },
  { key: 'projectConstraint', label: 'projectConstraint' },
  { key: 'assemble', label: 'assemble' },
  { key: 'materialize', label: 'materialize' },
];

type AdoptionState = 'shadow' | 'candidate' | 'graduated' | 'unknown';
type OperatorKey = (typeof OPERATOR_LABELS)[number]['key'];

interface OperatorBadgeMeta {
  adoptionState: AdoptionState;
  sourcePatternCount: number;
}

const DEFAULT_BADGE_META: OperatorBadgeMeta = {
  adoptionState: 'unknown',
  sourcePatternCount: 0,
};

function normalizeOperatorKey(value: string): OperatorKey | null {
  const text = value.toLowerCase();
  if (text.includes('ct')) return 'CT';
  if (text.includes('tensorab') || text.includes('tensor_ab')) return 'tensorAB';
  if (text.includes('projectconstraint') || text.includes('project_constraint')) return 'projectConstraint';
  if (text.includes('assemble')) return 'assemble';
  if (text.includes('materialize')) return 'materialize';
  return null;
}

function statusColor(status: string): string {
  if (status === 'done') return 'var(--sc-track-textual)';
  if (status === 'running') return 'var(--sc-track-architecture)';
  if (status === 'failed') return 'var(--sc-track-slide-flow)';
  return 'var(--sc-ink-fog)';
}

function adoptionColor(state: AdoptionState): string {
  if (state === 'graduated') return '#2F9E44';
  if (state === 'candidate') return '#F08C00';
  if (state === 'shadow') return '#6C757D';
  return 'var(--sc-ink-fog)';
}

export function ComposeOpsDock() {
  const composeBomrunId = useCanvasSession((s) => s.composeBomrunId);
  const composeAcceptedAt = useCanvasSession((s) => s.composeAcceptedAt);
  const composeSseConnected = useCanvasSession((s) => s.composeSseConnected);
  const composeOperatorStatus = useCanvasSession((s) => s.composeOperatorStatus);
  const patternPalette = useCanvasSession((s) => s.patternPalette);
  const selectedPatternIds = useCanvasSession((s) => s.selectedPatternIds);
  const preSeededNodes = useCanvasSession((s) => s.preSeededNodes);
  const lineageEdges = useCanvasSession((s) => s.lineageEdges);
  const lineageLoading = useCanvasSession((s) => s.lineageLoading);
  const fetchPatternPalette = useCanvasSession((s) => s.fetchPatternPalette);
  const togglePatternSelection = useCanvasSession((s) => s.togglePatternSelection);
  const fetchProvenanceForCurrentRun = useCanvasSession((s) => s.fetchProvenanceForCurrentRun);
  const [operatorBadgeMeta, setOperatorBadgeMeta] = useState<Record<OperatorKey, OperatorBadgeMeta>>({
    CT: DEFAULT_BADGE_META,
    tensorAB: DEFAULT_BADGE_META,
    projectConstraint: DEFAULT_BADGE_META,
    assemble: DEFAULT_BADGE_META,
    materialize: DEFAULT_BADGE_META,
  });

  useEffect(() => {
    void fetchPatternPalette();
  }, [fetchPatternPalette]);

  useEffect(() => {
    let mounted = true;
    const loadOperatorAdoptionStates = async () => {
      try {
        const rows = await graphRead(
          `MATCH (op:CompositionOperator)
           RETURN coalesce(op.operator_id, op.name, op.id) AS operator_id,
                  coalesce(op.adoption_state, 'candidate') AS adoption_state,
                  size(coalesce(op.source_patterns, [])) AS source_pattern_count,
                  coalesce(op.last_audited, datetime('1970-01-01T00:00:00Z')) AS last_audited
           ORDER BY last_audited DESC
           LIMIT 50`,
        );
        if (!mounted) return;

        const next: Record<OperatorKey, OperatorBadgeMeta> = {
          CT: DEFAULT_BADGE_META,
          tensorAB: DEFAULT_BADGE_META,
          projectConstraint: DEFAULT_BADGE_META,
          assemble: DEFAULT_BADGE_META,
          materialize: DEFAULT_BADGE_META,
        };

        for (const row of rows as Array<Record<string, unknown>>) {
          const key = normalizeOperatorKey(String(row.operator_id ?? ''));
          if (!key) continue;
          const stateRaw = String(row.adoption_state ?? 'unknown').toLowerCase();
          const adoptionState: AdoptionState =
            stateRaw === 'shadow' || stateRaw === 'candidate' || stateRaw === 'graduated'
              ? stateRaw
              : 'unknown';
          next[key] = {
            adoptionState,
            sourcePatternCount: Number(row.source_pattern_count ?? 0),
          };
        }

        setOperatorBadgeMeta(next);
      } catch {
        // keep existing badges; dashboard remains read-only and fail-soft
      }
    };

    void loadOperatorAdoptionStates();
    const timer = setInterval(() => {
      void loadOperatorAdoptionStates();
    }, 30_000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const selectedSet = useMemo(() => new Set(selectedPatternIds), [selectedPatternIds]);

  return (
    <section
      aria-label="Wave G1 operations dock"
      style={{
        borderTop: '0.5px solid var(--sc-paper-whisper)',
        borderBottom: '0.5px solid var(--sc-paper-whisper)',
        padding: '10px var(--sc-pane-pad)',
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr',
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
              title={`Adoption: ${operatorBadgeMeta[operator.key].adoptionState} · source patterns: ${operatorBadgeMeta[operator.key].sourcePatternCount}`}
            >
              {operator.label} · {composeOperatorStatus[operator.key]}
              {' · '}
              <span style={{ color: adoptionColor(operatorBadgeMeta[operator.key].adoptionState) }}>
                {operatorBadgeMeta[operator.key].adoptionState}
              </span>
            </span>
          ))}
        </div>
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
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '8px',
              border: '0.5px solid var(--sc-paper-whisper)',
              borderRadius: 'var(--sc-radius-sm)',
              background: 'transparent',
              color: 'var(--sc-ink-stone)',
              padding: '3px 6px',
              cursor: composeBomrunId ? 'pointer' : 'not-allowed',
            }}
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
            lineageEdges.map((edge, index) => (
              <div key={`${edge.rel_type}-${index}`} style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '8px', color: 'var(--sc-ink-stone)', marginBottom: '3px' }}>
                {edge.rel_type}: {edge.to_label} · {edge.to_name}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

