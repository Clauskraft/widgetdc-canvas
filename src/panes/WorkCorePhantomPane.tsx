import {
  Activity,
  ArrowRight,
  BoxSelect,
  CheckCircle2,
  Database,
  Hexagon,
  Layers,
  Network,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { useCanvasSession } from '../state/canvasSession';

type WorkCoreType =
  | 'Phantom'
  | 'WorkSpec'
  | 'FoldedEvidenceBundle'
  | 'WorkItem'
  | 'WorkRun'
  | 'WorkArtifact'
  | 'ReadBackClosure';

type WorkCoreState =
  | 'latent'
  | 'specified'
  | 'grounded'
  | 'decomposed'
  | 'executing'
  | 'materialized'
  | 'closed';

interface WorkCoreNode {
  id: string;
  type: WorkCoreType;
  title: string;
  state: WorkCoreState;
  lane: WorkCoreLane;
  summary: string;
  tags: string[];
  progress?: number;
  hash?: string;
}

interface WorkCoreEdge {
  id: string;
  source: string;
  target: string;
  semantic: string;
}

type WorkCoreLane =
  | 'intent'
  | 'spec'
  | 'evidence'
  | 'decomposition'
  | 'execution'
  | 'artifact'
  | 'closure';

interface WorkCoreSnapshot {
  domain: string;
  revision: number;
  hydratedAt: string;
  metrics: {
    nodes: number;
    edges: number;
    closureRate: number;
    openRuns: number;
  };
  nodes: WorkCoreNode[];
  edges: WorkCoreEdge[];
}

interface PhantomCommandProposal {
  id: string;
  raw: string;
  type:
    | 'decompose_work_spec'
    | 'start_work_run'
    | 'attach_evidence'
    | 'request_readback'
    | 'unknown_intent';
  targetId: string;
  status: 'compiled' | 'submitted' | 'accepted' | 'rejected';
  risk: 'low' | 'medium' | 'high';
  receipt: string;
}

const LANES: Array<{
  id: WorkCoreLane;
  title: string;
  subtitle: string;
}> = [
  { id: 'intent', title: '1. Phantom', subtitle: 'Universal outcome wrapper' },
  { id: 'spec', title: '2. Spec', subtitle: 'Contract and constraints' },
  { id: 'evidence', title: '3. Evidence', subtitle: 'Grounding and sources' },
  { id: 'decomposition', title: '4. Items', subtitle: 'Work breakdown' },
  { id: 'execution', title: '5. Runs', subtitle: 'Stateful execution' },
  { id: 'artifact', title: '6. Artifacts', subtitle: 'Materialized output' },
  { id: 'closure', title: '7. Closure', subtitle: 'Read-back proof' },
];

const INITIAL_SNAPSHOT: WorkCoreSnapshot = {
  domain: 'Universal Work Core',
  revision: 1,
  hydratedAt: 'mock-readback:2026-04-23T10:00:00Z',
  metrics: { nodes: 8, edges: 8, closureRate: 0.5, openRuns: 1 },
  nodes: [
    {
      id: 'ph:book-software',
      type: 'Phantom',
      title: 'Book, software, analysis, campaign',
      state: 'executing',
      lane: 'intent',
      summary: 'One wrapper for any complex value-production run.',
      tags: ['domain-neutral', 'state-machine'],
    },
    {
      id: 'ws:blueprint',
      type: 'WorkSpec',
      title: 'Outcome blueprint',
      state: 'specified',
      lane: 'spec',
      summary: 'Defines what good means before any generation or build starts.',
      tags: ['constraints', 'acceptance'],
    },
    {
      id: 'feb:grounding',
      type: 'FoldedEvidenceBundle',
      title: 'Grounding pack',
      state: 'grounded',
      lane: 'evidence',
      summary: 'Sources, briefs, code references, data slices, and provenance hashes.',
      tags: ['evidence-first'],
      hash: 'sha256:8b31...core',
    },
    {
      id: 'wi:slice-1',
      type: 'WorkItem',
      title: 'Chapter or feature slice 1',
      state: 'decomposed',
      lane: 'decomposition',
      summary: 'A concrete unit of work that can be executed and audited.',
      tags: ['parallelizable'],
    },
    {
      id: 'wi:slice-2',
      type: 'WorkItem',
      title: 'Chapter or feature slice 2',
      state: 'latent',
      lane: 'decomposition',
      summary: 'A latent item exists before it is admitted into an active run.',
      tags: ['latent'],
    },
    {
      id: 'wr:active',
      type: 'WorkRun',
      title: 'Active execution run',
      state: 'executing',
      lane: 'execution',
      summary: 'The runtime instance that performs and records the work.',
      tags: ['mirror-write', 'telemetry'],
      progress: 72,
    },
    {
      id: 'wa:output',
      type: 'WorkArtifact',
      title: 'Materialized output',
      state: 'materialized',
      lane: 'artifact',
      summary: 'Text, code, deck, graph update, dataset, or deployed service.',
      tags: ['provenance'],
    },
    {
      id: 'rbc:proof',
      type: 'ReadBackClosure',
      title: 'Read-back closure',
      state: 'closed',
      lane: 'closure',
      summary: 'Evidence that the artifact satisfies the WorkSpec.',
      tags: ['verification'],
    },
  ],
  edges: [
    { id: 'e:scope', source: 'ph:book-software', target: 'ws:blueprint', semantic: 'SCOPES' },
    { id: 'e:ground', source: 'feb:grounding', target: 'ws:blueprint', semantic: 'GROUNDS' },
    { id: 'e:decompose-1', source: 'ws:blueprint', target: 'wi:slice-1', semantic: 'DECOMPOSES_INTO' },
    { id: 'e:decompose-2', source: 'ws:blueprint', target: 'wi:slice-2', semantic: 'DECOMPOSES_INTO' },
    { id: 'e:run-spec', source: 'wr:active', target: 'ws:blueprint', semantic: 'EXECUTES_SPEC' },
    { id: 'e:run-item', source: 'wr:active', target: 'wi:slice-1', semantic: 'EXECUTES_ITEM' },
    { id: 'e:artifact', source: 'wr:active', target: 'wa:output', semantic: 'MATERIALIZES' },
    { id: 'e:closure', source: 'wa:output', target: 'rbc:proof', semantic: 'VERIFIED_BY' },
  ],
};

function iconFor(type: WorkCoreType) {
  switch (type) {
    case 'Phantom':
      return <Activity size={15} />;
    case 'WorkSpec':
      return <Hexagon size={15} />;
    case 'FoldedEvidenceBundle':
      return <Database size={15} />;
    case 'WorkItem':
      return <Layers size={15} />;
    case 'WorkRun':
      return <Play size={15} />;
    case 'WorkArtifact':
      return <BoxSelect size={15} />;
    case 'ReadBackClosure':
      return <ShieldCheck size={15} />;
  }
}

function colorFor(type: WorkCoreType): string {
  switch (type) {
    case 'Phantom':
      return '#7c3aed';
    case 'WorkSpec':
      return '#2563eb';
    case 'FoldedEvidenceBundle':
      return '#b45309';
    case 'WorkItem':
      return '#4f46e5';
    case 'WorkRun':
      return '#059669';
    case 'WorkArtifact':
      return '#db2777';
    case 'ReadBackClosure':
      return '#047857';
  }
}

function compileIntent(raw: string, selectedId: string | null): PhantomCommandProposal {
  const q = raw.toLowerCase();
  const targetId = selectedId ?? 'ws:blueprint';
  const id = `proposal:${Date.now()}`;

  if (q.includes('tilføj') || q.includes('tilfoj') || q.includes('opret') || q.includes('nyt')) {
    return {
      id,
      raw,
      targetId,
      type: 'decompose_work_spec',
      status: 'compiled',
      risk: 'low',
      receipt: `Will request backend to add WorkItem under ${targetId}.`,
    };
  }

  if (q.includes('start') || q.includes('kør') || q.includes('kor')) {
    return {
      id,
      raw,
      targetId,
      type: 'start_work_run',
      status: 'compiled',
      risk: 'medium',
      receipt: `Will request backend to open WorkRun for ${targetId}.`,
    };
  }

  if (q.includes('bevis') || q.includes('evidence') || q.includes('ground')) {
    return {
      id,
      raw,
      targetId,
      type: 'attach_evidence',
      status: 'compiled',
      risk: 'low',
      receipt: `Will request backend to attach evidence to ${targetId}.`,
    };
  }

  if (q.includes('verificer') || q.includes('readback') || q.includes('luk')) {
    return {
      id,
      raw,
      targetId,
      type: 'request_readback',
      status: 'compiled',
      risk: 'medium',
      receipt: `Will request read-back closure for ${targetId}.`,
    };
  }

  return {
    id,
    raw,
    targetId,
    type: 'unknown_intent',
    status: 'compiled',
    risk: 'high',
    receipt: 'No backend mutation. Operator clarification required.',
  };
}

function applyMockReadBack(snapshot: WorkCoreSnapshot, proposal: PhantomCommandProposal): WorkCoreSnapshot {
  if (proposal.type !== 'decompose_work_spec') {
    return {
      ...snapshot,
      revision: snapshot.revision + 1,
      hydratedAt: `mock-readback:${new Date().toISOString()}`,
    };
  }

  const id = `wi:${Date.now()}`;
  const title = proposal.raw.replace(/tilføj|tilfoj|opret|nyt/gi, '').trim() || 'New decomposed work item';
  const node: WorkCoreNode = {
    id,
    type: 'WorkItem',
    title,
    state: 'latent',
    lane: 'decomposition',
    summary: 'Backend-confirmed work item from intent compiler read-back.',
    tags: ['operator-proposed'],
  };

  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    hydratedAt: `mock-readback:${new Date().toISOString()}`,
    metrics: {
      ...snapshot.metrics,
      nodes: snapshot.metrics.nodes + 1,
      edges: snapshot.metrics.edges + 1,
    },
    nodes: [...snapshot.nodes, node],
    edges: [
      ...snapshot.edges,
      { id: `e:${id}`, source: 'ws:blueprint', target: id, semantic: 'DECOMPOSES_INTO' },
    ],
  };
}

