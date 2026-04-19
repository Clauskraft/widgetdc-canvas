/**
 * M5 — PhantomBOMPane (T5.1)
 * Cluster topology grid: clusters × 11 component-types with drill-down
 * and 9-axis SuperBOM filter rail.
 *
 * Data: GET /api/phantom-bom/clusters + /api/phantom-bom/components?cluster=X&axis_filter=Y
 * Falls back to client-side mock data if endpoint returns 404.
 */

import { useEffect, useState, useCallback } from 'react';
import { useCanvasSession } from '../state/canvasSession';

// ── Types ────────────────────────────────────────────────────────────────────

const COMPONENT_TYPES = [
  'tool', 'api', 'model', 'dataset', 'pattern',
  'agent', 'service', 'library', 'prompt', 'policy', 'compliance_control',
] as const;
type ComponentType = (typeof COMPONENT_TYPES)[number];

interface BOMCluster {
  id: string;
  name: string;
  capability_focus: string;
  counts: Partial<Record<ComponentType, number>>;
}

interface BOMComponent {
  id: string;
  name: string;
  type: ComponentType;
  cluster_id: string;
  process_stage?: string;
  consulting_domain?: string;
  deliverable_type?: string;
}

const AXIS_FILTERS = [
  'process_stage', 'consulting_domain', 'deliverable_type',
  'maturity_level', 'deployment_target', 'risk_tier',
  'data_residency', 'license_type', 'integration_pattern',
] as const;
type AxisFilter = (typeof AXIS_FILTERS)[number];

// ── Mock data (used when API 404s) ───────────────────────────────────────────

const MOCK_CLUSTERS: BOMCluster[] = [
  {
    id: 'c1', name: 'Intelligence Core', capability_focus: 'RAG + reasoning',
    counts: { agent: 12, model: 8, tool: 15, api: 6, service: 4 },
  },
  {
    id: 'c2', name: 'Document Production', capability_focus: 'Report + slide generation',
    counts: { service: 7, library: 9, tool: 5, prompt: 14 },
  },
  {
    id: 'c3', name: 'Data Pipeline', capability_focus: 'Ingest + transform',
    counts: { api: 11, dataset: 8, service: 6, tool: 9, policy: 3 },
  },
  {
    id: 'c4', name: 'Compliance Gate', capability_focus: 'NIS2 + GDPR',
    counts: { compliance_control: 18, policy: 12, agent: 4 },
  },
  {
    id: 'c5', name: 'Canvas UI', capability_focus: 'Frontend panes + host bridge',
    counts: { library: 6, service: 3, api: 4, tool: 2 },
  },
];

function fetchClusters(backendBase: string, apiKey: string): Promise<BOMCluster[]> {
  return fetch(`${backendBase}/api/phantom-bom/clusters`, {
    headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
  })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<BOMCluster[]>;
    })
    .catch(() => MOCK_CLUSTERS);
}

