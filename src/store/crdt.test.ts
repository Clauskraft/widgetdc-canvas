import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { Edge, Node } from '@xyflow/react';
import {
  connectDocs,
  createCanvasDocBindings,
  readCanvasState,
  replaceCanvasEdges,
  replaceCanvasNodes,
} from './crdt';

describe('canvas CRDT bindings', () => {
  it('preserves concurrent StrategicLeverage node and edge writes without JSON overwrite', () => {
    const clientADoc = new Y.Doc();
    const clientBDoc = new Y.Doc();
    const disconnect = connectDocs(clientADoc, clientBDoc);

    const clientA = createCanvasDocBindings(clientADoc);
    const clientB = createCanvasDocBindings(clientBDoc);

    const node: Node = {
      id: 'leverage-1',
      type: 'StrategicLeverage',
      position: { x: 100, y: 100 },
      data: {
        label: 'Strategic Leverage',
        nodeType: 'StrategicLeverage',
        sourceGraphLabels: ['StrategicLeverage'],
      },
    };

    const edge: Edge = {
      id: 'edge-1',
      source: 'leverage-1',
      target: 'strategy-1',
      label: 'LEVERAGES',
    };

    replaceCanvasNodes(clientA, [node]);
    replaceCanvasEdges(clientB, [edge]);

    const finalState = readCanvasState(clientA);
    disconnect();

    expect(finalState.nodes).toEqual([node]);
    expect(finalState.edges).toEqual([edge]);
  });
});
