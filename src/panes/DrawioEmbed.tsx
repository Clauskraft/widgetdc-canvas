/**
 * UC5 — DrawioEmbed
 * Iframe wrapper around embed.diagrams.net with bidirectional JSON proto messaging.
 * postMessage protocol: https://www.drawio.com/doc/faq/embed-mode
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasSession } from '../state/canvasSession';

const DRAWIO_ORIGIN = 'https://embed.diagrams.net';
const DRAWIO_SRC =
  `${DRAWIO_ORIGIN}/?embed=1&proto=json&spin=1&libraries=1&lang=en`;

type DrawioAction = 'load' | 'export' | 'merge' | 'dialog' | 'template' | 'draft';
type DrawioEventType = 'init' | 'load' | 'save' | 'export' | 'close' | 'template' | 'draft';

interface DrawioOutboundMessage {
  action: DrawioAction;
  xml?: string;
  format?: string;
  scale?: number;
  data?: unknown;
}

interface DrawioInboundEvent {
  event: DrawioEventType;
  xml?: string;
  data?: string;
}

// ── Status indicator ──────────────────────────────────────────────────────────

interface StatusDotProps {
  connected: boolean;
}

function StatusDot({ connected }: StatusDotProps) {
  return (
    <span
      aria-label={connected ? 'Diagrams.net connected' : 'Connecting to diagrams.net'}
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: connected ? 'var(--sc-track-diagram)' : 'var(--sc-ink-fog)',
        marginRight: '6px',
        verticalAlign: '1px',
        animation: connected ? 'none' : 'sc-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        transition: 'background var(--sc-duration-settle) var(--sc-ease-emphasized)',
      }}
    />
  );
}

// ── DrawioEmbed ───────────────────────────────────────────────────────────────

export function DrawioEmbed() {
  const { canvasSessionId, track, panes, mutatePane } = useCanvasSession((s) => ({
    canvasSessionId: s.canvasSessionId,
    track: s.track,
    panes: s.panes,
    mutatePane: s.mutatePane,
  }));

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [connected, setConnected] = useState(false);
  const [diagramXml, setDiagramXml] = useState<string>('');

  // Send a message to the diagrams.net iframe
  const sendToDrawio = useCallback((msg: DrawioOutboundMessage) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(JSON.stringify(msg), DRAWIO_ORIGIN);
    } catch (err) {
      console.warn('[DrawioEmbed] postMessage to drawio failed:', err);
    }
  }, []);

  // Load saved XML from Y.Doc on connect
  const loadSavedXml = useCallback(() => {
    const doc = panes.drawio.crdtDoc;
    const map = doc.getMap<string>('diagram');
    const saved = map.get('xml');
    sendToDrawio({ action: 'load', xml: saved ?? '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>' });
  }, [panes.drawio.crdtDoc, sendToDrawio]);

  // Handle messages from diagrams.net
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== DRAWIO_ORIGIN) return;

      let parsed: DrawioInboundEvent;
      try {
        parsed = JSON.parse(event.data as string) as DrawioInboundEvent;
      } catch {
        return;
      }

      switch (parsed.event) {
        case 'init': {
          setConnected(true);
          loadSavedXml();
          break;
        }
        case 'save':
        case 'load': {
          if (parsed.xml) {
            setDiagramXml(parsed.xml);
            // Persist to Y.Doc
            mutatePane('drawio', (doc) => {
              const map = doc.getMap<string>('diagram');
              map.set('xml', parsed.xml!);
            });
          }
          break;
        }
        case 'export': {
          if (parsed.data) {
            mutatePane('drawio', (doc) => {
              const map = doc.getMap<string>('diagram');
              map.set('exportData', parsed.data!);
            });
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadSavedXml, mutatePane]);

  const trackHue = track ? `var(--sc-track-${track.replace('_', '-')})` : 'var(--sc-ink-graphite)';

  return (
    <div
      className="sc-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 'var(--sc-pane-pad)',
        background: 'var(--sc-surface-bg)',
      }}
    >
      {/* Pane header */}
      <div className="sc-pane-head">
        <span className="sc-pane-label" style={{ color: trackHue }}>
          Diagram · DrawioEmbed
        </span>
        <span className="sc-pane-meta" style={{ display: 'flex', alignItems: 'center' }}>
          <StatusDot connected={connected} />
          {connected ? 'connected' : 'connecting'}
          {canvasSessionId ? ` · ${canvasSessionId.slice(0, 8)}` : ''}
          {diagramXml ? ' · saved' : ''}
        </span>
      </div>

      {/* iframe */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          border: '0.5px solid var(--sc-paper-whisper)',
          borderRadius: 'var(--sc-radius-md)',
          overflow: 'hidden',
          background: 'var(--sc-surface-elevated)',
        }}
      >
        <iframe
          ref={iframeRef}
          src={DRAWIO_SRC}
          title="Diagrams.net embedded editor"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          // Minimal sandbox: allow scripts + same-origin + popups for save dialogs
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          allow="clipboard-read; clipboard-write"
          aria-label="Diagrams.net diagram editor"
        />
      </div>
    </div>
  );
}