function fetchComponents(
  backendBase: string,
  apiKey: string,
  clusterId: string,
  axisFilter: AxisFilter | null,
): Promise<BOMComponent[]> {
  const params = new URLSearchParams({ cluster: clusterId });
  if (axisFilter) params.set('axis_filter', axisFilter);
  return fetch(`${backendBase}/api/phantom-bom/components?${params.toString()}`, {
    headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {},
  })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<BOMComponent[]>;
    })
    .catch(() => []);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[...Array(COMPONENT_TYPES.length + 1)].map((_, i) => (
        <td key={i} style={{ padding: '8px 12px' }}>
          <div
            aria-hidden="true"
            style={{
              height: '12px',
              width: i === 0 ? '120px' : '28px',
              background: 'var(--sc-paper-whisper)',
              borderRadius: 'var(--sc-radius-sm)',
              animation: 'sc-pulse 1.4s ease-in-out infinite',
            }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── PhantomBOMPane ───────────────────────────────────────────────────────────

export function PhantomBOMPane() {
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const track = useCanvasSession((s) => s.track);

  const [clusters, setClusters] = useState<BOMCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [components, setComponents] = useState<BOMComponent[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [activeAxis, setActiveAxis] = useState<AxisFilter | null>(null);

  const backendBase = 'https://backend-production-d3da.up.railway.app';
  const apiKey = (import.meta.env.VITE_API_KEY ?? '').toString().trim() as string;

  useEffect(() => {
    setLoading(true);
    fetchClusters(backendBase, apiKey).then((data) => {
      setClusters(data);
      setLoading(false);
    });
  }, []);

  const drillInto = useCallback(
    (clusterId: string) => {
      setSelectedCluster(clusterId);
      setComponentsLoading(true);
      fetchComponents(backendBase, apiKey, clusterId, activeAxis).then((data) => {
        setComponents(data);
        setComponentsLoading(false);
      });
    },
    [activeAxis],
  );

  const trackHue = track
    ? `var(--sc-track-${track.replace('_', '-')})`
    : 'var(--sc-ink-graphite)';

  return (
    <div
      className="sc-root phantom-bom-pane"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 'var(--sc-pane-pad)',
        background: 'var(--sc-surface-bg)',
        overflowY: 'auto',
      }}
    >
      {/* Pane header */}
      <div className="sc-pane-head" style={{ marginBottom: '20px' }}>
        <span className="sc-pane-label" style={{ color: trackHue }}>
          Phantom BOM · Cluster Topology
        </span>
        <span className="sc-pane-meta">
          {canvasSessionId ? `session ${canvasSessionId.slice(0, 8)}` : 'no session'}
        </span>
      </div>

      {/* 9-axis filter rail */}
      <nav
        aria-label="SuperBOM axis filters"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '0.5px solid var(--sc-paper-whisper)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: 'var(--sc-tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
            alignSelf: 'center',
            marginRight: '8px',
          }}
        >
          Filter
        </span>
        {AXIS_FILTERS.map((axis) => {
          const isActive = axis === activeAxis;
          return (
            <button
              key={axis}
              type="button"
              onClick={() => setActiveAxis(isActive ? null : axis)}
              aria-pressed={isActive}
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: 'var(--sc-tracking-label)',
                textTransform: 'uppercase',
                color: isActive ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-stone)',
                background: isActive ? 'var(--sc-paper-deep)' : 'transparent',
                border: '0.5px solid',
                borderColor: isActive ? 'var(--sc-ink-graphite)' : 'var(--sc-paper-whisper)',
                borderRadius: 'var(--sc-radius-sm)',
                padding: '3px 8px',
                cursor: 'pointer',
                transition: 'all var(--sc-duration-quick) var(--sc-ease-emphasized)',
              }}
            >
              {axis.replace(/_/g, ' ')}
            </button>
          );
        })}
      </nav>

      {/* Cluster × component-type grid */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <table
          aria-label="Cluster topology"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '10px',
            letterSpacing: '0.05em',
          }}
        >
          <thead>
            <tr>
              <th
                scope="col"
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  color: 'var(--sc-ink-stone)',
                  fontWeight: 400,
                  letterSpacing: 'var(--sc-tracking-label)',
                  textTransform: 'uppercase',
                  borderBottom: '0.5px solid var(--sc-paper-whisper)',
                  whiteSpace: 'nowrap',
                }}
              >
                Cluster
              </th>
              {COMPONENT_TYPES.map((ct) => (
                <th
                  key={ct}
                  scope="col"
                  style={{
                    textAlign: 'center',
                    padding: '8px 6px',
                    color: 'var(--sc-ink-fog)',
                    fontWeight: 400,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    borderBottom: '0.5px solid var(--sc-paper-whisper)',
                    whiteSpace: 'nowrap',
                    fontSize: '8px',
                  }}
                >
                  {ct.replace(/_/g, '\u00ad')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : clusters.map((cluster) => {
                  const isSelected = cluster.id === selectedCluster;
                  return (
                    <tr
                      key={cluster.id}
                      style={{
                        background: isSelected ? 'var(--sc-paper-deep)' : 'transparent',
                        transition: 'background var(--sc-duration-quick) var(--sc-ease-emphasized)',
                      }}
                    >
                      <td style={{ padding: '8px 12px', borderBottom: '0.5px solid var(--sc-paper-whisper)' }}>
                        <button
                          type="button"
                          onClick={() => drillInto(cluster.id)}
                          aria-expanded={isSelected}
                          style={{
                            fontFamily: 'var(--sc-font-mono)',
                            fontSize: '10px',
                            color: isSelected ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-stone)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{ marginRight: '6px', opacity: 0.6 }}
                          >
                            {isSelected ? '▼' : '▶'}
                          </span>
                          {cluster.name}
                        </button>
                        <div
                          style={{
                            color: 'var(--sc-ink-fog)',
                            fontSize: '8px',
                            letterSpacing: '0.04em',
                            marginTop: '2px',
                            paddingLeft: '16px',
                          }}
                        >
                          {cluster.capability_focus}
                        </div>
                      </td>
                      {COMPONENT_TYPES.map((ct) => {
                        const count = cluster.counts[ct] ?? 0;
                        return (
                          <td
                            key={ct}
                            style={{
                              textAlign: 'center',
                              padding: '8px 6px',
                              borderBottom: '0.5px solid var(--sc-paper-whisper)',
                              color: count > 0 ? 'var(--sc-ink-stone)' : 'var(--sc-paper-whisper)',
                            }}
                          >
                            {count > 0 ? count : '·'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Component drill-down panel */}
      {selectedCluster && (
        <aside
          aria-label="Component list"
          style={{
            marginTop: '20px',
            padding: '16px',
            background: 'var(--sc-surface-elevated)',
            border: '0.5px solid var(--sc-paper-whisper)',
            borderRadius: 'var(--sc-radius-md)',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: 'var(--sc-tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--sc-ink-fog)',
              marginBottom: '12px',
            }}
          >
            {clusters.find((c) => c.id === selectedCluster)?.name ?? selectedCluster}
            {activeAxis ? ` · filtered by ${activeAxis}` : ''}
          </div>
          {componentsLoading ? (
            <div
              style={{ color: 'var(--sc-ink-fog)', fontFamily: 'var(--sc-font-mono)', fontSize: '10px' }}
            >
              loading…
            </div>
          ) : components.length === 0 ? (
            <div
              style={{ color: 'var(--sc-ink-fog)', fontFamily: 'var(--sc-font-mono)', fontSize: '10px' }}
            >
              No components. Backend route may be pending deploy.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {components.map((comp) => (
                <li
                  key={comp.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    fontFamily: 'var(--sc-font-mono)',
                    fontSize: '10px',
                    color: 'var(--sc-ink-stone)',
                  }}
                >
                  <span
                    style={{
                      minWidth: '90px',
                      color: 'var(--sc-ink-fog)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontSize: '8px',
                    }}
                  >
                    {comp.type}
                  </span>
                  {comp.name}
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      <style>{`
        @keyframes sc-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @media (max-width: 900px) {
          .phantom-bom-pane table { min-width: 700px; }
        }
        .phantom-bom-pane button:focus-visible {
          outline: 2px solid var(--sc-focus-ring);
          outline-offset: 2px;
          border-radius: var(--sc-radius-sm);
        }
      `}</style>
    </div>
  );
}
