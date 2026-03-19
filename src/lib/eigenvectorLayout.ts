import type { Edge, Node } from '@xyflow/react';

const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 1000;
const ITERATIONS = 16;
const MIN_RADIUS = 110;
const RADIUS_STEP = 120;

export interface EigenvectorLayoutOptions {
  width?: number;
  height?: number;
}

function getEdgeWeight(edge: Edge): number {
  const candidate = edge.data && typeof edge.data === 'object'
    ? Number((edge.data as Record<string, unknown>).weight ?? 1)
    : 1;
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 1;
}

function computeEigenvectorScores(nodes: Node[], edges: Edge[]): Map<string, number> {
  const nodeIds = nodes.map((node) => node.id);
  const scores = new Map(nodeIds.map((id) => [id, 1]));
  const weightedDegree = new Map(nodeIds.map((id) => [id, 0]));
  const adjacency = new Map<string, Array<{ id: string; weight: number }>>();

  nodeIds.forEach((id) => adjacency.set(id, []));

  edges.forEach((edge) => {
    const weight = getEdgeWeight(edge);
    adjacency.get(edge.source)?.push({ id: edge.target, weight });
    adjacency.get(edge.target)?.push({ id: edge.source, weight });
    weightedDegree.set(edge.source, (weightedDegree.get(edge.source) ?? 0) + weight);
    weightedDegree.set(edge.target, (weightedDegree.get(edge.target) ?? 0) + weight);
  });

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const nextScores = new Map<string, number>();
    let norm = 0;

    nodeIds.forEach((id) => {
      const nextValue = (adjacency.get(id) ?? []).reduce((sum, neighbor) => {
        return sum + neighbor.weight * (scores.get(neighbor.id) ?? 0);
      }, 0);

      nextScores.set(id, nextValue);
      norm += nextValue * nextValue;
    });

    const divisor = Math.sqrt(norm) || 1;
    nodeIds.forEach((id) => {
      const normalizedEigenvector = (nextScores.get(id) ?? 0) / divisor;
      const degreeBoost = (weightedDegree.get(id) ?? 0) * 0.05;
      scores.set(id, normalizedEigenvector + degreeBoost);
    });
  }

  return scores;
}

export function applyEigenvectorLayout<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  options: EigenvectorLayoutOptions = {},
): Node<T>[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const centerX = width / 2;
  const centerY = height / 2;
  const scores = computeEigenvectorScores(nodes, edges);
  const sortedNodes = [...nodes].sort((left, right) => (scores.get(right.id) ?? 0) - (scores.get(left.id) ?? 0));

  return sortedNodes.map((node, index) => {
    const ring = Math.floor(index / 6);
    const positionInRing = index % 6;
    const radius = index === 0 ? 0 : MIN_RADIUS + ring * RADIUS_STEP;
    const sliceCount = index === 0 ? 1 : Math.min(6 + ring * 2, sortedNodes.length - (ring * 6)) || 1;
    const angle = index === 0 ? 0 : (Math.PI * 2 * positionInRing) / sliceCount;

    return {
      ...node,
      position: {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      },
    };
  });
}
