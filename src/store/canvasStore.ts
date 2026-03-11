import { create } from 'zustand';
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
import type { CanvasNodeData, CanvasNodeType } from '../components/nodes';
import { applyDagreLayout } from '../lib/layout';
import { graphRead, graphWrite } from '../lib/api';

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  layoutMode: 'mindmap' | 'freeform';
  canvasId: string;
  isLoading: boolean;
  aiPanelOpen: boolean;
  selectedNodeId: string | null;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  addNode: (type: CanvasNodeType, label: string, subtitle?: string, position?: { x: number; y: number }) => void;
  removeSelected: () => void;
  setLayoutMode: (mode: 'mindmap' | 'freeform') => void;
  toggleAiPanel: () => void;
  selectNode: (id: string | null) => void;
  applyLayout: (direction?: 'TB' | 'LR') => void;

  addNodesFromGraph: (records: unknown[], nodeType: CanvasNodeType, labelField?: string) => void;
  saveToGraph: () => Promise<void>;
  loadFromGraph: (canvasId?: string) => Promise<void>;
  clearCanvas: () => void;
}

let nodeIdCounter = 0;
function nextNodeId() {
  return `node-${Date.now()}-${++nodeIdCounter}`;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  layoutMode: 'freeform',
  canvasId: 'default',
  isLoading: false,
  aiPanelOpen: false,
  selectedNodeId: null,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: rfAddEdge({ ...connection, id: `edge-${Date.now()}` }, get().edges) });
  },

  addNode: (type, label, subtitle, position) => {
    const id = nextNodeId();
    const { nodes, edges, layoutMode } = get();
    const newNode: Node = {
      id,
      type,
      position: position ?? { x: 100 + Math.random() * 400, y: 100 + Math.random() * 400 },
      data: { label, subtitle, nodeType: type },
    };
    const updatedNodes = [...nodes, newNode];
    if (layoutMode === 'mindmap') {
      set({ nodes: applyDagreLayout(updatedNodes, edges) });
    } else {
      set({ nodes: updatedNodes });
    }
  },

  removeSelected: () => {
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

  selectNode: (id) => set({ selectedNodeId: id }),

  applyLayout: (direction = 'TB') => {
    const { nodes, edges } = get();
    set({ nodes: applyDagreLayout(nodes, edges, direction) });
  },

  addNodesFromGraph: (records, nodeType, labelField = 'name') => {
    const { nodes, edges, layoutMode } = get();
    const newNodes: Node[] = [];

    for (const rec of records) {
      const r = rec as Record<string, unknown>;
      const nObj = r?.n as Record<string, unknown> | undefined;
      const aObj = r?.a as Record<string, unknown> | undefined;
      const props = (nObj?.properties as Record<string, unknown>)
        ?? (aObj?.properties as Record<string, unknown>)
        ?? r;
      const label = String(props?.[labelField] ?? (props?.id as string) ?? 'Unknown');
      const subtitle = String(props?.description ?? props?.role ?? '');
      const id = nextNodeId();
      newNodes.push({
        id,
        type: nodeType,
        position: { x: 100 + Math.random() * 600, y: 100 + Math.random() * 600 },
        data: { label, subtitle: subtitle || undefined, nodeType },
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
      // Clear previous canvas state
      await graphWrite(
        'MATCH (n:CanvasNode {canvasId: $canvasId}) DETACH DELETE n',
        { canvasId },
      );
      await graphWrite(
        'MATCH (e:CanvasEdge {canvasId: $canvasId}) DETACH DELETE e',
        { canvasId },
      );

      // Save nodes
      for (const node of nodes) {
        await graphWrite(
          `MERGE (n:CanvasNode {id: $id, canvasId: $canvasId})
           SET n.label = $label, n.nodeType = $nodeType, n.subtitle = $subtitle,
               n.posX = $posX, n.posY = $posY, n.updatedAt = datetime()`,
          {
            id: node.id,
            canvasId,
            label: node.data.label,
            nodeType: node.data.nodeType,
            subtitle: node.data.subtitle ?? '',
            posX: node.position.x,
            posY: node.position.y,
          },
        );
      }

      // Save edges
      for (const edge of edges) {
        await graphWrite(
          `MERGE (e:CanvasEdge {id: $id, canvasId: $canvasId})
           SET e.source = $source, e.target = $target, e.updatedAt = datetime()`,
          { id: edge.id, canvasId, source: edge.source, target: edge.target },
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
        'MATCH (n:CanvasNode {canvasId: $canvasId}) RETURN n',
        { canvasId },
      ) as Record<string, Record<string, Record<string, unknown>>>[];

      const edgeRecords = await graphRead(
        'MATCH (e:CanvasEdge {canvasId: $canvasId}) RETURN e',
        { canvasId },
      ) as Record<string, Record<string, Record<string, unknown>>>[];

      const nodes: Node[] = (nodeRecords ?? []).map((rec) => {
        const r = rec as Record<string, unknown>;
        const nObj = r?.n as Record<string, unknown> | undefined;
        const p = (nObj?.properties as Record<string, unknown>) ?? nObj ?? {};
        return {
          id: String(p.id ?? nextNodeId()),
          type: String(p.nodeType ?? 'concept'),
          position: { x: Number(p.posX ?? 0), y: Number(p.posY ?? 0) },
          data: {
            label: String(p.label ?? 'Unknown'),
            subtitle: p.subtitle ? String(p.subtitle) : undefined,
            nodeType: (p.nodeType ?? 'concept') as CanvasNodeType,
          },
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

  clearCanvas: () => set({ nodes: [], edges: [], selectedNodeId: null }),
}));
