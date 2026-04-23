import {
  Activity,
  ArrowRight,
  BoxSelect,
  CheckCircle2,
  Circle,
  Database,
  Hexagon,
  Layers,
  Network,
  Play,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { type FormEvent, type PointerEvent, useMemo, useRef, useState } from 'react';
import { useCanvasSession } from '../state/canvasSession';

type PhantomNodeType =
  | 'Phantom'
  | 'WorkSpec'
  | 'FoldedEvidenceBundle'
  | 'WorkItem'
  | 'WorkRun'
  | 'WorkArtifact'
  | 'ReadBackClosure';

type PhantomNodeState =
  | 'latent'
  | 'specified'
  | 'grounded'
  | 'decomposed'
  | 'executing'
  | 'materialized'
  | 'closed';

interface CandidateStrategy {
  id: string;
  text: string;
  selected: boolean;
}

interface PhantomNode {
  id: string;
  type: PhantomNodeType;
  title: string;
  state: PhantomNodeState;
  agent?: string;
  progress?: number;
  hash?: string;
  validationRules?: string[];
  candidates?: CandidateStrategy[];
}

interface PhantomEdge {
  id: string;
  source: string;
  target: string;
  semantic: string;
}

interface PhantomCoreSnapshot {
  domain: string;
  hydratedAt: string;
  revision: number;
  metrics: {
    lifecycleScore: number;
    orphans: number;
    pendingProposals: number;
  };
  nodes: PhantomNode[];
  edges: PhantomEdge[];
}

interface LayoutPoint {
  x: number;
  y: number;
}

type LayoutState = Record<string, LayoutPoint>;

type ProposalStatus = 'compiled' | 'submitted' | 'accepted' | 'rejected';

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
  status: ProposalStatus;
  risk: 'low' | 'medium' | 'high';
  expectedMutation: string;
}

const NODE_WIDTH = 274;

const INITIAL_SNAPSHOT: PhantomCoreSnapshot = {
  domain: 'Universal Work Core',
  hydratedAt: 'mock-readback:2026-04-23T10:00:00Z',
  revision: 1,
  metrics: { lifecycleScore: 0.85, orphans: 0, pendingProposals: 0 },
  nodes: [
    { id: 'ph:01', type: 'Phantom', title: 'Universal Phantom: Book or Software Delivery', state: 'executing' },
    {
      id: 'ws:101',
      type: 'WorkSpec',
      title: 'Outcome Blueprint',
      state: 'specified',
      validationRules: ['Goal coherence', 'Domain fit', 'Read-back closure'],
    },
    {
      id: 'feb:201',
      type: 'FoldedEvidenceBundle',
      title: 'Grounding Evidence',
      state: 'grounded',
      hash: 'sha256:8b31...core',
    },
    {
      id: 'wi:301',
      type: 'WorkItem',
      title: 'Chapter 1 or Feature Slice 1',
      state: 'decomposed',
      candidates: [
        { id: 'c:plot', text: 'Narrative draft strategy', selected: true },
        { id: 'c:code', text: 'Implementation slice strategy', selected: true },
      ],
    },
    {
      id: 'wi:302',
      type: 'WorkItem',
      title: 'Chapter 2 or Feature Slice 2',
      state: 'latent',
      candidates: [{ id: 'c:risk', text: 'Risk-first decomposition', selected: false }],
    },
    { id: 'wr:401', type: 'WorkRun', title: 'Execution Run', state: 'executing', progress: 72, agent: 'WorkCore Engine' },
    { id: 'wa:501', type: 'WorkArtifact', title: 'Materialized Output', state: 'materialized' },
    { id: 'rbc:601', type: 'ReadBackClosure', title: 'Verification Closure', state: 'closed' },
  ],
  edges: [
    { id: 'e:ground', source: 'feb:201', target: 'ws:101', semantic: 'GROUNDS' },
    { id: 'e:scope', source: 'ph:01', target: 'ws:101', semantic: 'SCOPES' },
    { id: 'e:item-a', source: 'ws:101', target: 'wi:301', semantic: 'DECOMPOSES_INTO' },
    { id: 'e:item-b', source: 'ws:101', target: 'wi:302', semantic: 'DECOMPOSES_INTO' },
    { id: 'e:run-spec', source: 'wr:401', target: 'ws:101', semantic: 'EXECUTES_SPEC' },
    { id: 'e:run-item', source: 'wr:401', target: 'wi:301', semantic: 'EXECUTES_ITEM' },
    { id: 'e:artifact', source: 'wr:401', target: 'wa:501', semantic: 'MATERIALIZES' },
    { id: 'e:closure', source: 'wa:501', target: 'rbc:601', semantic: 'VERIFIED_BY' },
  ],
};

