import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { ENGAGEMENT_COLUMNS } from '../templates';
import { CanvasNodeType } from '../types/canvas';

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

export function applyDagreLayout<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): Node<T>[] {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}

/**
 * Loop 4: Smart Snapping
 * Aligns nodes to the strategic H10 grid defined in ENGAGEMENT_COLUMNS.
 */
export function alignNodesToColumns<T extends Record<string, unknown>>(
  nodes: Node<T>[]
): Node<T>[] {
  const columnCounts: Record<string, number> = {};
  const HEADER_HEIGHT = 120;
  const COLUMN_SPACING_Y = 140;

  return nodes.map((node) => {
    const nodeType = (node.type || 'entity') as CanvasNodeType;
    let targetX = node.position.x;
    let targetY = node.position.y;

    // Find assigned column
    for (const [colName, colDef] of Object.entries(ENGAGEMENT_COLUMNS)) {
      if (colDef.nodeTypes.includes(nodeType)) {
        const count = columnCounts[colName] || 0;
        targetX = colDef.x + 30; // 30px offset for padding
        targetY = HEADER_HEIGHT + count * COLUMN_SPACING_Y;
        columnCounts[colName] = count + 1;
        break;
      }
    }

    return {
      ...node,
      position: { x: targetX, y: targetY },
    };
  });
}
