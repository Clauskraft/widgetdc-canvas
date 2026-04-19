/**
 * UC5 — HostMessageToast
 * Surfaces inbound postMessage events from verified host origins (LibreChat,
 * Open WebUI, Office add-in) as transient top-right toasts. Only renders
 * messages that the hostBridge allowlist + shape validation already accepted,
 * so trust boundary is one step deeper than the toast.
 */

import { useEffect, useState } from 'react';
import { useCanvasSession, type HostMessageEntry } from '../state/canvasSession';

const TOAST_MS = 4000;

function summarise(entry: HostMessageEntry): string {
  const p = entry.payload as
    | { type?: string; text?: string; pane?: string; payload?: unknown }
    | undefined;
  if (!p || typeof p !== 'object') return 'host message';
  const prefix = typeof p.type === 'string' ? p.type : 'message';
  if (typeof p.text === 'string' && p.text.length > 0) {
    return `${prefix}: ${p.text.slice(0, 120)}`;
  }
  if (typeof p.pane === 'string') {
    return `${prefix}: pane ${p.pane}`;
  }
  return prefix;
}

export function HostMessageToast() {
  const hostMessages = useCanvasSession((s) => s.hostMessages);
  const [visibleId, setVisibleId] = useState<string | null>(null);

  useEffect(() => {
    if (hostMessages.length === 0) return;
    const latest = hostMessages[hostMessages.length - 1];
    const id = `${latest.receivedAt}-${latest.origin}`;
    setVisibleId(id);
    const t = setTimeout(() => {
      setVisibleId((curr) => (curr === id ? null : curr));
    }, TOAST_MS);
    return () => clearTimeout(t);
  }, [hostMessages]);

  if (!visibleId || hostMessages.length === 0) return null;
  const latest = hostMessages[hostMessages.length - 1];

  let hostname = latest.origin;
  try {
    hostname = new URL(latest.origin).hostname;
  } catch {
    // keep raw origin on parse failure
  }

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setVisibleId(null)}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        maxWidth: '360px',
        padding: '12px 16px',
        background: 'var(--sc-paper-deep)',
        border: '0.5px solid var(--sc-ink-graphite)',
        borderRadius: 'var(--sc-radius-sm)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
        cursor: 'pointer',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontFamily: 'var(--sc-font-mono)',
      }}
    >
      <span
        style={{
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--sc-ink-fog)',
        }}
      >
        Host · {hostname}
      </span>
      <span
        style={{
          fontSize: '11px',
          letterSpacing: '0.05em',
          color: 'var(--sc-ink-graphite)',
          wordBreak: 'break-word',
        }}
      >
        {summarise(latest)}
      </span>
      <span
        style={{
          fontSize: '8px',
          letterSpacing: '0.2em',
          color: 'var(--sc-ink-fog)',
          marginTop: '2px',
        }}
      >
        click to dismiss
      </span>
    </div>
  );
}
