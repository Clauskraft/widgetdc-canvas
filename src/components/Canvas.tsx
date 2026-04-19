import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Panel,
  type NodeMouseHandler,
  type ReactFlowInstance,
  type Node,
  type Edge,
  type OnConnectEnd,
} from '@xyflow/react';
import { motion } from 'framer-motion';
import { useCanvasStore } from '../store/canvasStore';
import { nodeTypes } from './nodes';
import type { CanvasNodeType } from '../types/canvas';

const NODE_COLORS: Record<string, string> = {
  CodeImplementation: '#64748b',
  MCPTool: '#14b8a6',
  Tool: '#667eea',
  Track: '#06b6d4',
  Agent: '#e20074',
  Entity: '#f4bb00',
  Insight: '#22c55e',
  StrategicInsight: '#22c55e',
  Evidence: '#f97316',
  Artifact: '#ec4899',
  Claim: '#8b5cf6',
  Memory: '#8b5cf6',
  StrategicLeverage: '#0ea5e9',
  KnowledgePattern: '#6366f1',
  GuardrailRule: '#ef4444',
  Decision: '#06b6d4',
  ComplianceGap: '#f59e0b',
  query:    '#a855f7',
  combo:    '#6b7280',
};

// Knowledge Explorer: only show AgentMemory/Lesson/Thought-related nodes
const KNOWLEDGE_NODE_TYPES = new Set(['Claim', 'Insight', 'StrategicInsight', 'Evidence', 'Entity', 'Memory']); 
// Actually, in our graph, Lessons might be 'entity' nodes with specific labels.
// We'll refine the filter to also check for subtitle or data properties.

