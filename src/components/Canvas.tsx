import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeMouseHandler,
  type ReactFlowInstance,
  type Node,
  type Edge,
} from '@xyflow/react';
import { GitBranch, Play, Layers, Terminal, Search, X, Link2, Sparkles } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { nodeTypes } from './nodes';
import type { CanvasNodeType } from './nodes';

const NODE_COLORS: Record<string, string> = {
  server:   '#64748b',
  endpoint: '#14b8a6',
  tool:     '#667eea',
  pipeline: '#06b6d4',
  agent:    '#e20074',
  entity:   '#f4bb00',
  insight:  '#22c55e',
  evidence: '#f97316',
  artifact: '#ec4899',
  thought:  '#8b5cf6',
  query:    '#a855f7',
  combo:    '#6b7280',
};

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeType: string;
}

// Knowledge Explorer: only show AgentMemory/Lesson/Thought-related nodes
const KNOWLEDGE_NODE_TYPES = new Set(['thought', 'insight', 'evidence']);

export function Canvas() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    selectNode, addNode, addNodeWithData,
    expandNode, expandMore, groupSelected, ungroupCombo, executeQueryNode,
    matchTenders, crossReference, autoAnalyze,
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
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
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, removeSelected, saveToGraph, toggleAiPanel]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    selectNode(node.id);
    setContextMenu(null);
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

  // Right-click context menu
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
      nodeType: node.type ?? 'entity',
    });
  }, []);

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setContextMenu(null);
  }, [selectNode]);

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
          nodeType: 'tool',
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

  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu) return;
    const { nodeId, nodeType } = contextMenu;
    setContextMenu(null);

    switch (action) {
      case 'expand':
        expandNode(nodeId);
        break;
      case 'expandMore':
        expandMore(nodeId);
        break;
      case 'execute':
        executeQueryNode(nodeId);
        break;
      case 'group':
        groupSelected();
        break;
      case 'ungroup':
        ungroupCombo(nodeId);
        break;
      case 'matchTenders':
        matchTenders(nodeId);
        break;
      case 'crossReference':
        crossReference(nodeId);
        break;
      case 'autoAnalyze':
        autoAnalyze(nodeId);
        break;
      case 'query': {
        // Create a query node linked to this node
        const store = useCanvasStore.getState();
        const parent = store.nodes.find(n => n.id === nodeId);
        if (parent) {
          const qId = addNodeWithData('query', {
            label: `Query: ${parent.data.label}`,
            nodeType: 'query',
            queryType: 'cypher',
            queryText: `MATCH (n)-[r]-(m)\nWHERE toLower(n.name) = toLower('${parent.data.label}')\nRETURN m, type(r) AS relType\nLIMIT 20`,
            queryStatus: 'idle',
          }, {
            x: parent.position.x + 250,
            y: parent.position.y,
          });
          useCanvasStore.setState({
            edges: [...store.edges, {
              id: `edge-ctx-${Date.now()}`,
              source: nodeId,
              target: qId,
              label: 'QUERY_FOR',
            }],
          });
        }
        break;
      }
      default:
        break;
    }
  }, [contextMenu, expandNode, expandMore, executeQueryNode, groupSelected, ungroupCombo, matchTenders, crossReference, autoAnalyze, addNodeWithData]);

  return (
    <div className="flex-1 h-full relative">
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={(instance) => { reactFlowRef.current = instance; }}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        connectionLineStyle={{ strokeWidth: 3, stroke: '#2db3a6' }}
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: '#1a2d4a' },
          type: 'smoothstep',
          animated: true,
          labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 500 },
          labelBgStyle: { fill: '#0a1628', fillOpacity: 0.85 },
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1a2d4a" gap={20} size={1} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => NODE_COLORS[node.type ?? 'entity'] ?? '#f4bb00'}
          maskColor="rgba(5, 11, 20, 0.8)"
        />
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-neural-panel border border-neural-border rounded-lg shadow-xl z-[100] py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.nodeType !== 'combo' && (
            <>
              <button
                onClick={() => handleContextAction('expand')}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-200 hover:bg-neural-border"
              >
                <GitBranch size={14} className="text-gray-500" /> Expand neighbors
              </button>
              {expandStates.get(contextMenu.nodeId)?.hasMore && (
                <button
                  onClick={() => handleContextAction('expandMore')}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-tdc-300 hover:bg-neural-border"
                >
                  Load more ({expandStates.get(contextMenu.nodeId)?.loaded}/{expandStates.get(contextMenu.nodeId)?.totalAvailable})
                </button>
              )}
            </>
          )}
          {contextMenu.nodeType === 'query' && (
            <button
              onClick={() => handleContextAction('execute')}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-green-400 hover:bg-neural-border"
            >
              <Play size={14} /> Execute query
            </button>
          )}
          {contextMenu.nodeType === 'combo' && (
            <button
              onClick={() => handleContextAction('ungroup')}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-200 hover:bg-neural-border"
            >
              <Layers size={14} className="text-gray-500" /> Ungroup nodes
            </button>
          )}
          <button
            onClick={() => handleContextAction('group')}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-200 hover:bg-neural-border"
          >
            <Layers size={14} className="text-gray-500" /> Group connected
          </button>
          <button
            onClick={() => handleContextAction('query')}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-200 hover:bg-neural-border"
          >
            <Terminal size={14} className="text-gray-500" /> Create query node
          </button>
          <button
            onClick={() => handleContextAction('matchTenders')}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-amber-400 hover:bg-neural-border"
          >
            <Search size={14} /> Match Tenders
          </button>
          <button
            onClick={() => handleContextAction('crossReference')}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-blue-400 hover:bg-neural-border"
          >
            <Link2 size={14} /> Cross-Reference
          </button>
          <button
            onClick={() => handleContextAction('autoAnalyze')}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-purple-400 hover:bg-neural-border"
          >
            <Sparkles size={14} /> Auto-Analyze
          </button>
          <div className="border-t border-neural-border my-1" />
          <button
            onClick={() => setContextMenu(null)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-500 hover:bg-neural-border"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
