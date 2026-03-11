import { useCallback, useRef } from 'react';
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
import { useCanvasStore } from '../store/canvasStore';
import { nodeTypes } from './nodes';

const NODE_COLORS: Record<string, string> = {
  server:   '#64748b',
  endpoint: '#14b8a6',
  tool:     '#667eea',
  pipeline: '#06b6d4',
  agent:    '#e20074',
  entity:   '#f4bb00',
  insight:  '#22c55e',
  evidence: '#f97316',
};

export function Canvas() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    selectNode, addNode,
  } = useCanvasStore();

  const reactFlowRef = useRef<ReactFlowInstance<Node<Record<string, unknown>>, Edge> | null>(null);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    selectNode(node.id);
  }, [selectNode]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/canvas-node-type');
      if (!type || !reactFlowRef.current) return;

      const position = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      addNode(type as 'tool', `New ${type}`, undefined, position);
    },
    [addNode],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={(instance) => { reactFlowRef.current = instance; }}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: '#1a2d4a' },
          type: 'smoothstep',
          animated: true,
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
    </div>
  );
}
