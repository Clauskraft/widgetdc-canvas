import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { applyEigenvectorLayout } from './eigenvectorLayout';

describe('applyEigenvectorLayout', () => {
  it('pulls high-priority nodes toward the center based on weighted edges', () => {
    const nodes: Node[] = [
      { id: 'core', type: 'StrategicLeverage', position: { x: 0, y: 0 }, data: { label: 'Core', nodeType: 'StrategicLeverage' } },
      { id: 'left', type: 'Evidence', position: { x: 0, y: 0 }, data: { label: 'Left', nodeType: 'Evidence' } },
      { id: 'right', type: 'Evidence', position: { x: 0, y: 0 }, data: { label: 'Right', nodeType: 'Evidence' } },
    ];

    const edges: Edge[] = [
      { id: 'e-1', source: 'core', target: 'left', data: { weight: 4 } },
      { id: 'e-2', source: 'core', target: 'right', data: { weight: 3 } },
    ];

    const laidOut = applyEigenvectorLayout(nodes, edges, { width: 1000, height: 800 });
    const core = laidOut.find((node) => node.id === 'core');
    const left = laidOut.find((node) => node.id === 'left');
    const right = laidOut.find((node) => node.id === 'right');

    expect(core).toBeDefined();
    expect(left).toBeDefined();
    expect(right).toBeDefined();

    const center = { x: 500, y: 400 };
    const distanceToCenter = (node: Node) => Math.hypot(node.position.x - center.x, node.position.y - center.y);

    expect(distanceToCenter(core!)).toBeLessThan(distanceToCenter(left!));
    expect(distanceToCenter(core!)).toBeLessThan(distanceToCenter(right!));
  });
});