const INITIAL_LAYOUT: LayoutState = {
  'ph:01': { x: 40, y: 300 },
  'feb:201': { x: 360, y: 100 },
  'ws:101': { x: 360, y: 300 },
  'wi:301': { x: 760, y: 210 },
  'wi:302': { x: 760, y: 430 },
  'wr:401': { x: 1160, y: 230 },
  'wa:501': { x: 1520, y: 230 },
  'rbc:601': { x: 1880, y: 230 },
};

function compileIntent(raw: string, selectedNodeId: string | null): PhantomCommandProposal {
  const normalized = raw.toLowerCase();
  const targetId = selectedNodeId ?? 'ws:101';
  const id = `proposal:${Date.now()}`;

  if (normalized.includes('start') || normalized.includes('kor') || normalized.includes('kør')) {
    return {
      id,
      raw,
      targetId,
      type: 'start_work_run',
      status: 'compiled',
      risk: 'medium',
      expectedMutation: `Create WorkRun for ${targetId} after backend admission.`,
    };
  }

  if (normalized.includes('tilfoj') || normalized.includes('tilføj') || normalized.includes('opret') || normalized.includes('nyt')) {
    return {
      id,
      raw,
      targetId,
      type: 'decompose_work_spec',
      status: 'compiled',
      risk: 'low',
      expectedMutation: `Create WorkItem under ${targetId} after read-back.`,
    };
  }

  if (normalized.includes('bevis') || normalized.includes('ground') || normalized.includes('evidence')) {
    return {
      id,
      raw,
      targetId,
      type: 'attach_evidence',
      status: 'compiled',
      risk: 'low',
      expectedMutation: `Attach FoldedEvidenceBundle to ${targetId}.`,
    };
  }

  if (normalized.includes('verificer') || normalized.includes('luk') || normalized.includes('readback')) {
    return {
      id,
      raw,
      targetId,
      type: 'request_readback',
      status: 'compiled',
      risk: 'medium',
      expectedMutation: `Request ReadBackClosure for ${targetId}.`,
    };
  }

  return {
    id,
    raw,
    targetId,
    type: 'unknown_intent',
    status: 'compiled',
    risk: 'high',
    expectedMutation: 'No mutation. Intent requires operator clarification.',
  };
}

function simulateBackendReadback(snapshot: PhantomCoreSnapshot, proposal: PhantomCommandProposal): PhantomCoreSnapshot {
  if (proposal.type !== 'decompose_work_spec') {
    return {
      ...snapshot,
      revision: snapshot.revision + 1,
      hydratedAt: `mock-readback:${new Date().toISOString()}`,
      metrics: { ...snapshot.metrics, pendingProposals: 0 },
    };
  }

  const nodeId = `wi:${Date.now()}`;
  const parentId = proposal.targetId.startsWith('ws:') ? proposal.targetId : 'ws:101';

  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    hydratedAt: `mock-readback:${new Date().toISOString()}`,
    metrics: { ...snapshot.metrics, pendingProposals: 0 },
    nodes: [
      ...snapshot.nodes,
      {
        id: nodeId,
        type: 'WorkItem',
        title: proposal.raw.replace(/tilføj|tilfoj|opret|nyt/gi, '').trim() || 'New WorkItem',
        state: 'latent',
        candidates: [],
      },
    ],
    edges: [
      ...snapshot.edges,
      { id: `e:${nodeId}`, source: parentId, target: nodeId, semantic: 'DECOMPOSES_INTO' },
    ],
  };
}

