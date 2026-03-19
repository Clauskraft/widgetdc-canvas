import type { Edge, Node } from '@xyflow/react';
import * as Y from 'yjs';
import type { CanvasDocBindings, CanvasCrdtState } from '../store/crdt';
import { readCanvasState, replaceCanvasEdges, replaceCanvasNodes } from '../store/crdt';

export interface SnoutDeltaNode {
  id: string;
  label: string;
  nodeType?: string;
  sourceGraphLabels?: string[];
}

export interface SnoutDeltaPayload {
  addedNodes: SnoutDeltaNode[];
}

export interface SnoutGraphPayload {
  nodes: Node[];
  edges: Edge[];
}

export interface SnoutSuggestionPayload {
  nodes?: Node[];
  edges?: Edge[];
}

export interface SnoutTransport {
  requestSuggestions(delta: SnoutDeltaPayload): Promise<SnoutSuggestionPayload>;
  close?(): void;
}

function isComplianceGapNode(node: Node): boolean {
  const graphLabels = Array.isArray(node.data?.sourceGraphLabels)
    ? (node.data.sourceGraphLabels as string[])
    : [];

  return graphLabels.includes('ComplianceGap')
    || node.data?.label === 'ComplianceGap'
    || node.data?.label === 'Compliance Gap';
}

function toDeltaNode(node: Node): SnoutDeltaNode {
  return {
    id: node.id,
    label: String(node.data?.label ?? node.id),
    nodeType: typeof node.type === 'string' ? node.type : undefined,
    sourceGraphLabels: Array.isArray(node.data?.sourceGraphLabels)
      ? (node.data.sourceGraphLabels as string[])
      : undefined,
  };
}

function mergeUniqueById<T extends { id: string }>(current: T[], next: T[]): T[] {
  const merged = new Map<string, T>();
  current.forEach((item) => merged.set(item.id, item));
  next.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

export function applySnoutSuggestions(
  bindings: CanvasDocBindings,
  suggestions: SnoutSuggestionPayload,
): CanvasCrdtState {
  const current = readCanvasState(bindings);
  const mergedNodes = mergeUniqueById(current.nodes, suggestions.nodes ?? []);
  const mergedEdges = mergeUniqueById(current.edges, suggestions.edges ?? []);

  replaceCanvasNodes(bindings, mergedNodes);
  replaceCanvasEdges(bindings, mergedEdges);

  return {
    nodes: mergedNodes,
    edges: mergedEdges,
  };
}

export function bindSnoutObserver(
  bindings: CanvasDocBindings,
  transport: SnoutTransport,
  debounceMs = 10,
): () => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let previousNodeIds = new Set(readCanvasState(bindings).nodes.map((node) => node.id));
  const pendingNodes = new Map<string, Node>();

  const flush = async () => {
    const deltaNodes = Array.from(pendingNodes.values())
      .filter(isComplianceGapNode)
      .map(toDeltaNode);

    pendingNodes.clear();

    if (deltaNodes.length === 0) {
      return;
    }

    const suggestions = await transport.requestSuggestions({
      addedNodes: deltaNodes,
    });
    applySnoutSuggestions(bindings, suggestions);
  };

  const observer = () => {
    const current = readCanvasState(bindings);
    const currentNodeIds = new Set(current.nodes.map((node) => node.id));

    current.nodes.forEach((node) => {
      if (!previousNodeIds.has(node.id)) {
        pendingNodes.set(node.id, node);
      }
    });

    previousNodeIds = currentNodeIds;

    if (pendingNodes.size === 0) {
      return;
    }

    if (debounceMs <= 0) {
      void flush();
      return;
    }

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      void flush();
    }, debounceMs);
  };

  bindings.doc.on('update', observer);

  return () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    bindings.doc.off('update', observer);
    transport.close?.();
  };
}

export function createWebSocketSnoutTransport(
  bindings: CanvasDocBindings,
  url: string,
  webSocketFactory: typeof WebSocket = WebSocket,
): SnoutTransport {
  let socket: WebSocket | null = null;
  let requestId = 0;

  const ensureSocket = () => {
    if (socket && (socket.readyState === webSocketFactory.OPEN || socket.readyState === webSocketFactory.CONNECTING)) {
      return socket;
    }

    socket = new webSocketFactory(url);
    return socket;
  };

  return {
    requestSuggestions(delta) {
      return new Promise<SnoutSuggestionPayload>((resolve, reject) => {
        const activeSocket = ensureSocket();
        const id = `snout-${++requestId}`;

        const cleanup = () => {
          activeSocket.removeEventListener('message', onMessage);
          activeSocket.removeEventListener('error', onError);
        };

        const onMessage = (event: MessageEvent<string>) => {
          try {
            const payload = JSON.parse(event.data) as { id?: string; suggestions?: SnoutSuggestionPayload };
            if (payload.id !== id) {
              return;
            }
            cleanup();
            resolve(payload.suggestions ?? {});
          } catch (error) {
            cleanup();
            reject(error);
          }
        };

        const onError = (event: Event) => {
          cleanup();
          reject(new Error(`Snout WebSocket failed: ${event.type}`));
        };

        const send = () => {
          activeSocket.addEventListener('message', onMessage);
          activeSocket.addEventListener('error', onError, { once: true });
          activeSocket.send(JSON.stringify({
            id,
            delta,
            graph: readCanvasState(bindings),
          }));
        };

        if (activeSocket.readyState === webSocketFactory.OPEN) {
          send();
          return;
        }

        activeSocket.addEventListener('open', send, { once: true });
      });
    },
    close() {
      socket?.close();
      socket = null;
    },
  };
}

export function bindSnoutObserverToWebSocket(
  bindings: CanvasDocBindings,
  url: string,
  webSocketFactory: typeof WebSocket = WebSocket,
  debounceMs = 10,
): () => void {
  return bindSnoutObserver(
    bindings,
    createWebSocketSnoutTransport(bindings, url, webSocketFactory),
    debounceMs,
  );
}