export function Canvas() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    selectNode, addNode, addNodeWithData,
    expandNode, expandMore, ungroupCombo, executeQueryNode,
    undo, redo, isLoading, knowledgeExplorerMode,
    expandStates,
    removeSelected, saveToGraph, toggleAiPanel,
  } = useCanvasStore();

  // Filter nodes in Knowledge Explorer mode
  const displayNodes = knowledgeExplorerMode
    ? nodes.filter(n => KNOWLEDGE_NODE_TYPES.has(n.type ?? ''))
    : nodes;
  const displayNodeIds = new Set(displayNodes.map(n => n.id));
  const displayEdges = knowledgeExplorerMode
    ? edges.filter(e => displayNodeIds.has(e.source) && displayNodeIds.has(e.target))
    : edges;

  const reactFlowRef = useRef<ReactFlowInstance<Node<Record<string, unknown>>, Edge> | null>(null);
  const [isSimulatingAI, setIsSimulatingAI] = useState(false);

  // Keyboard shortcuts (Loop 7: Gesture Language)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      
      const { selectedNodeId, nodes, selectNode, expandNode, undo, redo, removeSelected, saveToGraph, toggleAiPanel } = useCanvasStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveToGraph();
      } else if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        toggleAiPanel();
      } 
      // Nudging (Loop 7)
      else if (selectedNodeId && (e.ctrlKey || e.metaKey) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const offset = 10;
        const currentNodes = useCanvasStore.getState().nodes;
        useCanvasStore.setState({
          nodes: currentNodes.map(n => n.id === selectedNodeId ? {
            ...n, position: {
              x: n.position.x + (e.key === 'ArrowRight' ? offset : e.key === 'ArrowLeft' ? -offset : 0),
              y: n.position.y + (e.key === 'ArrowDown' ? offset : e.key === 'ArrowUp' ? -offset : 0)
            }
          } : n)
        });
      }
      // Quick Expand (Loop 7)
      else if (selectedNodeId && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        expandNode(selectedNodeId);
      }
      // Strategic Navigation (Loop 7)
      else if (e.key === 'Tab') {
        e.preventDefault();
        const sortedNodes = [...nodes].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
        const currentIndex = sortedNodes.findIndex(n => n.id === selectedNodeId);
        const nextIndex = e.shiftKey 
          ? (currentIndex <= 0 ? sortedNodes.length - 1 : currentIndex - 1)
          : (currentIndex >= sortedNodes.length - 1 ? 0 : currentIndex + 1);
        if (sortedNodes[nextIndex]) {
          selectNode(sortedNodes[nextIndex].id);
          // Focus the view on the new node
          reactFlowRef.current?.setCenter(sortedNodes[nextIndex].position.x, sortedNodes[nextIndex].position.y, { zoom: 1, duration: 400 });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // Empty deps because we pull fresh state from get() inside the handler to avoid closure staleness

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    selectNode(node.id);
  }, [selectNode]);

  // Double-click: expand graph node or execute query node
  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'query') {
      executeQueryNode(node.id);
    } else if (node.type !== 'combo') {
      expandNode(node.id);
    } else {
      ungroupCombo(node.id);
    }
  }, [expandNode, executeQueryNode, ungroupCombo]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    selectNode(null);

    // Double click to create new thought node (Vision interaction - Optimized Loop 1)
    if (event.detail === 2 && reactFlowRef.current) {
      const position = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      useCanvasStore.getState().addThoughtNodeAt(position);
    }
  }, [selectNode]);

  const onConnectEnd: OnConnectEnd = useCallback(
    async (event, connectionState) => {
      if (!connectionState.isValid && connectionState.fromNode?.id) {
        setIsSimulatingAI(true);
        try {
          // Minimum 800ms delay for the "magic feel"
          await Promise.all([
            expandNode(connectionState.fromNode.id).catch(() => {
              // Ignore expansion errors for local unsaved nodes
            }),
            new Promise(resolve => setTimeout(resolve, 800))
          ]);
        } finally {
          setIsSimulatingAI(false);
        }
      }
    },
    [expandNode],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/canvas-node-type');
      const toolName = event.dataTransfer.getData('application/canvas-tool-name');
      if (!reactFlowRef.current) return;

      const position = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      if (toolName) {
        // Drop from ToolPalette — create a tool node with metadata
        addNodeWithData('tool', {
          label: toolName,
          subtitle: event.dataTransfer.getData('application/canvas-tool-group') || undefined,
          nodeType: 'Tool',
          provenance: {
            createdBy: 'manual',
            createdAt: new Date().toISOString(),
            source: 'tool-palette',
            tool: toolName,
          },
        }, position);
      } else if (type) {
        addNode(type as CanvasNodeType, `New ${type}`, undefined, position);
      }
    },
    [addNode, addNodeWithData],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="flex-1 h-full relative" data-testid="main-canvas">
      {/*
       * Strategic Column Headers Overlay (VISION/PILLARS/MARKET/GAPS/H5 MIDPOINT…)
       * was a pre-UC5 Vision-Edition artefact styled in a language that clashes
       * with substrate-cartography. Removed — the Architecture canvas is being
       * rebuilt as SVG isolines per docs/canvas/prototype.html. If the strategic
       * template columns are ever needed again, build a dedicated, opt-in
       * TemplateColumns component mounted only when a template is explicitly
       * selected.
       */}

      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={(instance) => { reactFlowRef.current = instance; }}
        nodeTypes={nodeTypes}
        fitView
        onlyRenderVisibleElements={true}
        minZoom={0.1}
        snapToGrid
        snapGrid={[15, 15]}
        connectionLineStyle={{ strokeWidth: 3, stroke: '#8b5cf6' }}
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: '#334155' },
          type: 'smoothstep',
          animated: true,
          labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 500 },
          labelBgStyle: { fill: '#0f1d32', fillOpacity: 0.85 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#334155" gap={20} size={1} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => NODE_COLORS[node.type ?? 'Entity'] ?? '#f4bb00'}
          maskColor="rgba(5, 11, 20, 0.8)"
        />

        {/* The Oracle AI Expansion Simulation Panel */}
        {isSimulatingAI && (
          <Panel position="top-center" className="mt-8 z-50">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-neural-surface/90 backdrop-blur-xl px-8 py-4 rounded-full shadow-2xl border border-purple-500/30 flex items-center gap-6"
            >
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '200ms' }} />
                <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '400ms' }} />
              </div>
              <span className="text-base font-bold text-gray-100 tracking-tight">Oraklet søger i grafen...</span>
            </motion.div>
          </Panel>
        )}
      </ReactFlow>

      {/* Knowledge Explorer mode indicator */}
      {knowledgeExplorerMode && (
        <div className="absolute top-2 right-2 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs z-50">
          Knowledge Explorer — showing thoughts, insights, evidence only
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-tdc-500/20 border border-tdc-500/40 text-tdc-200 text-xs flex items-center gap-2 z-50">
          <div className="w-3 h-3 border-2 border-tdc-400 border-t-transparent rounded-full animate-spin" />
          Expanding graph...
        </div>
      )}

      {/* Progressive "Load More" buttons for expanded nodes */}
      {Array.from(expandStates.entries()).map(([nId, state]) => {
        if (!state.hasMore) return null;
        const node = nodes.find(n => n.id === nId);
        if (!node) return null;
        return (
          <button
            key={`loadmore-${nId}`}
            className="absolute z-40 px-2 py-1 rounded-full bg-neural-panel border border-tdc-500/40 text-tdc-200 text-[10px] hover:bg-tdc-500/20 transition-colors"
            style={{
              left: '50%',
              bottom: 40,
              transform: 'translateX(-50%)',
            }}
            onClick={() => expandMore(nId)}
          >
            Load more ({state.loaded}/{state.totalAvailable})
          </button>
        );
      })}
    </div>
  );
}
