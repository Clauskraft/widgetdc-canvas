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

  // SECURITY FIX (P0): never use '*' as targetOrigin — it broadcasts session
  // IDs to every frame on the page. If no verified hostOrigin is available,
  // suppress the emit rather than leaking the message to unknown recipients.
  const origin = targetOrigin ?? useCanvasSession.getState().hostOrigin;
  if (!origin) {
    console.warn(
      '[hostBridge] emitToHost: no verified hostOrigin — message suppressed to prevent open broadcast',
    );
    return;
  }

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

  // UC5 intelligence layer: surface verified inbound messages to the toast UI.
  // Only called AFTER allowlist check + shape validation, so XSS surface is narrow.
  store.appendHostMessage(event.origin, msg);

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

// FIX (P0): Do NOT use a module-level boolean guard.
// React StrictMode double-mounts: first mount registers, cleanup runs, second
// mount registers again. A module-level flag would make the second call a no-op
// so the second mount registers no listener, then the second cleanup removes
// nothing, leaving the app permanently deaf to host messages after StrictMode
// finishes the double-mount cycle.
// Each attachBridge() call independently owns its listener registration.
export function attachBridge(): () => void {
  window.addEventListener('message', handleInbound);
  return () => {
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