function visualFor(node: PhantomNode) {
  const base = {
    background: '#ffffff',
    border: '#d9e0e8',
    accent: '#52606d',
    icon: <Database size={16} />,
  };

  const byType: Record<PhantomNodeType, typeof base> = {
    Phantom: { ...base, accent: '#7c3aed', icon: <Activity size={16} /> },
    WorkSpec: { ...base, accent: '#2563eb', icon: <Hexagon size={16} /> },
    FoldedEvidenceBundle: { ...base, accent: '#b45309', icon: <Database size={16} /> },
    WorkItem: { ...base, accent: '#4f46e5', icon: <Layers size={16} /> },
    WorkRun: { ...base, accent: '#059669', icon: <Play size={16} /> },
    WorkArtifact: { ...base, accent: '#db2777', icon: <BoxSelect size={16} /> },
    ReadBackClosure: { ...base, accent: '#047857', icon: <ShieldCheck size={16} /> },
  };

  const visual = byType[node.type];
  if (node.state === 'latent') return { ...visual, background: '#f8fafc', border: '#e2e8f0' };
  if (node.state === 'executing') return { ...visual, background: '#eff6ff', border: '#93c5fd' };
  if (node.state === 'materialized' || node.state === 'closed') return { ...visual, background: '#ecfdf5', border: '#86efac' };
  return visual;
}

function statusCopy(status: ProposalStatus): string {
  switch (status) {
    case 'compiled':
      return 'compiled';
    case 'submitted':
      return 'submitted';
    case 'accepted':
      return 'read-back accepted';
    case 'rejected':
      return 'rejected';
  }
}

