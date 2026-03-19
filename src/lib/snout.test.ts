import { describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { bindSnoutObserver, type SnoutTransport } from './snout';
import { createCanvasDocBindings, readCanvasState, replaceCanvasNodes } from '../store/crdt';

async function waitFor<T>(fn: () => T | undefined, timeoutMs: number): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = fn();
    if (value !== undefined) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
}

describe('Snout observer', () => {
  it('returns a speculative remediation edge within 100ms for a ComplianceGap delta', async () => {
    const bindings = createCanvasDocBindings();
    const complianceGapNode: Node = {
      id: 'gap-1',
      type: 'ComplianceGap',
      position: { x: 100, y: 100 },
      data: {
        label: 'Compliance Gap',
        nodeType: 'ComplianceGap',
        sourceGraphLabels: ['ComplianceGap'],
      },
    };

    const remediationNode: Node = {
      id: 'strategy-1',
      type: 'StrategicLeverage',
      position: { x: 260, y: 100 },
      data: {
        label: 'Remediation Strategy',
        subtitle: 'Speculative auto-complete',
        nodeType: 'StrategicLeverage',
        sourceGraphLabels: ['StrategicLeverage'],
      },
    };

    const remediationEdge: Edge = {
      id: 'edge-remediation-1',
      source: 'gap-1',
      target: 'strategy-1',
      label: 'SUGGESTS_REMEDIATION',
    };

    const transport: SnoutTransport = {
      async requestSuggestions(delta) {
        expect(delta.addedNodes).toHaveLength(1);
        expect(delta.addedNodes[0].sourceGraphLabels).toContain('ComplianceGap');
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          nodes: [remediationNode],
          edges: [remediationEdge],
        };
      },
    };

    const stop = bindSnoutObserver(bindings, transport, 0);
    const startedAt = Date.now();

    replaceCanvasNodes(bindings, [complianceGapNode]);

    const edge = await waitFor(
      () => readCanvasState(bindings).edges.find((candidate) => candidate.id === remediationEdge.id),
      100,
    );

    stop();

    expect(edge).toEqual(remediationEdge);
    expect(Date.now() - startedAt).toBeLessThan(100);
    expect(readCanvasState(bindings).nodes.map((node) => node.id)).toEqual(['gap-1', 'strategy-1']);
  });
});
