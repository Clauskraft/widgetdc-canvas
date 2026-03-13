import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rfAddEdge,
} from '@xyflow/react';
import type { CanvasNodeData, CanvasNodeType, ProvenanceData } from '../types/canvas';
import { applyDagreLayout, alignNodesToColumns } from '../lib/layout';
import { graphRead, graphWrite, graphExpand, graphNeighborSearch, mcpCall, reasonCall, isComplianceQuery, getComplianceGaps, type ComplianceGapRecord, type ReasonResponse } from '../lib/api';
import { CANVAS_TEMPLATES, ENGAGEMENT_COLUMNS, type CanvasTemplate } from '../templates';
import { fetchNotebookContext } from '../lib/connectors';

// --- Undo/Redo snapshot ---
interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_UNDO = 50;

// --- Filter state ---
interface FilterState {
  relTypes: string[];
  searchText: string;
  timeRange?: { from: string; to: string };
}

// Expand state for progressive loading
interface ExpandState {
  nodeId: string;
  totalAvailable: number;
  loaded: number;
  hasMore: boolean;
}

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  layoutMode: 'mindmap' | 'freeform';
  canvasId: string;
  isLoading: boolean;
  aiPanelOpen: boolean;
  toolPaletteOpen: boolean;
  selectedNodeId: string | null;
  knowledgeExplorerMode: boolean;
  gapOverlayMode: boolean;

  // Undo/Redo
  undoStack: CanvasSnapshot[];
  redoStack: CanvasSnapshot[];

  // Filters
  filterState: FilterState;

  // Progressive expand state
  expandStates: Map<string, ExpandState>;

  // Core handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Node operations
  addNode: (type: CanvasNodeType, label: string, subtitle?: string, position?: { x: number; y: number }, provenance?: ProvenanceData) => void;
  addNodeWithData: (type: CanvasNodeType, data: Partial<CanvasNodeData>, position?: { x: number; y: number }) => string;
  removeSelected: () => void;
  setLayoutMode: (mode: 'mindmap' | 'freeform') => void;
  toggleAiPanel: () => void;
  toggleToolPalette: () => void;
  toggleKnowledgeExplorer: () => void;
  toggleGapOverlay: (frameworkId?: string) => Promise<void>;
  selectNode: (id: string | null) => void;
  applyLayout: (direction?: 'TB' | 'LR') => void;

  // Undo/Redo
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Graph operations
  addNodesFromGraph: (records: unknown[], nodeType: CanvasNodeType, labelField?: string, provenance?: ProvenanceData) => void;
  saveToGraph: () => Promise<void>;
  loadFromGraph: (canvasId?: string) => Promise<void>;
  clearCanvas: () => void;

  // Canvas 5X: Graph Exploder (progressive, 20 limit)
  expandNode: (nodeId: string, relTypes?: string[], depth?: number) => Promise<void>;
  expandMore: (nodeId: string) => Promise<void>;
  groupSelected: () => void;
  ungroupCombo: (comboId: string) => void;

  // Canvas 5X: Query execution
  executeQueryNode: (nodeId: string) => Promise<void>;

  // Canvas 5X: AI Reasoning
  reason: (query: string) => Promise<ReasonResponse>;
  injectToCanvas: (text: string, nodeType?: CanvasNodeType) => string;

  // Canvas 5X: Tender Matching (G3)
  matchTenders: (nodeId: string) => Promise<void>;

  // Loop 1: Zero-Latency Creation
  addThoughtNodeAt: (position: { x: number; y: number }) => string;

  // Strategic 10: Autonomous Intelligence
  autoAnalyze: (nodeId: string) => Promise<void>;
  generateNarrative: () => Promise<string>;
  evaluateHypothesis: (thoughtNodeId: string) => Promise<void>;
  discoverPatterns: () => Promise<void>;
  loadTemplate: (templateId: string) => Promise<void>;
  alignLayout: () => void;

  // Toast callback (set by provider)
  _toast?: (type: 'success' | 'error' | 'info', msg: string) => void;
  setToast: (fn: (type: 'success' | 'error' | 'info', msg: string) => void) => void;

  // Filters
  setFilter: (filter: Partial<FilterState>) => void;

  // S21: Engagement Replay Engine
  engagementId: string | null;
  setEngagement: (id: string | null) => void;
  recordStep: (actionType: string, nodeContext: string, outcome?: 'kept' | 'discarded') => void;
  replayEngagement: (engagementId: string) => Promise<void>;

  // S22: Cross-Client Intelligence Fabric
  crossReference: (nodeId: string) => Promise<void>;

  // S23: Confidence-Weighted Decision Architecture
  recommendNextActions: (nodeId: string) => Promise<ActionRecommendation[]>;

  // S24: Provenance Audit Trail
  exportAuditTrail: (format: 'json' | 'markdown') => Promise<string>;

  // S25: Canvas-as-API
  runAnalysisPipeline: (entityName: string, templateId?: string) => Promise<{ nodeCount: number; narrative: string }>;

  // S26: Contextual Node Chat / Commands
  executeNodeCommand: (nodeId: string, command: string) => Promise<void>;
}

export interface ActionRecommendation {
  action: string;
  label: string;
  confidence: number;
  reasoning: string;
  proactive?: boolean;
  targetNodeId?: string;
}

let nodeIdCounter = 0;
function nextNodeId() {
  return `node-${Date.now()}-${++nodeIdCounter}`;
}

function nodeTypeFromLabel(label: string): CanvasNodeType {
  const l = label.toLowerCase();
  if (l.includes('agent')) return 'agent';
  if (l.includes('tool') || l.includes('mcp')) return 'tool';
  if (l.includes('service') || l.includes('server')) return 'server';
  if (l.includes('endpoint') || l.includes('api')) return 'endpoint';
  if (l.includes('insight') || l.includes('finding')) return 'insight';
  if (l.includes('evidence') || l.includes('document')) return 'evidence';
  if (l.includes('pipeline') || l.includes('workflow')) return 'pipeline';
  if (l.includes('thought') || l.includes('reason') || l.includes('decision')) return 'thought';
  if (l.includes('lesson') || l.includes('memory')) return 'thought';
  return 'entity';
}

const PROGRESSIVE_EXPAND_LIMIT = 20;

interface VisualEnrichment {
  regulatoryLevel?: 'strict' | 'guideline' | 'info';
  complianceScore?: number;
  signalIntensity?: number;
  isRejected?: boolean;
  rejectionReason?: string;
  subtitle?: string;
}

