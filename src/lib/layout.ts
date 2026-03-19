import type { Node, Edge } from '@xyflow/react';
import { ENGAGEMENT_COLUMNS } from '../templates';
import { CanvasNodeType } from '../types/canvas';
import { applyEigenvectorLayout } from './eigenvectorLayout';

export function applyDagreLayout<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): Node<T>[] {
  const baseLayout = applyEigenvectorLayout(nodes, edges);
  if (direction === 'TB') {
    return baseLayout;
  }

  return baseLayout.map((node) => ({
    ...node,
    position: {
      x: node.position.y,
      y: node.position.x,
    },
  }));
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
    const nodeType = (node.type || 'Entity') as CanvasNodeType;
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
