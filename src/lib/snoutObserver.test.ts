import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { bindSnoutObserverToWebSocket } from './snout';
import { createCanvasDocBindings, readCanvasState, replaceCanvasNodes } from '../store/crdt';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly url: string;
  readyState = FakeWebSocket.OPEN;
  sentPayloads: string[] = [];
  private listeners = new Map<string, Set<(event: any) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  send(payload: string) {
    this.sentPayloads.push(payload);
    const parsed = JSON.parse(payload) as { id: string; graph: { nodes: Node[] } };
    const complianceGap = parsed.graph.nodes.find((node) => node.id === 'gap-1');

    setTimeout(() => {
      this.dispatch('message', {
        data: JSON.stringify({
          id: parsed.id,
          suggestions: {
            nodes: complianceGap
              ? [{
                  id: 'remediation-1',
                  type: 'StrategicLeverage',
                  position: { x: 260, y: 100 },
                  data: {
                    label: 'Remediation Strategy',
                    nodeType: 'StrategicLeverage',
                    sourceGraphLabels: ['StrategicLeverage'],
                    remediationStrategy: {
                      target_id: complianceGap.id,
                      strategy_path: 'COMPLIANT',
                      transformation_logic: 'auto-remediate',
                    },
                  },
                }]
              : [],
          },
        }),
      });
    }, 10);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
  }

  private dispatch(type: string, event: any) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

async function waitFor<T>(producer: () => T | undefined, timeoutMs: number): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = producer();
    if (value !== undefined) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
}

describe('SnoutObserver WebSocket channel', () => {
  it('sends graph state over WebSocket and injects a RemediationStrategy node into the Y.Doc within 100ms', async () => {
    const bindings = createCanvasDocBindings();
    const stop = bindSnoutObserverToWebSocket(
      bindings,
      'ws://rlm-engine.test/stream',
      FakeWebSocket as unknown as typeof WebSocket,
      0,
    );

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

    const startedAt = Date.now();
    replaceCanvasNodes(bindings, [complianceGapNode]);

    const injected = await waitFor(
      () => readCanvasState(bindings).nodes.find((node) => node.id === 'remediation-1'),
      100,
    );

    stop();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].sentPayloads).toHaveLength(1);

    const request = JSON.parse(FakeWebSocket.instances[0].sentPayloads[0]) as {
      graph: { nodes: Node[] };
    };

    expect(request.graph.nodes.map((node) => node.id)).toContain('gap-1');
    expect(injected.data.label).toBe('Remediation Strategy');
    expect(Date.now() - startedAt).toBeLessThan(100);
  });
});