export function WorkCorePhantomPane() {
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const track = useCanvasSession((s) => s.track);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('ws:blueprint');
  const [query, setQuery] = useState('');
  const [agentState, setAgentState] = useState<'idle' | 'compiling' | 'submitting' | 'hydrating'>('idle');
  const [proposals, setProposals] = useState<PhantomCommandProposal[]>([]);

  const selectedNode = snapshot.nodes.find((node) => node.id === selectedNodeId) ?? snapshot.nodes[0];
  const trackHue = track ? `var(--sc-track-${track.replace('_', '-')})` : '#0f172a';

  const nodesByLane = useMemo(() => {
    const map = new Map<WorkCoreLane, WorkCoreNode[]>();
    for (const lane of LANES) map.set(lane.id, []);
    for (const node of snapshot.nodes) {
      map.get(node.lane)?.push(node);
    }
    return map;
  }, [snapshot.nodes]);

  const selectedLineage = useMemo(
    () => snapshot.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id),
    [selectedNode.id, snapshot.edges],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = query.trim();
    if (!raw || agentState !== 'idle') return;

    setQuery('');
    setAgentState('compiling');
    window.setTimeout(() => {
      const proposal = compileIntent(raw, selectedNode.id);
      setProposals((current) => [proposal, ...current].slice(0, 8));

      if (proposal.type === 'unknown_intent') {
        setProposals((current) =>
          current.map((candidate) =>
            candidate.id === proposal.id ? { ...candidate, status: 'rejected' } : candidate,
          ),
        );
        setAgentState('idle');
        return;
      }

      setAgentState('submitting');
      window.setTimeout(() => {
        setProposals((current) =>
          current.map((candidate) =>
            candidate.id === proposal.id ? { ...candidate, status: 'submitted' } : candidate,
          ),
        );
        setAgentState('hydrating');

        window.setTimeout(() => {
          setSnapshot((current) => applyMockReadBack(current, proposal));
          setProposals((current) =>
            current.map((candidate) =>
              candidate.id === proposal.id ? { ...candidate, status: 'accepted' } : candidate,
            ),
          );
          setAgentState('idle');
        }, 420);
      }, 420);
    }, 260);
  }

  return (
    <div
      className="sc-root workcore-phantom-pane"
      style={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        background:
          'radial-gradient(circle at 18% 8%, rgba(37,99,235,0.14), transparent 28%), linear-gradient(135deg, #f8fafc 0%, #eef4f8 48%, #f8fafc 100%)',
        color: '#0f172a',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1fr) auto',
          gap: '18px',
          padding: '18px 22px 14px',
          borderBottom: '1px solid rgba(148,163,184,0.24)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '14px',
              display: 'grid',
              placeItems: 'center',
              color: trackHue,
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid rgba(148,163,184,0.28)',
              boxShadow: '0 18px 44px rgba(15,23,42,0.08)',
            }}
          >
            <Network size={18} />
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '10px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: trackHue,
              }}
            >
              WorkCore Phantom
            </div>
            <h1 style={{ margin: '3px 0 0', fontSize: '18px', lineHeight: 1.15 }}>
              Scalable ontology cockpit for any value factory
            </h1>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(74px, 1fr))',
            gap: '8px',
            minWidth: '360px',
          }}
        >
          {[
            ['nodes', snapshot.metrics.nodes],
            ['edges', snapshot.metrics.edges],
            ['closure', `${Math.round(snapshot.metrics.closureRate * 100)}%`],
            ['runs', snapshot.metrics.openRuns],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: '9px 10px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(148,163,184,0.24)',
              }}
            >
              <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>
                {label}
              </div>
              <div style={{ marginTop: '2px', fontWeight: 800, fontSize: '17px' }}>{value}</div>
            </div>
          ))}
        </div>
      </header>

      <main
        style={{
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: '14px',
          padding: '14px 18px',
          overflow: 'hidden',
        }}
      >
        <section
          aria-label="WorkCore lane board"
          style={{
            minWidth: 0,
            overflow: 'auto',
            borderRadius: '20px',
            border: '1px solid rgba(148,163,184,0.28)',
            background: 'rgba(255,255,255,0.58)',
            boxShadow: '0 22px 70px rgba(15,23,42,0.08)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(220px, 1fr))',
              gap: '1px',
              minWidth: '1540px',
              minHeight: '100%',
              background: 'rgba(148,163,184,0.18)',
            }}
          >
            {LANES.map((lane) => {
              const laneNodes = nodesByLane.get(lane.id) ?? [];
              return (
                <div key={lane.id} style={{ background: 'rgba(248,250,252,0.94)', padding: '13px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#475569' }}>
                      {lane.title}
                    </div>
                    <div style={{ marginTop: '3px', fontSize: '11px', color: '#64748b' }}>{lane.subtitle}</div>
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    {laneNodes.map((node) => {
                      const active = node.id === selectedNode.id;
                      const accent = colorFor(node.type);
                      return (
                        <button
                          key={node.id}
                          type="button"
                          onClick={() => setSelectedNodeId(node.id)}
                          style={{
                            display: 'grid',
                            gap: '8px',
                            width: '100%',
                            textAlign: 'left',
                            border: `1px solid ${active ? accent : 'rgba(148,163,184,0.28)'}`,
                            borderRadius: '16px',
                            background: active ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.66)',
                            color: '#0f172a',
                            padding: '12px',
                            cursor: 'pointer',
                            boxShadow: active ? '0 18px 42px rgba(15,23,42,0.13)' : '0 8px 22px rgba(15,23,42,0.06)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                            <span style={{ display: 'flex', gap: '7px', alignItems: 'center', color: accent, fontFamily: 'var(--sc-font-mono)', fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                              {iconFor(node.type)}
                              {node.type}
                            </span>
                            <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', color: '#94a3b8' }}>{node.id}</span>
                          </div>
                          <strong style={{ fontSize: '13px', lineHeight: 1.25 }}>{node.title}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.35 }}>{node.summary}</span>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '3px 7px', borderRadius: '999px', background: 'rgba(15,23,42,0.06)', fontFamily: 'var(--sc-font-mono)', fontSize: '8px', textTransform: 'uppercase' }}>
                              {node.state}
                            </span>
                            {node.tags.slice(0, 2).map((tag) => (
                              <span key={tag} style={{ padding: '3px 7px', borderRadius: '999px', background: `${accent}14`, color: accent, fontSize: '9px' }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                          {typeof node.progress === 'number' && (
                            <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
                              <div style={{ width: `${node.progress}%`, height: '100%', background: accent }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside
          aria-label="Selected WorkCore node"
          style={{
            minWidth: 0,
            overflowY: 'auto',
            borderRadius: '20px',
            border: '1px solid rgba(148,163,184,0.28)',
            background: 'rgba(255,255,255,0.78)',
            boxShadow: '0 22px 70px rgba(15,23,42,0.08)',
            padding: '18px',
          }}
        >
          <div style={{ display: 'flex', gap: '9px', alignItems: 'center', color: colorFor(selectedNode.type), fontFamily: 'var(--sc-font-mono)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            {iconFor(selectedNode.type)}
            {selectedNode.type}
          </div>
          <h2 style={{ margin: '12px 0 8px', fontSize: '24px', lineHeight: 1.1 }}>{selectedNode.title}</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: 1.45 }}>{selectedNode.summary}</p>

          <section style={{ marginTop: '18px', padding: '14px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '10px', color: '#64748b', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Graph lineage
            </div>
            {selectedLineage.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>No lineage edges for this node.</div>
            ) : (
              selectedLineage.map((edge) => {
                const incoming = edge.target === selectedNode.id;
                const related = snapshot.nodes.find((node) => node.id === (incoming ? edge.source : edge.target));
                if (!related) return null;
                return (
                  <button
                    key={edge.id}
                    type="button"
                    onClick={() => setSelectedNodeId(related.id)}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gap: '4px',
                      border: 0,
                      borderTop: '1px solid #e2e8f0',
                      background: 'transparent',
                      padding: '10px 0',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', color: '#94a3b8' }}>
                      {incoming ? 'INCOMING' : 'OUTGOING'} · {edge.semantic}
                    </span>
                    <span style={{ fontSize: '12px', color: '#0f172a' }}>{related.title}</span>
                  </button>
                );
              })
            )}
          </section>

          <section style={{ marginTop: '18px' }}>
            <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '10px', color: '#64748b', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>
              Latest proposals
            </div>
            {proposals.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>No compiled commands yet.</div>
            ) : (
              proposals.slice(0, 4).map((proposal) => (
                <div key={proposal.id} style={{ padding: '10px 0', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontFamily: 'var(--sc-font-mono)', fontSize: '10px' }}>
                    <span>{proposal.type}</span>
                    <span style={{ color: proposal.status === 'accepted' ? '#059669' : proposal.status === 'rejected' ? '#dc2626' : '#64748b' }}>
                      {proposal.status}
                    </span>
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '11px', color: '#64748b' }}>{proposal.receipt}</div>
                </div>
              ))
            )}
          </section>
        </aside>
      </main>

      <footer
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '12px',
          alignItems: 'center',
          padding: '0 18px 16px',
        }}
      >
        <form
          onSubmit={submit}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px',
            borderRadius: '18px',
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid rgba(148,163,184,0.32)',
            boxShadow: '0 16px 54px rgba(15,23,42,0.1)',
          }}
        >
          <div style={{ color: trackHue, paddingLeft: '6px' }}>
            {agentState === 'idle' ? <Sparkles size={17} /> : <Activity size={17} />}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={agentState !== 'idle'}
            placeholder="Compile intent: tilføj item, start run, ground evidence, verificer closure..."
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 0,
              background: 'transparent',
              color: '#0f172a',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            disabled={!query.trim() || agentState !== 'idle'}
            style={{
              width: '40px',
              height: '40px',
              display: 'grid',
              placeItems: 'center',
              border: 0,
              borderRadius: '13px',
              background: query.trim() ? trackHue : '#e2e8f0',
              color: query.trim() ? '#fff' : '#94a3b8',
              cursor: query.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontFamily: 'var(--sc-font-mono)', fontSize: '10px' }}>
          <CheckCircle2 size={14} color="#059669" />
          session {canvasSessionId ? canvasSessionId.slice(0, 8) : 'none'} · rev {snapshot.revision} · {snapshot.hydratedAt}
        </div>
      </footer>

      <style>{`
        @media (max-width: 1050px) {
          .workcore-phantom-pane main {
            grid-template-columns: 1fr !important;
          }
          .workcore-phantom-pane aside {
            display: none;
          }
          .workcore-phantom-pane header,
          .workcore-phantom-pane footer {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
