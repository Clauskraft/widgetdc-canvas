/**
 * UC5 — Host Bridge
 * Bidirectional postMessage adapter between widgetdc-canvas (iframe) and
 * host surfaces: Open WebUI, LibreChat, Office add-in dialog.
 *
 * Inbound message types: hydrate | mutate | switch
 * Outbound message types: sessionReady | paneChanged | userEdit
 *
 * Security: NEVER echo messages from unknown origins.
 * Allowlist is intentionally conservative — add origins per known host only.
 */

import type { BridgeMessageInbound, BridgeMessageOutbound, PaneId } from '../types/session';
import { useCanvasSession } from '../state/canvasSession';

// ── Origin allowlist ─────────────────────────────────────────────────────────

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  // Open WebUI production
  'https://openwebui.widgetdc.com',
  // LibreChat production
  'https://librechat-production-f40b.up.railway.app',
  // Office add-in runtime (Word/Excel/Outlook desktop)
  'https://widgetdc.github.io',
  'https://canvas-production-4bd4.up.railway.app',
  // Local development
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
]);

// ── Office detection ─────────────────────────────────────────────────────────

function isOfficeContext(): boolean {
  return typeof (globalThis as Record<string, unknown>)['Office'] !== 'undefined';
}

function sendToOffice(data: BridgeMessageOutbound): void {
  try {
    const Office = (globalThis as Record<string, unknown>)['Office'] as {
      context?: { ui?: { messageParent?: (message: string) => void } };
    };
    Office.context?.ui?.messageParent?.(JSON.stringify(data));
  } catch (err) {
    console.warn('[hostBridge] Office.context.ui.messageParent failed:', err);
  }
}

// ── Outbound emit ────────────────────────────────────────────────────────────

export function emitToHost(data: BridgeMessageOutbound, targetOrigin?: string): void {
  if (isOfficeContext()) {
    sendToOffice(data);
    return;
  }

  const origin = targetOrigin ?? useCanvasSession.getState().hostOrigin ?? '*';

  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(data, origin);
    } else {
      // Running in a popup (window.opener) — Office dialog scenario
      window.opener?.postMessage(data, origin);
    }
  } catch (err) {
    // Same-origin restriction or parent no longer accessible
    console.warn('[hostBridge] postMessage to host failed (same-origin or closed):', err);
  }
}

// ── Inbound message handler ──────────────────────────────────────────────────

function handleInbound(event: MessageEvent): void {
  // Reject unknown origins unless allowlist explicitly contains the origin
  if (!ALLOWED_ORIGINS.has(event.origin)) {
    // Silent rejection — do not log origin to avoid leaking it
    return;
  }

  const msg = event.data as BridgeMessageInbound;
  if (typeof msg !== 'object' || msg === null || typeof msg.type !== 'string') {
    return;
  }

  const store = useCanvasSession.getState();

  // Record the verified host origin for subsequent outbound messages
  store.setHostOrigin(event.origin);

  switch (msg.type) {
    case 'hydrate': {
      if (msg.sessionId && msg.track && msg.pane) {
        store
          .hydrate({
            sessionId: msg.sessionId,
            track: msg.track,
            initialPane: msg.pane,
          })
          .catch((err: unknown) => {
            console.error('[hostBridge] hydrate dispatch failed:', err);
          });
      }
      break;
    }

    case 'switch': {
      if (msg.pane) {
        store.switchPane(msg.pane);
        emitToHost(
          {
            type: 'paneChanged',
            sessionId: store.canvasSessionId,
            activePane: msg.pane,
            timestamp: new Date().toISOString(),
          },
          event.origin,
        );
      }
      break;
    }

    case 'mutate': {
      if (msg.pane && msg.payload !== undefined) {
        store.mutatePane(msg.pane as PaneId, (doc) => {
          doc.transact(() => {
            const map = doc.getMap<unknown>('payload');
            map.set('data', msg.payload);
          }, 'host-bridge-mutate');
        });
        emitToHost(
          {
            type: 'userEdit',
            sessionId: store.canvasSessionId,
            activePane: store.activePane,
            timestamp: new Date().toISOString(),
          },
          event.origin,
        );
      }
      break;
    }

    default:
      // Unknown message type — ignore silently
      break;
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let attached = false;

export function attachBridge(): () => void {
  if (attached) {
    return () => {
      /* noop if already detached by prior caller */
    };
  }
  attached = true;
  window.addEventListener('message', handleInbound);

  return () => {
    attached = false;
    window.removeEventListener('message', handleInbound);
  };
}

/** Emit sessionReady to whatever host embedded us. */
export function emitSessionReady(): void {
  const { canvasSessionId } = useCanvasSession.getState();
  emitToHost({
    type: 'sessionReady',
    sessionId: canvasSessionId,
    timestamp: new Date().toISOString(),
  });
}
