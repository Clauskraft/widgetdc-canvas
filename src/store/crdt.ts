import type { Edge, Node } from '@xyflow/react';
import type { StoreApi } from 'zustand';
import * as Y from 'yjs';

type StoredCanvasItem<T> = T & { __crdtOrder?: number };

export interface CanvasCrdtState {
  nodes: Node[];
  edges: Edge[];
}

export interface CanvasDocBindings {
  doc: Y.Doc;
  nodes: Y.Map<StoredCanvasItem<Node>>;
  edges: Y.Map<StoredCanvasItem<Edge>>;
}

type CanvasStoreLike = StoreApi<CanvasCrdtState>;

function sortStoredItems<T extends { __crdtOrder?: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => (left.__crdtOrder ?? 0) - (right.__crdtOrder ?? 0));
}

function stripOrder<T extends { __crdtOrder?: number }>(item: T): Omit<T, '__crdtOrder'> {
  const { __crdtOrder: _ignored, ...rest } = item;
  return rest;
}

function readCollection<T>(map: Y.Map<StoredCanvasItem<T>>): T[] {
  return sortStoredItems(Array.from(map.values())).map((item) => stripOrder(item) as T);
}

function replaceCollection<T extends { id: string }>(
  doc: Y.Doc,
  map: Y.Map<StoredCanvasItem<T>>,
  items: T[],
): void {
  const nextIds = new Set(items.map((item) => item.id));

  doc.transact(() => {
    for (const existingId of Array.from(map.keys())) {
      if (!nextIds.has(existingId)) {
        map.delete(existingId);
      }
    }

    items.forEach((item, index) => {
      map.set(item.id, {
        ...item,
        __crdtOrder: index,
      });
    });
  }, 'canvas-crdt-replace');
}

export function createCanvasDocBindings(doc: Y.Doc = new Y.Doc()): CanvasDocBindings {
  return {
    doc,
    nodes: doc.getMap<StoredCanvasItem<Node>>('nodes'),
    edges: doc.getMap<StoredCanvasItem<Edge>>('edges'),
  };
}

export function readCanvasState(bindings: CanvasDocBindings): CanvasCrdtState {
  return {
    nodes: readCollection(bindings.nodes),
    edges: readCollection(bindings.edges),
  };
}

export function replaceCanvasNodes(bindings: CanvasDocBindings, nodes: Node[]): void {
  replaceCollection(bindings.doc, bindings.nodes, nodes);
}

export function replaceCanvasEdges(bindings: CanvasDocBindings, edges: Edge[]): void {
  replaceCollection(bindings.doc, bindings.edges, edges);
}

export function mergeCanvasState(
  current: CanvasCrdtState,
  patch: Partial<CanvasCrdtState>,
): CanvasCrdtState {
  return {
    nodes: patch.nodes ?? current.nodes,
    edges: patch.edges ?? current.edges,
  };
}

export function observeCanvasState(
  bindings: CanvasDocBindings,
  listener: (state: CanvasCrdtState) => void,
): () => void {
  const emit = () => listener(readCanvasState(bindings));
  const observer = () => emit();

  bindings.nodes.observe(observer);
  bindings.edges.observe(observer);
  emit();

  return () => {
    bindings.nodes.unobserve(observer);
    bindings.edges.unobserve(observer);
  };
}

export function bindCanvasStoreToCrdt<T extends CanvasCrdtState>(
  store: StoreApi<T>,
  bindings: CanvasDocBindings,
): () => void {
  return observeCanvasState(bindings, (state) => {
    store.setState(state as Partial<T>);
  });
}

export function connectDocs(left: Y.Doc, right: Y.Doc): () => void {
  const leftToRight = (update: Uint8Array, origin: unknown) => {
    if (origin !== right) {
      Y.applyUpdate(right, update, left);
    }
  };
  const rightToLeft = (update: Uint8Array, origin: unknown) => {
    if (origin !== left) {
      Y.applyUpdate(left, update, right);
    }
  };

  left.on('update', leftToRight);
  right.on('update', rightToLeft);

  return () => {
    left.off('update', leftToRight);
    right.off('update', rightToLeft);
  };
}

export const canvasDoc = new Y.Doc();
export const canvasDocBindings = createCanvasDocBindings(canvasDoc);

export function resetCanvasCrdt(bindings: CanvasDocBindings = canvasDocBindings): void {
  replaceCanvasNodes(bindings, []);
  replaceCanvasEdges(bindings, []);
}