function enrichVisualProperties(
  labels: string[],
  props: Record<string, unknown>,
): VisualEnrichment {
  const result: VisualEnrichment = {};

  if (labels.includes('ComplianceGap')) {
    const sev = String(props.severity ?? 'medium').toLowerCase();
    result.regulatoryLevel = sev === 'critical' ? 'strict' : sev === 'high' ? 'guideline' : 'info';
    result.complianceScore = ({ critical: 0.2, high: 0.5, medium: 0.7, low: 0.9 } as Record<string, number>)[sev] ?? 0.7;
    result.signalIntensity = sev === 'critical' ? 0.9 : sev === 'high' ? 0.7 : 0.4;
  }

  if (labels.includes('RiskAssessment')) {
    const sev = String(props.severity ?? 'INFO').toUpperCase();
    result.regulatoryLevel = sev === 'CRITICAL' ? 'strict' : sev === 'WARNING' ? 'guideline' : 'info';
    result.complianceScore = props.resolved ? 1.0 : ({ CRITICAL: 0.15, WARNING: 0.5, INFO: 0.8 } as Record<string, number>)[sev] ?? 0.7;
    result.isRejected = Boolean(props.resolved);
    result.signalIntensity = sev === 'CRITICAL' ? 0.95 : sev === 'WARNING' ? 0.7 : 0.3;
  }

  if (labels.includes('TenderRequirement')) {
    const conf = Number(props.confidence ?? 0.5);
    result.complianceScore = conf;
    result.signalIntensity = conf > 0.8 ? 0.85 : 0.5;
    result.subtitle = String(props.category ?? '');
  }

  if (labels.includes('GhostNode')) {
    result.isRejected = props.status === 'REJECTED';
    result.rejectionReason = String(props.rejection_reason ?? '');
    result.signalIntensity = 1.0 - Number(props.uncertainty ?? 0.5);
  }

  if (labels.includes('KnowledgeGap')) {
    const pri = String(props.priority ?? 'medium').toLowerCase();
    result.regulatoryLevel = pri === 'critical' ? 'strict' : pri === 'high' ? 'guideline' : 'info';
    result.complianceScore = 0.0;
    result.signalIntensity = Number(props.detectionConfidence ?? 0.6);
  }

  if (labels.includes('StrategicInsight')) {
    const conf = Number(props.confidence ?? 0.5);
    result.complianceScore = conf;
    result.signalIntensity = conf > 0.7 ? 0.8 : 0.5;
    result.subtitle = String(props.domain ?? '');
  }

  if (labels.includes('AgentMemory')) {
    result.signalIntensity = props.type === 'teaching' ? 0.7 : 0.4;
    result.subtitle = String(props.agentId ?? '');
  }

  if (labels.includes('ExternalKnowledge')) {
    result.regulatoryLevel = 'info';
    result.signalIntensity = 0.5;
    result.subtitle = String(props.source ?? '');
  }

  if (labels.includes('DomainSnapshot')) {
    const sev = String(props.riskSeverity ?? '').toUpperCase();
    result.complianceScore = ({ CRITICAL: 0.15, WARNING: 0.5, INFO: 0.8 } as Record<string, number>)[sev] ?? 0.7;
    result.signalIntensity = sev === 'CRITICAL' ? 0.9 : sev === 'WARNING' ? 0.7 : 0.4;
    result.subtitle = String(props.effectiveness ?? '');
  }

  return result;
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      layoutMode: 'freeform',
      canvasId: 'default',
      isLoading: false,
      aiPanelOpen: false,
      toolPaletteOpen: false,
      selectedNodeId: null,
      knowledgeExplorerMode: false,
      gapOverlayMode: false,
      undoStack: [],
      redoStack: [],
      filterState: { relTypes: [], searchText: '' },
      expandStates: new Map(),
      engagementId: null,

      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      },

      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
      },

      onConnect: (connection) => {
        set({ edges: rfAddEdge({ ...connection, id: `edge-${Date.now()}` }, get().edges) });
      },

      pushSnapshot: () => {
        const { nodes, edges, undoStack } = get();
        const snapshot: CanvasSnapshot = {
          nodes: nodes.map(n => ({ ...n })),
          edges: edges.map(e => ({ ...e })),
        };
        const stack = [...undoStack, snapshot].slice(-MAX_UNDO);
        set({ undoStack: stack, redoStack: [] });
      },

      undo: () => {
        const { undoStack, nodes, edges } = get();
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        const current: CanvasSnapshot = { nodes: [...nodes], edges: [...edges] };
        set({
          nodes: prev.nodes,
          edges: prev.edges,
          undoStack: undoStack.slice(0, -1),
          redoStack: [...get().redoStack, current],
        });
      },

      redo: () => {
        const { redoStack, nodes, edges } = get();
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        const current: CanvasSnapshot = { nodes: [...nodes], edges: [...edges] };
        set({
          nodes: next.nodes,
          edges: next.edges,
          redoStack: redoStack.slice(0, -1),
          undoStack: [...get().undoStack, current],
        });
      },

      addNode: (type, label, subtitle, position, provenance) => {
        get().pushSnapshot();
        const id = nextNodeId();
        const { nodes, edges, layoutMode } = get();
        const newNode: Node = {
          id,
          type,
          position: position ?? { x: 100 + Math.random() * 400, y: 100 + Math.random() * 400 },
          data: { label, subtitle, nodeType: type, provenance },
        };
        const updatedNodes = [...nodes, newNode];
        if (layoutMode === 'mindmap') {
          set({ nodes: applyDagreLayout(updatedNodes, edges) });
        } else {
          set({ nodes: updatedNodes });
        }
      },

      addNodeWithData: (type, data, position) => {
        get().pushSnapshot();
        const id = nextNodeId();
        const { nodes, edges, layoutMode } = get();
        const newNode: Node = {
          id,
          type,
          position: position ?? { x: 100 + Math.random() * 600, y: 100 + Math.random() * 600 },
          data: { label: 'New Node', nodeType: type, ...data },
        };
        const updatedNodes = [...nodes, newNode];
        if (layoutMode === 'mindmap') {
          set({ nodes: applyDagreLayout(updatedNodes, edges) });
        } else {
          set({ nodes: updatedNodes });
        }
        return id;
      },

      removeSelected: () => {
        get().pushSnapshot();
        const { nodes, edges, selectedNodeId } = get();
        if (!selectedNodeId) return;
        set({
          nodes: nodes.filter((n) => n.id !== selectedNodeId),
          edges: edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
          selectedNodeId: null,
        });
      },

      setLayoutMode: (mode) => {
        const { nodes, edges } = get();
        if (mode === 'mindmap') {
          set({ layoutMode: mode, nodes: applyDagreLayout(nodes, edges) });
        } else {
          set({ layoutMode: mode });
        }
      },

      toggleAiPanel: () => set({ aiPanelOpen: !get().aiPanelOpen }),
      toggleToolPalette: () => set({ toolPaletteOpen: !get().toolPaletteOpen }),
      toggleKnowledgeExplorer: () => set({ knowledgeExplorerMode: !get().knowledgeExplorerMode }),
      toggleGapOverlay: async (frameworkId) => {
        const { gapOverlayMode, nodes, edges } = get();
        if (gapOverlayMode) {
          const remainingNodes = nodes.filter(n => !(n.data.metadata as Record<string, unknown> | undefined)?.gapOverlay);
          const remainingNodeIds = new Set(remainingNodes.map(n => n.id));
          set({
            gapOverlayMode: false,
            nodes: remainingNodes,
            edges: edges.filter(e => remainingNodeIds.has(e.source) && remainingNodeIds.has(e.target)),
          });
          return;
        }

        set({ isLoading: true });
        try {
          get().pushSnapshot();
          const gaps = await getComplianceGaps(frameworkId);
          if (!gaps.length) {
            set({ gapOverlayMode: true });
            return;
          }

          const overlayNodes: Node[] = [];
          const overlayEdges: Edge[] = [];
          const existingKeys = new Set(nodes.map(n => `${n.data.label}|${n.data.subtitle ?? ''}`));
          const baseX = 120;
          const baseY = 120;

          gaps.slice(0, 24).forEach((gap: ComplianceGapRecord, index) => {
            const title = gap.description || gap.gap_type || gap.control_id || gap.obligation_id || 'Compliance gap';
            const subtitle = [gap.framework_name || frameworkId || 'framework', gap.severity || 'unknown'].join(' • ');
            const dedupeKey = `${title}|${subtitle}`;
            if (existingKeys.has(dedupeKey)) return;

            const nodeId = nextNodeId();
            const severity = String(gap.severity ?? 'medium').toLowerCase();
            overlayNodes.push({
              id: nodeId,
              type: 'insight',
              position: {
                x: baseX + (index % 4) * 260,
                y: baseY + Math.floor(index / 4) * 110,
              },
              data: {
                label: title.slice(0, 72),
                subtitle,
                nodeType: 'insight',
                regulatoryLevel: severity === 'critical' ? 'strict' : severity === 'high' ? 'guideline' : 'info',
                complianceScore: severity === 'critical' ? 15 : severity === 'high' ? 45 : 70,
                signalIntensity: severity === 'critical' ? 0.95 : severity === 'high' ? 0.75 : 0.55,
                metadata: {
                  gapOverlay: true,
                  frameworkId: gap.framework_id,
                  controlId: gap.control_id,
                  obligationId: gap.obligation_id,
                  evidenceId: gap.evidence_id,
                  gapType: gap.gap_type,
                },
                provenance: {
                  createdBy: 'ai',
                  createdAt: new Date().toISOString(),
                  source: '/intelligence/compliance-gaps',
                },
              },
            });

            const relatedNode = nodes.find(n =>
              String(n.data.label ?? '').toLowerCase().includes(String(gap.framework_name ?? frameworkId ?? '').toLowerCase())
            );
            if (relatedNode) {
              overlayEdges.push({
                id: `edge-gap-${Date.now()}-${index}`,
                source: relatedNode.id,
                target: nodeId,
                label: 'GAP',
              });
            }
          });

          set({
            gapOverlayMode: true,
            nodes: [...nodes, ...overlayNodes],
            edges: [...edges, ...overlayEdges],
          });
        } finally {
          set({ isLoading: false });
        }
      },
      selectNode: (id) => set({ selectedNodeId: id }),

      applyLayout: (direction = 'TB') => {
        const { nodes, edges } = get();
        set({ nodes: applyDagreLayout(nodes, edges, direction) });
      },

      addNodesFromGraph: (records, nodeType, labelField = 'name', provenance) => {
        get().pushSnapshot();
        const { nodes, edges, layoutMode } = get();
        const newNodes: Node[] = [];

        for (const rec of records) {
          const r = rec as Record<string, unknown>;
          const nObj = r?.n as Record<string, unknown> | undefined;
          const aObj = r?.a as Record<string, unknown> | undefined;
          const mObj = r?.m as Record<string, unknown> | undefined;
          const props = (nObj?.properties as Record<string, unknown>)
            ?? (aObj?.properties as Record<string, unknown>)
            ?? (mObj?.properties as Record<string, unknown>)
            ?? r;
          const label = String(props?.[labelField] ?? (props?.id as string) ?? 'Unknown');
          const subtitle = String(props?.description ?? props?.role ?? '');
          const id = nextNodeId();
          newNodes.push({
            id,
            type: nodeType,
            position: { x: 100 + Math.random() * 600, y: 100 + Math.random() * 600 },
            data: {
              label,
              subtitle: subtitle || undefined,
              nodeType,
              provenance: provenance ?? {
                createdBy: 'query',
                createdAt: new Date().toISOString(),
                source: 'graph.read_cypher',
              },
            },
          });
        }

        const updatedNodes = [...nodes, ...newNodes];
        if (layoutMode === 'mindmap') {
          set({ nodes: applyDagreLayout(updatedNodes, edges) });
        } else {
          set({ nodes: updatedNodes });
        }
      },

      saveToGraph: async () => {
        const { nodes, edges, canvasId } = get();
        set({ isLoading: true });
        try {
          await graphWrite('MATCH (n:CanvasNode {canvasId: $canvasId}) DETACH DELETE n', { canvasId });
          await graphWrite('MATCH (e:CanvasEdge {canvasId: $canvasId}) DETACH DELETE e', { canvasId });

          for (const node of nodes) {
            const d = node.data as CanvasNodeData;
            const prov = d.provenance;
            await graphWrite(
              `MERGE (n:CanvasNode {id: $id, canvasId: $canvasId})
               SET n.label = $label, n.nodeType = $nodeType, n.subtitle = $subtitle,
                   n.posX = $posX, n.posY = $posY,
                   n.provenance_createdBy = $provCreatedBy,
                   n.provenance_source = $provSource,
                   n.provenance_tool = $provTool,
                   n.provenance_createdAt = $provCreatedAt,
                   n.provenance_reasoning = $provReasoning,
                   n.regulatoryLevel = $regulatoryLevel,
                   n.complianceScore = $complianceScore,
                   n.signalIntensity = $signalIntensity,
                   n.isRejected = $isRejected,
                   n.rejectionReason = $rejectionReason,
                   n.thinkingSteps = $thinkingSteps,
                   n.reasoningStatus = $reasoningStatus,
                   n.updatedAt = datetime()`,
              {
                id: node.id, canvasId,
                label: d.label,
                nodeType: d.nodeType,
                subtitle: d.subtitle ?? '',
                posX: node.position.x, posY: node.position.y,
                provCreatedBy: prov?.createdBy ?? '',
                provSource: prov?.source ?? '',
                provTool: prov?.tool ?? '',
                provCreatedAt: prov?.createdAt ?? '',
                provReasoning: (prov as unknown as Record<string, unknown>)?.reasoning ?? '',
                regulatoryLevel: d.regulatoryLevel ?? '',
                complianceScore: d.complianceScore ?? null,
                signalIntensity: d.signalIntensity ?? null,
                isRejected: d.isRejected ?? false,
                rejectionReason: d.rejectionReason ?? '',
                thinkingSteps: d.thinkingSteps ? JSON.stringify(d.thinkingSteps) : '',
                reasoningStatus: d.reasoningStatus ?? '',
              },
            );
          }

          for (const edge of edges) {
            await graphWrite(
              `MERGE (e:CanvasEdge {id: $id, canvasId: $canvasId})
               SET e.source = $source, e.target = $target, e.label = $label,
                   e.updatedAt = datetime()`,
              { id: edge.id, canvasId, source: edge.source, target: edge.target, label: (edge as Edge & { label?: string }).label ?? '' },
            );
          }
        } finally {
          set({ isLoading: false });
        }
      },

      loadFromGraph: async (id) => {
        const canvasId = id ?? get().canvasId;
        set({ isLoading: true, canvasId });
        try {
          const nodeRecords = await graphRead(
            'MATCH (n:CanvasNode {canvasId: $canvasId}) RETURN n, labels(n) AS nodeLabels',
            { canvasId },
          ) as Record<string, unknown>[];
          const edgeRecords = await graphRead(
            'MATCH (e:CanvasEdge {canvasId: $canvasId}) RETURN e',
            { canvasId },
          ) as Record<string, unknown>[];

          const nodes: Node[] = (nodeRecords ?? []).map((rec) => {
            const r = rec as Record<string, unknown>;
            const nObj = r?.n as Record<string, unknown> | undefined;
            const p = (nObj?.properties as Record<string, unknown>) ?? nObj ?? {};
            const nodeLabels = (r?.nodeLabels as string[]) ?? ['CanvasNode'];

            const hasProvenance = p.provenance_createdBy && String(p.provenance_createdBy) !== '';
            const provenance: ProvenanceData | undefined = hasProvenance ? {
              createdBy: String(p.provenance_createdBy) as ProvenanceData['createdBy'],
              createdAt: String(p.provenance_createdAt ?? ''),
              source: String(p.provenance_source ?? ''),
              tool: p.provenance_tool ? String(p.provenance_tool) : undefined,
            } : undefined;

            let thinkingSteps: string[] | undefined;
            if (p.thinkingSteps && String(p.thinkingSteps) !== '') {
              try { thinkingSteps = JSON.parse(String(p.thinkingSteps)); } catch { /* ignore */ }
            }

            const enrichment = enrichVisualProperties(nodeLabels, p);

            return {
              id: String(p.id ?? nextNodeId()),
              type: String(p.nodeType ?? 'entity'),
              position: { x: Number(p.posX ?? 0), y: Number(p.posY ?? 0) },
              data: {
                label: String(p.label ?? 'Unknown'),
                subtitle: enrichment.subtitle || (p.subtitle ? String(p.subtitle) : undefined),
                nodeType: (p.nodeType ?? 'entity') as CanvasNodeType,
                provenance,
                thinkingSteps,
                reasoningStatus: p.reasoningStatus ? String(p.reasoningStatus) as CanvasNodeData['reasoningStatus'] : undefined,
                regulatoryLevel: (p.regulatoryLevel && String(p.regulatoryLevel) !== ''
                  ? String(p.regulatoryLevel) : enrichment.regulatoryLevel) as CanvasNodeData['regulatoryLevel'],
                complianceScore: p.complianceScore != null
                  ? Number(p.complianceScore) : enrichment.complianceScore,
                signalIntensity: p.signalIntensity != null
                  ? Number(p.signalIntensity) : enrichment.signalIntensity,
                isRejected: p.isRejected === true || enrichment.isRejected,
                rejectionReason: (p.rejectionReason && String(p.rejectionReason) !== ''
                  ? String(p.rejectionReason) : enrichment.rejectionReason),
              } as CanvasNodeData,
            };
          });

          const edges: Edge[] = (edgeRecords ?? []).map((rec) => {
            const r = rec as Record<string, unknown>;
            const eObj = r?.e as Record<string, unknown> | undefined;
            const p = (eObj?.properties as Record<string, unknown>) ?? eObj ?? {};
            return {
              id: String(p.id ?? `edge-${Date.now()}`),
              source: String(p.source ?? ''),
              target: String(p.target ?? ''),
            };
          });

          set({ nodes, edges });
        } finally {
          set({ isLoading: false });
        }
      },

      clearCanvas: () => {
        get().pushSnapshot();
        set({ nodes: [], edges: [], selectedNodeId: null });
      },

      expandNode: async (nodeId, relTypes, depth = 1) => {
        const { nodes } = get();
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        const label = node.data.label as string;

        set({ isLoading: true });
        try {
          get().pushSnapshot();
          let neighborRecords: unknown[];
          try {
            const expandResult = await graphExpand(label, { depth, relTypes, limit: 100 });
            neighborRecords = expandResult.nodes ?? [];
          } catch {
            neighborRecords = await graphNeighborSearch(label, relTypes, 100);
          }

          if (!neighborRecords.length) return;

          const totalAvailable = neighborRecords.length;
          const batch = neighborRecords.slice(0, PROGRESSIVE_EXPAND_LIMIT);

          const expandStates = new Map(get().expandStates);
          expandStates.set(nodeId, {
            nodeId,
            totalAvailable,
            loaded: batch.length,
            hasMore: totalAvailable > PROGRESSIVE_EXPAND_LIMIT,
          });

          const parentPos = node.position;
          const angleStep = (2 * Math.PI) / Math.max(batch.length, 1);
          const radius = 200;
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];

          for (let i = 0; i < batch.length; i++) {
            const rec = batch[i] as Record<string, unknown>;
            const mObj = rec?.m as Record<string, unknown> | undefined;
            const props = (mObj?.properties as Record<string, unknown>) ?? rec;
            const name = String(props?.name ?? props?.id ?? 'Unknown');
            const nLabel = String(rec?.nodeLabel ?? rec?.label ?? '');
            const relType = String(rec?.relType ?? 'RELATED');
            const nType = nodeTypeFromLabel(nLabel || name);
            const nId = nextNodeId();

            newNodes.push({
              id: nId,
              type: nType,
              position: {
                x: parentPos.x + radius * Math.cos(angleStep * i),
                y: parentPos.y + radius * Math.sin(angleStep * i),
              },
              data: {
                label: name,
                subtitle: nLabel || relType,
                nodeType: nType,
                provenance: {
                  createdBy: 'expand',
                  createdAt: new Date().toISOString(),
                  source: `graph.expand from "${label}"`,
                  parentNodeId: nodeId,
                },
              },
            });

            newEdges.push({
              id: `edge-expand-${Date.now()}-${i}`,
              source: nodeId,
              target: nId,
              label: relType,
            });
          }

          set(state => ({
            nodes: [...state.nodes, ...newNodes],
            edges: [...state.edges, ...newEdges],
            expandStates,
          }));
          get().recordStep('expand', label);
        } finally {
          set({ isLoading: false });
        }
      },

      expandMore: async (nodeId) => {
        const state = get().expandStates.get(nodeId);
        if (!state || !state.hasMore) return;

        const { nodes, edges } = get();
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        const label = node.data.label as string;

        set({ isLoading: true });
        try {
          get().pushSnapshot();
          let neighborRecords: unknown[];
          try {
            const expandResult = await graphExpand(label, { depth: 1, limit: 100 });
            neighborRecords = expandResult.nodes ?? [];
          } catch {
            neighborRecords = await graphNeighborSearch(label, undefined, 100);
          }

          const nextBatch = neighborRecords.slice(state.loaded, state.loaded + PROGRESSIVE_EXPAND_LIMIT);
          if (!nextBatch.length) return;

          const parentPos = node.position;
          const angleStep = (2 * Math.PI) / Math.max(nextBatch.length, 1);
          const radius = 300 + (state.loaded / PROGRESSIVE_EXPAND_LIMIT) * 100;
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];

          for (let i = 0; i < nextBatch.length; i++) {
            const rec = nextBatch[i] as Record<string, unknown>;
            const mObj = rec?.m as Record<string, unknown> | undefined;
            const props = (mObj?.properties as Record<string, unknown>) ?? rec;
            const name = String(props?.name ?? props?.id ?? 'Unknown');
            const nLabel = String(rec?.nodeLabel ?? rec?.label ?? '');
            const relType = String(rec?.relType ?? 'RELATED');
            const nType = nodeTypeFromLabel(nLabel || name);
            const nId = nextNodeId();

            newNodes.push({
              id: nId,
              type: nType,
              position: {
                x: parentPos.x + radius * Math.cos(angleStep * i),
                y: parentPos.y + radius * Math.sin(angleStep * i),
              },
              data: {
                label: name,
                subtitle: nLabel || relType,
                nodeType: nType,
                provenance: {
                  createdBy: 'expand',
                  createdAt: new Date().toISOString(),
                  source: `graph.expand from "${label}" (page ${Math.floor(state.loaded / PROGRESSIVE_EXPAND_LIMIT) + 1})`,
                  parentNodeId: nodeId,
                },
              },
            });

            newEdges.push({
              id: `edge-exp-${Date.now()}-${i}`,
              source: nodeId,
              target: nId,
              label: relType,
            });
          }

          const expandStates = new Map(get().expandStates);
          const newLoaded = state.loaded + nextBatch.length;
          expandStates.set(nodeId, {
            ...state,
            loaded: newLoaded,
            hasMore: newLoaded < state.totalAvailable,
          });

          set(state => ({
            nodes: [...state.nodes, ...newNodes],
            edges: [...state.edges, ...newEdges],
            expandStates,
          }));
        } finally {
          set({ isLoading: false });
        }
      },

      groupSelected: () => {
        const { nodes, edges, selectedNodeId } = get();
        if (!selectedNodeId) return;

        get().pushSnapshot();
        const comboId = nextNodeId();
        const selectedNode = nodes.find(n => n.id === selectedNodeId);
        if (!selectedNode) return;

        const connectedIds = new Set<string>();
        connectedIds.add(selectedNodeId);
        for (const e of edges) {
          if (e.source === selectedNodeId) connectedIds.add(e.target);
          if (e.target === selectedNodeId) connectedIds.add(e.source);
        }

        if (connectedIds.size <= 1) return;

        const groupNodes = nodes.filter(n => connectedIds.has(n.id));
        const cx = groupNodes.reduce((s, n) => s + n.position.x, 0) / groupNodes.length;
        const cy = groupNodes.reduce((s, n) => s + n.position.y, 0) / groupNodes.length;

        const comboNode: Node = {
          id: comboId,
          type: 'combo',
          position: { x: cx, y: cy },
          data: {
            label: `Group (${selectedNode.data.label})`,
            nodeType: 'combo' as CanvasNodeType,
            childCount: connectedIds.size,
            metadata: { childIds: Array.from(connectedIds) },
          },
        };

        const remainingNodes = nodes.filter(n => !connectedIds.has(n.id));
        const remainingEdges = edges
          .filter(e => !connectedIds.has(e.source) || !connectedIds.has(e.target))
          .map(e => ({
            ...e,
            source: connectedIds.has(e.source) ? comboId : e.source,
            target: connectedIds.has(e.target) ? comboId : e.target,
          }));

        set({
          nodes: [...remainingNodes, comboNode],
          edges: remainingEdges,
          selectedNodeId: null,
        });
      },

      ungroupCombo: (comboId) => {
        const { nodes } = get();
        const combo = nodes.find(n => n.id === comboId);
        if (!combo || combo.type !== 'combo') return;
        get().pushSnapshot();
        set({
          nodes: nodes.filter(n => n.id !== comboId),
        });
      },

      executeQueryNode: async (nodeId) => {
        const { nodes, edges } = get();
        const node = nodes.find(n => n.id === nodeId);
        if (!node || node.type !== 'query') return;

        const queryText = node.data.queryText as string | undefined;
        const queryType = (node.data.queryType as string) ?? 'cypher';
        if (!queryText) return;

        const updateNode = (updates: Partial<CanvasNodeData>) => {
          set({
            nodes: get().nodes.map(n =>
              n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
            ),
          });
        };

        updateNode({ queryStatus: 'running' });

        try {
          get().pushSnapshot();
          let results: unknown[];

          if (queryType === 'cypher') {
            results = await graphRead(queryText);
          } else {
            const parsed = JSON.parse(queryText);
            const result = await mcpCall(parsed.tool, parsed.payload ?? {});
            results = Array.isArray(result) ? result : [result];
          }

          const parentPos = node.position;
          const angleStep = (2 * Math.PI) / Math.max(results.length, 1);
          const radius = 180;
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];

          for (let i = 0; i < Math.min(results.length, 100); i++) {
            const rec = results[i] as Record<string, unknown>;
            const props = (rec?.n as Record<string, unknown>)?.properties as Record<string, unknown>
              ?? (rec?.m as Record<string, unknown>)?.properties as Record<string, unknown>
              ?? rec;
            const label = String(props?.name ?? props?.label ?? props?.id ?? `Result ${i + 1}`);
            const nId = nextNodeId();
            const nType = nodeTypeFromLabel(label);

            newNodes.push({
              id: nId,
              type: nType,
              position: {
                x: parentPos.x + radius * Math.cos(angleStep * i),
                y: parentPos.y + 100 + radius * Math.sin(angleStep * i),
              },
              data: {
                label,
                nodeType: nType,
                provenance: {
                  createdBy: 'query',
                  createdAt: new Date().toISOString(),
                  source: queryText.slice(0, 100),
                  parentNodeId: nodeId,
                },
              },
            });

            newEdges.push({
              id: `edge-qr-${Date.now()}-${i}`,
              source: nodeId,
              target: nId,
            });
          }

          set(state => ({
            nodes: [...state.nodes, ...newNodes],
            edges: [...state.edges, ...newEdges],
          }));

          updateNode({ queryStatus: 'success', queryResultCount: results.length });
        } catch (err) {
          updateNode({ queryStatus: 'error', queryResultCount: 0 });
          console.error('[QueryNode] Execution failed:', err);
        }
      },

      reason: async (query) => {
        set({ isLoading: true });
        try {
          const isCompliance = isComplianceQuery(query);
          const context = isCompliance
            ? { domain: 'compliance', semantic_arbitrage: true }
            : {};
          const result = await reasonCall(query, context);
          return result;
        } finally {
          set({ isLoading: false });
        }
      },

      injectToCanvas: (text, nodeType) => {
        const type = nodeType ?? 'insight';
        const id = get().addNodeWithData(type, {
          label: text.slice(0, 60) + (text.length > 60 ? '...' : ''),
          subtitle: text.length > 60 ? text.slice(0, 200) : undefined,
          nodeType: type,
          provenance: {
            createdBy: 'ai',
            createdAt: new Date().toISOString(),
            source: 'AI Panel inject',
          },
        });
        return id;
      },

      addThoughtNodeAt: (position) => {
        const id = nextNodeId();
        const newNode: Node = {
          id,
          type: 'thought',
          position,
          data: { 
            label: '', 
            nodeType: 'thought', 
            isNew: true,
            provenance: { createdBy: 'manual', createdAt: new Date().toISOString(), source: 'double-click' }
          },
        };
        set(state => ({ 
          nodes: [...state.nodes, newNode],
          selectedNodeId: id
        }));
        return id;
      },

      matchTenders: async (nodeId) => {
        const node = get().nodes.find(n => n.id === nodeId);
        if (!node) return;

        set({ isLoading: true });
        try {
          get().pushSnapshot();
          const result = await mcpCall<{
            success: boolean;
            matches?: Array<{
              tender_id: string;
              text: string;
              category: string;
              confidence: number;
              score: number;
            }>;
          }>('nexus.tender_match', {
            capability: node.data.label,
            limit: 10,
          });

          if (!result?.success || !result.matches?.length) {
            set({ isLoading: false });
            return;
          }

          const parentPos = node.position;
          const newNodes: Node[] = result.matches.map((match, i) => ({
            id: `tender-${match.tender_id?.slice(0, 8) ?? i}-${Date.now()}`,
            type: 'evidence' as const,
            position: {
              x: parentPos.x + 300,
              y: parentPos.y + (i - result.matches!.length / 2) * 80,
            },
            data: {
              label: match.text?.slice(0, 60) + ((match.text?.length ?? 0) > 60 ? '...' : ''),
              subtitle: `${match.category ?? 'Tender'} (${((match.score ?? 0) * 100).toFixed(0)}%)`,
              nodeType: 'evidence' as CanvasNodeType,
              complianceScore: match.confidence ?? 0.5,
              signalIntensity: (match.score ?? 0) > 0.8 ? 0.85 : 0.5,
              provenance: {
                createdBy: 'tool' as const,
                createdAt: new Date().toISOString(),
                source: 'nexus.tender_match',
                tool: 'nexus.tender_match',
              },
            },
          }));

          const newEdges: Edge[] = newNodes.map(n => ({
            id: `edge-tender-${n.id}`,
            source: nodeId,
            target: n.id,
            label: 'MATCHES_TENDER',
          }));

          set(state => ({
            nodes: [...state.nodes, ...newNodes],
            edges: [...state.edges, ...newEdges],
            isLoading: false,
          }));
          get().recordStep('match-tenders', String(node.data.label ?? ''));
        } catch (err) {
          console.error('Tender match failed:', err);
          set({ isLoading: false });
        }
      },

      _toast: undefined,
      setToast: (fn) => set({ _toast: fn } as Partial<CanvasState>),

      autoAnalyze: async (nodeId) => {
        const node = get().nodes.find(n => n.id === nodeId);
        if (!node) return;
        const label = node.data.label as string;
        const t = get()._toast;
        t?.('info', `Auto-analyzing "${label}"...`);

        set({ isLoading: true });
        try {
          get().pushSnapshot();
          const parentPos = node.position;

          const [expandResult, tenderResult, reasonResult] = await Promise.allSettled([
            graphNeighborSearch(label, undefined, 15),
            mcpCall<{ success: boolean; matches?: Array<{ tender_id: string; text: string; category: string; confidence: number; score: number }> }>(
              'nexus.tender_match', { capability: label, limit: 5 }
            ),
            reasonCall(`What is the strategic position and significance of "${label}" in the Nordic consulting market? Assess competitive strengths, weaknesses, and key differentiators.`),
          ]);

          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];
          let nodeCount = 0;

          if (expandResult.status === 'fulfilled') {
            const records = expandResult.value as Record<string, unknown>[];
            const angleStep = (2 * Math.PI) / Math.max(records.length, 1);
            for (let i = 0; i < Math.min(records.length, 15); i++) {
              const rec = records[i];
              const mObj = rec?.m as Record<string, unknown> | undefined;
              const props = (mObj?.properties as Record<string, unknown>) ?? rec;
              const name = String(props?.name ?? props?.id ?? 'Unknown');
              const relType = String(rec?.relType ?? 'RELATED');
              const nType = nodeTypeFromLabel(String(rec?.nodeLabel ?? '') || name);
              const nId = nextNodeId();
              newNodes.push({
                id: nId, type: nType,
                position: { x: parentPos.x + 220 * Math.cos(angleStep * i), y: parentPos.y + 220 * Math.sin(angleStep * i) },
                data: { label: name, subtitle: relType, nodeType: nType, provenance: { createdBy: 'expand', createdAt: new Date().toISOString(), source: `auto-analyze: ${label}` } },
              });
              newEdges.push({ id: `edge-aa-${Date.now()}-${i}`, source: nodeId, target: nId, label: relType });
              nodeCount++;
            }
          }

          if (tenderResult.status === 'fulfilled' && tenderResult.value?.success && tenderResult.value.matches?.length) {
            for (let i = 0; i < tenderResult.value.matches.length; i++) {
              const m = tenderResult.value.matches[i];
              const nId = nextNodeId();
              newNodes.push({
                id: nId, type: 'evidence',
                position: { x: parentPos.x + 350, y: parentPos.y + i * 70 - 150 },
                data: {
                  label: m.text?.slice(0, 50) + '...', subtitle: `Tender: ${m.category} (${((m.score ?? 0) * 100).toFixed(0)}%)`,
                  nodeType: 'evidence', complianceScore: m.confidence, signalIntensity: m.score > 0.8 ? 0.85 : 0.5,
                  provenance: { createdBy: 'tool', createdAt: new Date().toISOString(), source: 'auto-analyze → nexus.tender_match', tool: 'nexus.tender_match' },
                },
              });
              newEdges.push({ id: `edge-aa-t-${Date.now()}-${i}`, source: nodeId, target: nId, label: 'MATCHES_TENDER' });
              nodeCount++;
            }
          }

          if (reasonResult.status === 'fulfilled') {
            const r = reasonResult.value;
            const nId = nextNodeId();
            newNodes.push({
              id: nId, type: 'thought',
              position: { x: parentPos.x - 300, y: parentPos.y },
              data: {
                label: `Analysis: ${label}`, subtitle: 'Auto-Analysis', nodeType: 'thought',
                thinkingSteps: r.thinking_steps, reasoningStatus: 'complete',
                complianceScore: r.confidence,
                provenance: { createdBy: 'ai', createdAt: new Date().toISOString(), source: 'auto-analyze → /reason', confidence: r.confidence },
              },
            });
            newEdges.push({ id: `edge-aa-r-${Date.now()}`, source: nodeId, target: nId, label: 'ANALYZED_BY' });
            nodeCount++;
          }

          set(state => ({
            nodes: [...state.nodes, ...newNodes],
            edges: [...state.edges, ...newEdges],
          }));
          get().recordStep('auto-analyze', label);
        } catch (err) {
          get()._toast?.('error', `Auto-analysis failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          set({ isLoading: false });
        }
      },

      generateNarrative: async () => {
        const { nodes } = get();
        const t = get()._toast;
        if (nodes.length === 0) { t?.('info', 'Canvas is empty'); return ''; }

        set({ isLoading: true });
        t?.('info', 'Generating narrative report...');
        try {
          const entities = nodes.filter(n => n.type === 'entity');
          const evidence = nodes.filter(n => n.type === 'evidence');
          const insights = nodes.filter(n => n.type === 'insight');
          const thoughts = nodes.filter(n => n.type === 'thought');
          const edgeLabels = get().edges.map(e => (e as Edge & { label?: string }).label).filter(Boolean);

          const canvasSummary = [
            `Canvas contains: ${nodes.length} nodes, ${get().edges.length} edges.`,
            entities.length ? `Entities: ${entities.map(n => n.data.label).join(', ')}` : '',
            evidence.length ? `Evidence (${evidence.length}): ${evidence.slice(0, 5).map(n => n.data.label).join(', ')}${evidence.length > 5 ? '...' : ''}` : '',
            insights.length ? `Insights: ${insights.map(n => n.data.label).join(', ')}` : '',
            thoughts.length ? `Analysis: ${thoughts.map(n => n.data.label).join(', ')}` : '',
            edgeLabels.length ? `Relationships: ${[...new Set(edgeLabels)].join(', ')}` : '',
          ].filter(Boolean).join('\n');

          const result = await reasonCall(
            `Generate a structured consulting narrative report based on this canvas analysis. Include: Executive Summary, Evidence Base, Competitive Positioning (if applicable), Recommendations, and Risk Assessment. Be specific and reference the actual entities and evidence.\n\nCanvas data:\n${canvasSummary}`,
            { domain: 'consulting', output_format: 'narrative' },
          );

          get().addNodeWithData('artifact', {
            label: 'Narrative Report',
            subtitle: `Generated from ${nodes.length} nodes`,
            nodeType: 'artifact',
            artifactType: 'markdown',
            artifactSource: result.recommendation,
            provenance: {
              createdBy: 'ai',
              createdAt: new Date().toISOString(),
              source: 'generateNarrative',
              confidence: result.confidence,
            },
          });

          t?.('success', 'Narrative report generated — see artifact node on canvas');
          return result.recommendation;
        } catch (err) {
          t?.('error', `Narrative generation failed: ${err instanceof Error ? err.message : String(err)}`);
          return '';
        } finally {
          set({ isLoading: false });
        }
      },

      evaluateHypothesis: async (thoughtNodeId) => {
        const { nodes, edges } = get();
        const thought = nodes.find(n => n.id === thoughtNodeId);
        if (!thought || thought.type !== 'thought') {
          get()._toast?.('info', 'Select a thought/hypothesis node first');
          return;
        }

        const t = get()._toast;
        set({ isLoading: true });
        t?.('info', `Evaluating hypothesis: "${thought.data.label}"...`);

        try {
          const connectedEdges = edges.filter(e => e.source === thoughtNodeId || e.target === thoughtNodeId);
          const connectedNodeIds = connectedEdges.map(e => e.source === thoughtNodeId ? e.target : e.source);
          const evidenceNodes = nodes.filter(n => connectedNodeIds.includes(n.id) && (n.type === 'evidence' || n.type === 'insight'));

          const prompt = [
            `Evaluate this hypothesis against the connected evidence. Score 0.0 (fully refuted) to 1.0 (fully supported).`,
            `\nHypothesis: "${thought.data.label}"`,
            thought.data.subtitle ? `Context: ${thought.data.subtitle}` : '',
            `\nEvidence (${evidenceNodes.length} items):`,
            ...evidenceNodes.map((e, i) => `${i + 1}. ${e.data.label}${e.data.subtitle ? ` — ${e.data.subtitle}` : ''}`),
            evidenceNodes.length === 0 ? 'No evidence connected. Assess based on general knowledge.' : '',
          ].filter(Boolean).join('\n');

          const result = await reasonCall(prompt, { domain: 'hypothesis-evaluation' });
          const score = result.confidence ?? 0.5;

          set(state => ({
            nodes: state.nodes.map(n => n.id === thoughtNodeId ? {
              ...n, data: {
                ...n.data,
                complianceScore: score,
                signalIntensity: score > 0.7 ? 0.85 : score > 0.4 ? 0.6 : 0.3,
                thinkingSteps: result.thinking_steps ?? n.data.thinkingSteps,
                reasoningStatus: 'complete',
              },
            } : n),
            edges: state.edges.map(e => {
              if (e.source !== thoughtNodeId && e.target !== thoughtNodeId) return e;
              const style = score >= 0.7
                ? { stroke: '#22c55e', strokeWidth: 3 }
                : score <= 0.3
                ? { stroke: '#ef4444', strokeWidth: 3 }
                : { stroke: '#6b7280', strokeWidth: 2 };
              return { ...e, style };
            }),
          }));

          t?.('success', `Hypothesis scored: ${(score * 100).toFixed(0)}% — ${score >= 0.7 ? 'SUPPORTED' : score <= 0.3 ? 'REFUTED' : 'INCONCLUSIVE'}`);
        } catch (err) {
          t?.('error', `Hypothesis evaluation failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          set({ isLoading: false });
        }
      },

      discoverPatterns: async () => {
        const t = get()._toast;
        set({ isLoading: true });
        t?.('info', 'Discovering cross-engagement patterns...');

        try {
          get().pushSnapshot();
          const insights = await graphRead(
            `MATCH (si:StrategicInsight) RETURN si.domain AS domain, si.insight AS insight, si.confidence AS confidence ORDER BY si.confidence DESC LIMIT 30`
          ) as Record<string, unknown>[];

          if (!insights.length) {
            t?.('info', 'No strategic insights found in graph. Run analyses first.');
            return;
          }

          const domains = new Map<string, string[]>();
          for (const r of insights) {
            const domain = String(r?.domain ?? 'Unknown');
            const insight = String(r?.insight ?? '');
            if (!domains.has(domain)) domains.set(domain, []);
            domains.get(domain)!.push(insight);
          }

          const domainSummary = Array.from(domains.entries())
            .map(([d, ins]) => `${d} (${ins.length} insights): ${ins.slice(0, 3).join('; ')}`)
            .join('\n');

          const result = await reasonCall(
            `Analyze these strategic insights across domains. Identify recurring PATTERNS that apply across multiple engagements. For each pattern, explain why it matters and how a consulting firm should leverage it.\n\n${domainSummary}`,
            { domain: 'pattern-discovery' },
          );

          const newNodes: Node[] = [];
          let x = 100;
          for (const [domain, ins] of domains) {
            const nId = nextNodeId();
            newNodes.push({
              id: nId, type: 'insight',
              position: { x, y: 100 },
              data: {
                label: `Pattern: ${domain}`, subtitle: `${ins.length} insights analyzed`,
                nodeType: 'insight', signalIntensity: 0.8,
                provenance: { createdBy: 'ai', createdAt: new Date().toISOString(), source: 'discoverPatterns' },
              },
            });
            x += 280;
          }

          const synthId = nextNodeId();
          newNodes.push({
            id: synthId, type: 'thought',
            position: { x: x / 2 - 140, y: 250 },
            data: {
              label: 'Cross-Engagement Synthesis',
              nodeType: 'thought', thinkingSteps: result.thinking_steps,
              reasoningStatus: 'complete', complianceScore: result.confidence,
              provenance: { createdBy: 'ai', createdAt: new Date().toISOString(), source: 'discoverPatterns', confidence: result.confidence },
            },
          });

          const newEdges: Edge[] = newNodes
            .filter(n => n.id !== synthId)
            .map(n => ({ id: `edge-pat-${n.id}`, source: n.id, target: synthId, label: 'SYNTHESIZED_INTO' }));

          set(state => ({
            nodes: [...state.nodes, ...newNodes],
            edges: [...state.edges, ...newEdges],
          }));
          t?.('success', `Discovered patterns across ${domains.size} domains`);
        } catch (err) {
          t?.('error', `Pattern discovery failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          set({ isLoading: false });
        }
      },

      alignLayout: () => {
        const { nodes } = get();
        if (nodes.length === 0) return;
        const positioned = alignNodesToColumns(nodes);
        set({ nodes: positioned });
      },

      loadTemplate: async (templateId) => {
        const template = CANVAS_TEMPLATES.find(t => t.id === templateId);
        if (!template) return;

        const t = get()._toast;
        set({ isLoading: true });
        t?.('info', `Loading template: ${template.name}...`);

        try {
          get().clearCanvas();
          get().pushSnapshot();

          for (const q of template.queries) {
            const records = await graphRead(q.cypher);
            if (records.length) {
              get().addNodesFromGraph(records, q.nodeType, q.labelField, {
                createdBy: 'pipeline',
                createdAt: new Date().toISOString(),
                source: `template: ${template.id}`,
              });
            }
          }

          if (template.columns && template.columns.length > 0) {
            const positioned = alignNodesToColumns(get().nodes);
            set({ nodes: positioned });
          } else if (template.layoutMode === 'mindmap') {
            set(state => ({ nodes: applyDagreLayout(state.nodes, state.edges), layoutMode: 'mindmap' }));
          }

          if (template.autoAnalyze) {
            const firstEntity = get().nodes.find(n => n.type === 'entity');
            if (firstEntity) {
              await get().autoAnalyze(firstEntity.id);
            }
          }

          t?.('success', `Template "${template.name}" loaded: ${get().nodes.length} nodes`);
        } catch (err) {
          t?.('error', `Template failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          set({ isLoading: false });
        }
      },

      setFilter: (filter) => {
        set({ filterState: { ...get().filterState, ...filter } });
      },

      setEngagement: (id) => {
        set({ engagementId: id });
        if (id) get()._toast?.('info', `Engagement ${id} active — steps are being recorded`);
      },

      recordStep: (actionType, nodeContext, outcome) => {
        const eid = get().engagementId;
        if (!eid) return;
        graphWrite(
          `MATCH (e:Engagement {id: $eid})
           CREATE (s:EngagementStep {
             id: randomUUID(), actionType: $actionType,
             nodeContext: $nodeContext, outcome: $outcome,
             timestamp: datetime()
           })
           MERGE (e)-[:HAS_STEP]->(s)`,
          { eid, actionType, nodeContext, outcome: outcome ?? 'kept' },
        ).catch(() => {});
      },

      replayEngagement: async (engagementId) => {
        const t = get()._toast;
        set({ isLoading: true });
        try {
          const steps = await graphRead(
            `MATCH (e:Engagement {id: $eid})-[:HAS_STEP]->(s:EngagementStep)
             RETURN s.actionType AS actionType, s.nodeContext AS nodeContext,
                    s.outcome AS outcome, s.timestamp AS timestamp
             ORDER BY s.timestamp`,
            { eid: engagementId },
          );
          get().pushSnapshot();
          get().clearCanvas();
          for (const raw of steps) {
            const s = raw as Record<string, unknown>;
            const ctx = String(s.nodeContext ?? 'replay');
            get().addNode('thought', `[${s.actionType}] ${ctx}`, undefined, undefined, {
              createdBy: 'pipeline',
              createdAt: String(s.timestamp ?? new Date().toISOString()),
              source: `replay:${engagementId}`,
            });
          }
          get().applyLayout('LR');
          t?.('success', `Replayed ${steps.length} engagement steps`);
        } catch (err) {
          t?.('error', `Replay failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          set({ isLoading: false });
        }
      },

      crossReference: async (nodeId) => {
        const t = get()._toast;
        const node = get().nodes.find(n => n.id === nodeId);
        if (!node) return;
        const label = String(node.data?.label ?? '');
        set({ isLoading: true });
        try {
          const records = await graphRead(
            `MATCH (n)-[r]-(m)
             WHERE toLower(n.name) CONTAINS toLower($name)
               AND NOT n.id = m.id
             WITH DISTINCT m, type(r) AS relType, labels(m)[0] AS nodeLabel
             RETURN m, relType, nodeLabel
             ORDER BY nodeLabel
             LIMIT 30`,
            { name: label },
          );
          get().pushSnapshot();
          let count = 0;
          for (const raw of records) {
            const rec = raw as Record<string, unknown>;
            const m = rec.m as Record<string, unknown> | undefined;
            const name = String(m?.name ?? m?.title ?? rec.nodeLabel ?? 'Unknown');
            const nType = nodeTypeFromLabel(String(rec.nodeLabel ?? ''));
            const newId = get().addNodeWithData(nType, {
              label: name,
              subtitle: String(rec.relType ?? ''),
              nodeType: nType,
              provenance: { createdBy: 'expand', createdAt: new Date().toISOString(), source: 'cross-reference' },
            });
            set(state => ({
              edges: [...state.edges, {
                id: `xref-${Date.now()}-${count}`,
                source: nodeId,
                target: newId,
                label: String(rec.relType ?? 'CROSS_REF'),
              }],
            }));
            count++;
          }
          get().recordStep('cross-reference', label);
          t?.('success', `Cross-referenced ${count} related nodes`);
        } catch (err) {
          t?.('error', `Cross-reference failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          set({ isLoading: false });
        }
      },

      recommendNextActions: async (nodeId) => {
        const node = get().nodes.find(n => n.id === nodeId);
        if (!node) return [];
        const d = node.data as CanvasNodeData;
        const label = String(d.label ?? '');
        try {
          const neighborIds = get().edges
            .filter(e => e.source === nodeId || e.target === nodeId)
            .map(e => e.source === nodeId ? e.target : e.source);
          const neighbors = get().nodes.filter(n => neighborIds.includes(n.id)).map(n => n.data.label);

          const prompt = `Som strategisk Orakel, analysér denne node og dens kontekst. Foreslå 3 konkrete, "insanely great" næste handlinger.\nNODE: "${label}" (${node.type})\nNABOER: ${neighbors.join(', ') || 'Ingen'}\n\nSvar i JSON format: { recommendations: [{ action: string, label: string, confidence: number, reasoning: string, proactive: boolean }] }\nActions: 'expand', 'autoAnalyze', 'matchTenders', 'crossReference', 'reason'.\nSæt 'proactive: true' hvis kritisk.`;

          const result = await reasonCall(prompt, { domain: 'proactive-recommendations' });
          try {
            const parsed = JSON.parse(result.recommendation);
            return (parsed.recommendations || []).sort((a: any, b: any) => b.confidence - a.confidence);
          } catch {
            return [
              { action: 'autoAnalyze', label: 'Kør Fuld Analyse', confidence: 0.9, reasoning: 'Oraklet ser uudnyttet potentiale i denne node.', proactive: true },
              { action: 'expand', label: 'Udforsk Netværk', confidence: 0.7, reasoning: 'Find de skjulte forbindelser.' }
            ];
          }
        } catch (err) {
          console.error('Proactive recommendation failed', err);
          return [];
        }
      },

      exportAuditTrail: async (format) => {
        const { nodes, edges } = get();
        const trail = nodes.map(n => {
          const d = n.data as CanvasNodeData;
          return {
            id: n.id, type: n.type, label: String(d.label ?? ''),
            provenance: d.provenance ?? { createdBy: 'manual', createdAt: 'unknown', source: 'unknown' },
            connections: edges.filter(e => e.source === n.id || e.target === n.id).length,
          };
        });

        if (format === 'json') {
          return JSON.stringify({
            generatedAt: new Date().toISOString(), canvasId: get().canvasId,
            nodeCount: nodes.length, edgeCount: edges.length, entities: trail,
          }, null, 2);
        }

        const lines = [`# Provenance Audit Trail`, `**Canvas**: ${get().canvasId}`, `**Nodes**: ${nodes.length} | **Edges**: ${edges.length}`, '', '## Nodes', '', '| ID | Type | Label | Created By | Source | Connections |', '|---|---|---|---|---|---|'];
        for (const t of trail) {
          lines.push(`| ${t.id} | ${t.type} | ${t.label} | ${t.provenance.createdBy} | ${t.provenance.source} | ${t.connections} |`);
        }
        return lines.join('\n');
      },

      runAnalysisPipeline: async (entityName, templateId) => {
        const t = get()._toast;
        set({ isLoading: true });
        try {
          get().pushSnapshot();
          get().clearCanvas();

          if (templateId) {
            await get().loadTemplate(templateId);
          }

          const entityId = get().addNodeWithData('entity', {
            label: entityName,
            nodeType: 'entity',
            provenance: { createdBy: 'pipeline', createdAt: new Date().toISOString(), source: 'analysis-pipeline' },
          });

          await get().expandNode(entityId);
          await get().autoAnalyze(entityId);
          const narrative = await get().generateNarrative();

          const result = { nodeCount: get().nodes.length, narrative };
          return result;
        } catch (err) {
          t?.('error', `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`);
          return { nodeCount: get().nodes.length, narrative: '' };
        } finally {
          set({ isLoading: false });
        }
      },

      executeNodeCommand: async (nodeId, command) => {
        const node = get().nodes.find(n => n.id === nodeId);
        if (!node || !command.trim()) return;
        
        const label = String(node.data?.label || 'unnamed thought');
        const t = get()._toast;

        const updateStatus = (status: CanvasNodeData['reasoningStatus'], step?: string) => {
          const targetNode = get().nodes.find(n => n.id === nodeId);       
          if (!targetNode) return;
          const currentSteps = (targetNode.data.thinkingSteps as string[]) || [];
          const newSteps = step ? [...currentSteps, step] : currentSteps;
          set(state => ({
            nodes: state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, reasoningStatus: status, thinkingSteps: newSteps } } : n)        
          }));
        };

        // Reset thinking steps for new command
        set(state => ({
          nodes: state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, reasoningStatus: 'thinking', thinkingSteps: [`Modtog: "${command}"`] } } : n)
        }));

        try {
          const cmd = command.toLowerCase().trim();
          if (cmd === '/expand') {
            await get().expandNode(nodeId);
          } else if (cmd.startsWith('/analyze')) {
            await get().autoAnalyze(nodeId);
          } else if (cmd === '/help' || cmd.includes('hvad kan du')) {     
            get().addNodeWithData('thought', { 
              label: 'Oraklets Kapabiliteter', 
              subtitle: 'Jeg ræsonnerer over 5 lag: Intern, Ekstern, Egen, Fælles og din kuraterede Notebook.', 
              nodeType: 'thought' 
            }, { x: node.position.x + 300, y: node.position.y });
          } else {
            let neighbors: string[] = [];
            let collectiveMemories: any[] = [];
            
            try {
              const connectedEdges = get().edges.filter(e => e.source === nodeId || e.target === nodeId);
              const neighborIds = connectedEdges.map(e => e.source === nodeId ? e.target : e.source);
              neighbors = get().nodes.filter(n => neighborIds.includes(n.id)).map(n => `${n.data.label} (${n.type})`);
              updateStatus('thinking', `Hentet ${neighbors.length} naboer fra lærredet.`);
            } catch (e) {}

            try {
              collectiveMemories = await graphRead(`MATCH (l:Lesson) WHERE toLower(l.topic) CONTAINS toLower($query) RETURN l.content AS content, l.outcome AS outcome LIMIT 3`, { query: label !== 'unnamed thought' ? label : command });
              updateStatus('thinking', `Fundet ${collectiveMemories.length} erfaringer i fællesskabets hukommelse.`);
            } catch (e) {}

            updateStatus('thinking', 'Henter grounded viden fra Notebook (curated library)...');
            const notebookContext = await fetchNotebookContext(label !== 'unnamed thought' ? label : command);

            const result = await reasonCall(`Svar paa: "${command}" in context of "${label || 'thought'}".
Internal: ${neighbors.join(', ') || 'None'}
Global: ${collectiveMemories.length} lessons.
Notebook: ${notebookContext.slice(0, 500)}`, { domain: 'contextual-node-oracle' });

            const newId = get().addNodeWithData('insight', { 
              label: result.recommendation.slice(0, 60) + (result.recommendation.length > 60 ? '...' : ''), 
              subtitle: result.recommendation, 
              nodeType: 'insight', 
              thinkingSteps: result.thinking_steps, 
              provenance: { createdBy: 'ai', createdAt: new Date().toISOString(), source: `Orakel-svar: ${command}`, confidence: result.confidence } 
            }, { x: node.position.x + 350, y: node.position.y });
            
            set(state => ({ edges: [...state.edges, { id: `edge-chat-${Date.now()}`, source: nodeId, target: newId, label: 'ORACLE_INSIGHT' }] }));   
          }
          updateStatus('complete', 'Analyse færdig.');
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          updateStatus('error', `Fejl: ${errMsg}`);
          t?.('error', `Oraklet fejlede: ${errMsg}`);
        }
      },
    }),
    {
      name: 'widgetdc-canvas-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges,
        layoutMode: state.layoutMode,
        canvasId: state.canvasId,
        knowledgeExplorerMode: state.knowledgeExplorerMode,
      }),
    }
  )
);