export function PhantomCoreWorkbenchPane() {
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const track = useCanvasSession((s) => s.track);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [layout, setLayout] = useState<LayoutState>(INITIAL_LAYOUT);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('ws:101');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<LayoutPoint>({ x: 0, y: 0 });
  const [omniInput, setOmniInput] = useState('');
  const [agentState, setAgentState] = useState<'idle' | 'compiling' | 'submitting' | 'hydrating'>('idle');
  const [proposals, setProposals] = useState<PhantomCommandProposal[]>([]);
  const [candidateProjection, setCandidateProjection] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedNode = snapshot.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const trackHue = track ? `var(--sc-track-${track.replace('_', '-')})` : 'var(--sc-ink-graphite)';

  const lineage = useMemo(
    () => snapshot.edges.filter((edge) => edge.source === selectedNodeId || edge.target === selectedNodeId),
    [selectedNodeId, snapshot.edges],
  );

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, nodeId: string) {
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;

    const rect = event.currentTarget.getBoundingClientRect();
    setDragOffset({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    setDraggingNodeId(nodeId);
    setSelectedNodeId(nodeId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingNodeId || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    setLayout((current) => ({
      ...current,
      [draggingNodeId]: {
        x: event.clientX - containerRect.left - dragOffset.x,
        y: event.clientY - containerRect.top - dragOffset.y,
      },
    }));
  }

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = omniInput.trim();
    if (!raw || agentState !== 'idle') return;

    setOmniInput('');
    setAgentState('compiling');

    window.setTimeout(() => {
      const compiled = compileIntent(raw, selectedNodeId);
      setProposals((current) => [compiled, ...current].slice(0, 6));
      setAgentState('submitting');

      window.setTimeout(() => {
        if (compiled.type === 'unknown_intent') {
          setProposals((current) =>
            current.map((proposal) =>
              proposal.id === compiled.id ? { ...proposal, status: 'rejected' } : proposal,
            ),
          );
          setAgentState('idle');
          return;
        }

        setProposals((current) =>
          current.map((proposal) =>
            proposal.id === compiled.id ? { ...proposal, status: 'submitted' } : proposal,
          ),
        );
        setAgentState('hydrating');

        window.setTimeout(() => {
          setSnapshot((current) => {
            const next = simulateBackendReadback(current, compiled);
            const added = next.nodes.find((node) => !current.nodes.some((existing) => existing.id === node.id));
            if (added) {
              const parent = layout[compiled.targetId] ?? layout['ws:101'] ?? { x: 360, y: 300 };
              setLayout((currentLayout) => ({
                ...currentLayout,
                [added.id]: { x: parent.x + 390, y: parent.y + 180 },
              }));
              setSelectedNodeId(added.id);
            }
            return next;
          });
          setProposals((current) =>
            current.map((proposal) =>
              proposal.id === compiled.id ? { ...proposal, status: 'accepted' } : proposal,
            ),
          );
          setAgentState('idle');
        }, 700);
      }, 650);
    }, 500);
  }

  function toggleCandidate(nodeId: string, candidate: CandidateStrategy) {
    setCandidateProjection((current) => ({
      ...current,
      [`${nodeId}:${candidate.id}`]: !(current[`${nodeId}:${candidate.id}`] ?? candidate.selected),
    }));
  }

  function renderEdge(edge: PhantomEdge) {
    const source = layout[edge.source];
    const target = layout[edge.target];
    if (!source || !target) return null;

    const startX = source.x + NODE_WIDTH;
    const startY = source.y + 48;
    const endX = target.x;
    const endY = target.y + 48;
    const control = startX + Math.max(120, (endX - startX) / 2);
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    return (
      <g key={edge.id}>
        <path
          d={`M ${startX} ${startY} C ${control} ${startY}, ${control} ${endY}, ${endX} ${endY}`}
          fill="none"
          stroke="#b9c5d1"
          strokeWidth="2"
          markerEnd="url(#phantom-arrow)"
        />
        <rect x={midX - 58} y={midY - 11} width="116" height="22" rx="7" fill="#f8fafc" stroke="#e2e8f0" />
        <text x={midX} y={midY + 3} textAnchor="middle" fontSize="9" fill="#475569" fontWeight="700">
          {edge.semantic}
        </text>
      </g>
    );
  }

  return (
    <div
      className="sc-root"
      style={{
        height: '100%',
        minHeight: 0,
        background:
          'radial-gradient(circle at 15% 10%, rgba(79,70,229,0.12), transparent 28%), linear-gradient(135deg, #f8fafc 0%, #eef4f8 48%, #f8fafc 100%)',
        color: 'var(--sc-ink-graphite)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            padding: '12px 16px',
            border: '1px solid rgba(148,163,184,0.32)',
            borderRadius: '18px',
            background: 'rgba(255,255,255,0.86)',
            boxShadow: '0 18px 50px rgba(15,23,42,0.08)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.16), rgba(5,150,105,0.12))',
              color: trackHue,
            }}
          >
            <Network size={17} />
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
              Phantom Core Workbench
            </div>
            <div style={{ fontSize: '12px', color: 'var(--sc-ink-stone)', marginTop: '3px' }}>
              projection-only canvas · backend read-back is canonical
            </div>
          </div>
        </div>

        <div
          style={{
            pointerEvents: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(92px, 1fr))',
            gap: '8px',
          }}
        >
          {[
            ['revision', snapshot.revision],
            ['score', snapshot.metrics.lifecycleScore.toFixed(2)],
            ['orphans', snapshot.metrics.orphans],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                padding: '10px 12px',
                border: '1px solid rgba(148,163,184,0.25)',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.78)',
                boxShadow: '0 14px 36px rgba(15,23,42,0.06)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--sc-ink-fog)' }}>
                {label}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </header>

      <main
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingNodeId(null)}
        onPointerLeave={() => setDraggingNodeId(null)}
        onClick={(event) => {
          if (event.target === containerRef.current) setSelectedNodeId(null);
        }}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'auto',
          cursor: draggingNodeId ? 'grabbing' : 'grab',
          backgroundImage: 'radial-gradient(rgba(100,116,139,0.22) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      >
        <div style={{ position: 'relative', width: '2240px', height: '980px' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <marker id="phantom-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            {snapshot.edges.map(renderEdge)}
          </svg>

          {snapshot.nodes.map((node) => {
            const pos = layout[node.id] ?? { x: 0, y: 0 };
            const selected = node.id === selectedNodeId;
            const visual = visualFor(node);

            return (
              <div
                key={node.id}
                onPointerDown={(event) => handlePointerDown(event, node.id)}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  width: `${NODE_WIDTH}px`,
                  border: `1px solid ${selected ? visual.accent : visual.border}`,
                  borderRadius: '20px',
                  background: visual.background,
                  boxShadow: selected ? '0 22px 70px rgba(15,23,42,0.16)' : '0 12px 30px rgba(15,23,42,0.08)',
                  transform: selected ? 'scale(1.015)' : 'scale(1)',
                  transition: 'box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(15,23,42,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: visual.accent }}>
                    {visual.icon}
                    <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                      {node.type}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', color: '#94a3b8' }}>{node.id}</span>
                </div>

                <div style={{ padding: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', lineHeight: 1.25, color: '#0f172a' }}>{node.title}</h3>
                  <div
                    style={{
                      display: 'inline-flex',
                      marginTop: '10px',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      background: 'rgba(15,23,42,0.06)',
                      color: '#334155',
                      fontFamily: 'var(--sc-font-mono)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {node.state}
                  </div>

                  {node.validationRules && (
                    <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {node.validationRules.map((rule) => (
                        <span key={rule} style={{ padding: '4px 7px', borderRadius: '8px', background: 'rgba(37,99,235,0.08)', color: '#1e40af', fontSize: '10px' }}>
                          {rule}
                        </span>
                      ))}
                    </div>
                  )}

                  {node.hash && (
                    <div style={{ marginTop: '12px', padding: '9px', borderRadius: '10px', background: 'rgba(255,255,255,0.62)', fontFamily: 'var(--sc-font-mono)', fontSize: '10px', color: '#64748b' }}>
                      hash {node.hash}
                    </div>
                  )}

                  {node.candidates && node.candidates.length > 0 && (
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
                      <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', color: '#64748b', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '8px' }}>
                        local projection toggles
                      </div>
                      {node.candidates.map((candidate) => {
                        const key = `${node.id}:${candidate.id}`;
                        const active = candidateProjection[key] ?? candidate.selected;
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCandidate(node.id, candidate);
                            }}
                            style={{
                              display: 'flex',
                              width: '100%',
                              gap: '8px',
                              alignItems: 'flex-start',
                              padding: '4px 0',
                              border: 0,
                              background: 'transparent',
                              color: active ? '#0f172a' : '#94a3b8',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '11px',
                            }}
                          >
                            {active ? <CheckCircle2 size={13} color="#059669" /> : <Circle size={13} />}
                            <span>{candidate.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {typeof node.progress === 'number' && (
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(15,23,42,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>
                        <span>{node.agent}</span>
                        <span>{node.progress}%</span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(15,23,42,0.1)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${node.progress}%`, background: visual.accent }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <aside
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '380px',
          zIndex: 30,
          transform: selectedNode ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 260ms ease',
          background: 'rgba(255,255,255,0.93)',
          borderLeft: '1px solid rgba(148,163,184,0.34)',
          boxShadow: '-28px 0 80px rgba(15,23,42,0.16)',
          backdropFilter: 'blur(18px)',
          padding: '22px',
          overflowY: 'auto',
        }}
      >
        {selectedNode && (
          <>
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              style={{ float: 'right', border: 0, background: '#f1f5f9', borderRadius: '999px', width: '30px', height: '30px', cursor: 'pointer' }}
              aria-label="Close context explorer"
            >
              <X size={14} />
            </button>
            <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '10px', color: '#64748b', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Context Explorer
            </div>
            <h2 style={{ fontSize: '25px', lineHeight: 1.12, margin: '18px 0 6px', color: '#0f172a' }}>{selectedNode.title}</h2>
            <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '11px', color: '#94a3b8' }}>
              {selectedNode.id} · {selectedNode.type}
            </div>

            <section style={{ marginTop: '24px', padding: '16px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 12px', fontFamily: 'var(--sc-font-mono)', fontSize: '10px', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Graph lineage
              </h3>
              {lineage.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#64748b' }}>No linked lineage in current snapshot.</div>
              ) : (
                lineage.map((edge) => {
                  const incoming = edge.target === selectedNodeId;
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
                        gap: '5px',
                        padding: '10px 0',
                        border: 0,
                        borderBottom: '1px solid #e2e8f0',
                        background: 'transparent',
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
              <h3 style={{ margin: '0 0 10px', fontFamily: 'var(--sc-font-mono)', fontSize: '10px', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Canonical snapshot payload
              </h3>
              <pre style={{ margin: 0, padding: '14px', borderRadius: '14px', background: '#0f172a', color: '#cbd5e1', fontSize: '10px', overflowX: 'auto' }}>
                {JSON.stringify(selectedNode, null, 2)}
              </pre>
            </section>
          </>
        )}
      </aside>

      <footer
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '24px',
          transform: 'translateX(-50%)',
          width: 'min(820px, calc(100% - 40px))',
          zIndex: 40,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 260px',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <form
            onSubmit={submitCommand}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              borderRadius: '22px',
              background: 'rgba(255,255,255,0.94)',
              border: '1px solid rgba(148,163,184,0.36)',
              boxShadow: '0 24px 80px rgba(15,23,42,0.16)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <div style={{ color: trackHue, paddingLeft: '8px' }}>
              {agentState === 'idle' ? <Sparkles size={18} /> : <Activity size={18} />}
            </div>
            <input
              value={omniInput}
              onChange={(event) => setOmniInput(event.target.value)}
              disabled={agentState !== 'idle'}
              placeholder={selectedNode ? `Compile intent for ${selectedNode.type}: add, start, ground, verify...` : 'Compile a PhantomCommand...'}
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                background: 'transparent',
                color: '#0f172a',
                fontSize: '14px',
              }}
            />
            <button
              type="submit"
              disabled={!omniInput.trim() || agentState !== 'idle'}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '14px',
                border: 0,
                display: 'grid',
                placeItems: 'center',
                background: omniInput.trim() ? trackHue : '#e2e8f0',
                color: omniInput.trim() ? '#fff' : '#94a3b8',
                cursor: omniInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <ArrowRight size={16} />
            </button>
          </form>

          <div
            style={{
              padding: '12px',
              borderRadius: '18px',
              background: 'rgba(15,23,42,0.9)',
              color: '#e2e8f0',
              boxShadow: '0 24px 80px rgba(15,23,42,0.18)',
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '10px',
            }}
          >
            <div style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '6px' }}>
              {agentState === 'idle' ? 'last proposals' : agentState}
            </div>
            {proposals.length === 0 ? (
              <div style={{ color: '#64748b' }}>No command proposals yet.</div>
            ) : (
              proposals.slice(0, 2).map((proposal) => (
                <div key={proposal.id} style={{ padding: '6px 0', borderTop: '1px solid rgba(148,163,184,0.22)' }}>
                  <div style={{ color: proposal.status === 'accepted' ? '#86efac' : proposal.status === 'rejected' ? '#fca5a5' : '#cbd5e1' }}>
                    {proposal.type} · {statusCopy(proposal.status)}
                  </div>
                  <div style={{ color: '#94a3b8', marginTop: '2px' }}>{proposal.expectedMutation}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
          Session {canvasSessionId ? canvasSessionId.slice(0, 8) : 'none'} · {snapshot.domain} · hydrated {snapshot.hydratedAt}
        </div>
      </footer>
    </div>
  );
}
