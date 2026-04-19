import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';

import { Canvas } from './components/Canvas';
import { CanvasCollaboration } from './components/CanvasCollaboration';
import { ToolPalette } from './components/ToolPalette';
import { NodeInspector } from './components/NodeInspector';
import { CommandPalette } from './components/CommandPalette';
import { ToastProvider, useToast } from './components/Toast';
import { SnoutObserver } from './components/SnoutObserver';
// LIN-584: AIPanel, Journal, StatusBar deleted — replaced by Open WebUI tools
import { useCanvasStore, type CanvasSurface } from './store/canvasStore';

// UC5 imports
import { useCanvasSession } from './state/canvasSession';
import { attachBridge, emitSessionReady } from './bridge/hostBridge';
import { TextPane } from './panes/TextPane';
import { SlidePane } from './panes/SlidePane';
import { DrawioEmbed } from './panes/DrawioEmbed';
import { SplitPaneLayout } from './layouts/SplitPaneLayout';
import type { BuilderTrack, PaneId } from './types/session';

export const DEBUG_BUILD_STAMP = 'UC5-2026-04-18';

export function resolveCockpitUrl(): string {
  const configured = String(import.meta.env.VITE_COCKPIT_URL ?? '').trim().replace(/\/$/, '');
  return configured || '/api/consulting-cockpit/stats';
}

// ── UC5 URL param reading ─────────────────────────────────────────────────────

interface UC5Params {
  sessionId: string | null;
  track: BuilderTrack | null;
  pane: PaneId | null;
}

const VALID_TRACKS: ReadonlySet<string> = new Set([
  'textual', 'slide_flow', 'diagram', 'architecture', 'graphical', 'code', 'experiment',
]);
const VALID_PANES: ReadonlySet<string> = new Set([
  'canvas', 'markdown', 'slides', 'drawio', 'split',
]);

function readUC5Params(): UC5Params {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get('session');
  const rawTrack = url.searchParams.get('track') ?? '';
  const rawPane = url.searchParams.get('pane') ?? '';

  return {
    sessionId: sessionId ?? null,
    track: VALID_TRACKS.has(rawTrack) ? (rawTrack as BuilderTrack) : null,
    pane: VALID_PANES.has(rawPane) ? (rawPane as PaneId) : null,
  };
}

/** Returns true if the user explicitly opted into the legacy ReactFlow shell via ?legacy=1. */
function isLegacyOptIn(): boolean {
  try {
    return new URL(window.location.href).searchParams.get('legacy') === '1';
  } catch {
    return false;
  }
}

/**
 * Returns true if the app should render UC5 as the default shell. UC5 is the
 * canonical canvas — the legacy ReactFlow shell is only reachable via the
 * `?legacy=1` query-param escape hatch for rollback scenarios. Explicit UC5
 * session params (`?session=...`) are also supported for embed URLs returned
 * by the orchestrator `canvas_builder` tool.
 */
function isUC5Mode(): boolean {
  return !isLegacyOptIn();
}

// ── UC5 Pane router ───────────────────────────────────────────────────────────

function UC5PaneRouter() {
  const activePane = useCanvasSession((s) => s.activePane);
  const track = useCanvasSession((s) => s.track);

  // The canvas pane re-uses the legacy ReactFlow Canvas — it is already
  // mounted in the UC5 shell below. This router only governs the non-canvas panes.
  switch (activePane) {
    case 'markdown':
      return <TextPane />;
    case 'slides':
      return <SlidePane />;
    case 'drawio':
      return <DrawioEmbed />;
    case 'split':
      return (
        <SplitPaneLayout
          left={<LegacyCanvas />}
          right={<TextPane />}
        />
      );
    case 'canvas':
    default:
      return <LegacyCanvas track={track} />;
  }
}

// ── Thin wrapper around legacy ReactFlow canvas ───────────────────────────────

function LegacyCanvas({ track }: { track?: BuilderTrack | null }) {
  const trackHue = track
    ? `var(--sc-track-${track.replace('_', '-')})`
    : 'var(--sc-ink-graphite)';

  return (
    <div
      className="sc-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--sc-surface-bg)',
        position: 'relative',
      }}
    >
      <div
        style={{
          padding: 'var(--sc-pane-pad) var(--sc-pane-pad) 0',
        }}
      >
        <div className="sc-pane-head">
          <span className="sc-pane-label" style={{ color: trackHue }}>
            Canvas · Architecture
          </span>
          <span className="sc-pane-meta">isolines · 7 tracks · 18 ticks/ring</span>
        </div>
      </div>
      {/* ReactFlow canvas fills the remaining space */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ToolPalette />
        <Canvas />
        <NodeInspector />
        <CanvasCollaboration />
        <SnoutObserver />
      </div>
    </div>
  );
}

// ── UC5 Track legend ──────────────────────────────────────────────────────────

const TRACKS: Array<{ key: BuilderTrack; label: string; index: number }> = [
  { key: 'textual', label: 'T1 · textual', index: 1 },
  { key: 'slide_flow', label: 'T2 · slide flow', index: 2 },
  { key: 'diagram', label: 'T3 · diagram', index: 3 },
  { key: 'architecture', label: 'T4 · architecture', index: 4 },
  { key: 'graphical', label: 'T5 · graphical', index: 5 },
  { key: 'code', label: 'T6 · code', index: 6 },
  { key: 'experiment', label: 'T7 · experiment', index: 7 },
];

function TrackLegend() {
  const track = useCanvasSession((s) => s.track);
  const switchPane = useCanvasSession((s) => s.switchPane);
  const activePane = useCanvasSession((s) => s.activePane);

  return (
    <nav
      aria-label="Builder tracks"
      style={{
        display: 'flex',
        gap: '22px',
        padding: '14px var(--sc-pane-pad) 20px',
        borderBottom: '0.5px solid var(--sc-paper-whisper)',
        flexWrap: 'wrap',
        background: 'var(--sc-surface-bg)',
        flexShrink: 0,
      }}
    >
      {TRACKS.map((t) => {
        const isActive = t.key === track;
        const hue = `var(--sc-track-${t.key.replace('_', '-')})`;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              // Map track to its natural pane
              const paneMap: Record<BuilderTrack, PaneId> = {
                textual: 'markdown',
                slide_flow: 'slides',
                diagram: 'drawio',
                architecture: 'split',
                graphical: 'canvas',
                code: 'markdown',
                experiment: 'split',
              };
              switchPane(paneMap[t.key]);
            }}
            aria-pressed={isActive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '10px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: isActive ? 'var(--sc-ink-graphite)' : hue,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 0',
              fontWeight: isActive ? 500 : 400,
              transition: `color var(--sc-duration-quick) var(--sc-ease-emphasized)`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                background: hue,
                opacity: 0.88,
                borderRadius: '1px',
                flexShrink: 0,
              }}
            />
            {t.label}
          </button>
        );
      })}

      {/* Pane switcher pills */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(['canvas', 'markdown', 'slides', 'drawio', 'split'] as PaneId[]).map((pane) => {
          const isActive = pane === activePane;
          return (
            <button
              key={pane}
              type="button"
              onClick={() => switchPane(pane)}
              aria-pressed={isActive}
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: 'var(--sc-tracking-label)',
                textTransform: 'uppercase',
                color: isActive ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-fog)',
                background: 'transparent',
                border: '0.5px solid',
                borderColor: isActive ? 'var(--sc-ink-graphite)' : 'var(--sc-paper-whisper)',
                borderRadius: 'var(--sc-radius-sm)',
                padding: '3px 8px',
                cursor: 'pointer',
                transition: `all var(--sc-duration-quick) var(--sc-ease-emphasized)`,
              }}
            >
              {pane}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── UC5 status bar (bottom) ───────────────────────────────────────────────────

function UC5StatusBar() {
  // FIX (P0): individual selectors to avoid infinite re-render loop.
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const hostOrigin = useCanvasSession((s) => s.hostOrigin);
  const isHydrating = useCanvasSession((s) => s.isHydrating);

  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '10px var(--sc-pane-pad)',
        borderTop: '0.5px solid var(--sc-paper-whisper)',
        background: 'var(--sc-surface-bg)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--sc-ink-fog)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span className="sc-bridge-dot" aria-hidden="true" />
        Bridge · postMessage
        {hostOrigin ? ` · ${new URL(hostOrigin).hostname}` : ' · unattached'}
      </span>
      <span
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '9px',
          letterSpacing: '0.15em',
          color: 'var(--sc-ink-fog)',
          marginLeft: 'auto',
        }}
      >
        {isHydrating ? 'hydrating…' : canvasSessionId ? `session ${canvasSessionId.slice(0, 8)}` : 'no session'}
        {' · one surface · many windows'}
      </span>
    </footer>
  );
}

// ── UC5 Shell ─────────────────────────────────────────────────────────────────

function UC5Shell() {
  // FIX (P1): Read actions via getState() inside the effect so we never need
  // them as reactive deps. Pulling `hydrate` as a selector causes the effect
  // to re-run on re-renders because Zustand action references — while stable —
  // still register as deps and can trigger double-hydrate in development.
  // Using getState() is the canonical Zustand pattern for imperative calls.

  // On mount: read URL params, attach bridge, call hydrate; destroy docs on unmount
  useEffect(() => {
    const detach = attachBridge();
    const store = useCanvasSession.getState();
    const { sessionId, track, pane } = readUC5Params();

    // Default entry (no session param) → auto-bootstrap a local session so
    // the canvas is immediately usable from the root URL. Uses the same UUID
    // scheme the orchestrator's canvas_builder would return.
    const effectiveSessionId =
      sessionId ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `local-${crypto.randomUUID()}`
        : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

    store
      .hydrate({
        sessionId: effectiveSessionId,
        track: track ?? 'textual',
        initialPane: pane ?? 'markdown',
      })
      .then(() => { emitSessionReady(); })
      .catch((err: unknown) => {
        // Backend hydrate endpoint may 404 until UC3+backend wiring lands; non-fatal.
        console.warn('[UC5Shell] hydrate soft-fail (backend endpoint may not be live yet):', err);
        emitSessionReady();
      });

    return () => {
      detach();
      // FIX (P1): destroy all Y.Doc instances on unmount to prevent memory leaks.
      useCanvasSession.getState().destroyDocs();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="sc-root sc-paper-grain"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '24px var(--sc-pane-pad) 20px',
          borderBottom: '0.5px solid var(--sc-paper-whisper)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '11px',
            letterSpacing: 'var(--sc-tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-graphite)',
          }}
        >
          WidgeTDC · Unified Canvas · Substrate Cartography
        </span>
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            color: 'var(--sc-ink-fog)',
          }}
        >
          55°40&prime;N · 12°34&prime;E · Plate I
        </span>
      </header>

      {/* Track legend + pane switcher */}
      <TrackLegend />

      {/* Pane content */}
      <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <ReactFlowProvider>
          <UC5PaneRouter />
        </ReactFlowProvider>
      </main>

      {/* Status bar */}
      <UC5StatusBar />
    </div>
  );
}

// ── Legacy shell helpers ──────────────────────────────────────────────────────

function hasPersistedCanvasState(): boolean {
  const { nodes, edges } = useCanvasStore.getState();
  return nodes.length > 0 || edges.length > 0;
}

function readSurfaceFromUrl(): CanvasSurface {
  const url = new URL(window.location.href);
  const view = url.searchParams.get('view');
  if (view === 'knowledge' || view === 'journal') {
    return view;
  }
  return 'canvas';
}

function syncSurfaceToUrl(surface: CanvasSurface) {
  const url = new URL(window.location.href);
  if (surface === 'canvas') {
    url.searchParams.delete('view');
  } else {
    url.searchParams.set('view', surface);
  }
  window.history.replaceState({}, '', url);
}

function AutoLoader() {
  const activeSurface = useCanvasStore((state) => state.activeSurface);

  useEffect(() => {
    let cancelled = false;
    if (activeSurface !== 'canvas') return () => { cancelled = true; };

    (async () => {
      try {
        if (hasPersistedCanvasState()) return;
        await useCanvasStore.getState().loadTemplate('h10-strategic-north-star');
      } catch {
        if (!cancelled) {
          // Keep the shell alive; template bootstrap is not allowed to kill the surface.
        }
      }
    })();

    return () => { cancelled = true; };
  }, [activeSurface]);

  return null;
}

function ToastBridge() {
  const { toast } = useToast();
  useEffect(() => { useCanvasStore.getState().setToast(toast); }, [toast]);
  return null;
}

// ── Legacy shell (non-UC5 mode) ───────────────────────────────────────────────

function LegacyShell() {
  const activeSurface = useCanvasStore((state) => state.activeSurface);
  const setActiveSurface = useCanvasStore((state) => state.setActiveSurface);
  const [surfaceHydrated, setSurfaceHydrated] = useState(false);

  useEffect(() => {
    setActiveSurface(readSurfaceFromUrl());
    setSurfaceHydrated(true);
  }, [setActiveSurface]);

  useEffect(() => {
    const handlePopState = () => { setActiveSurface(readSurfaceFromUrl()); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveSurface]);

  useEffect(() => {
    if (!surfaceHydrated) return;
    syncSurfaceToUrl(activeSurface);
  }, [activeSurface, surfaceHydrated]);

  return (
    <ToastProvider>
      <ReactFlowProvider>
        <ToastBridge />
        <CommandPalette />

        <div className="flex flex-col h-screen w-screen bg-[#050b14] overflow-hidden">
          <motion.div className="flex-1 w-full h-full relative">
            <motion.div className="absolute inset-0 flex flex-col bg-neural-bg">
              <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-50 flex items-center justify-between">
                <div className="flex items-center gap-3 bg-neural-surface/80 backdrop-blur-md px-4 py-2 rounded-full border border-neural-border shadow-lg pointer-events-auto">
                  <h1 className="text-sm font-bold text-gray-100 tracking-wide">WidgeTDC Canvas</h1>
                  <span className="text-[10px] font-black text-lime-300 border-l border-lime-500/30 pl-3 tracking-widest">
                    Component Library
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {activeSurface === 'knowledge' && (
                    <span className="text-[10px] text-purple-300 font-medium uppercase tracking-widest bg-purple-500/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/20">
                      Knowledge Surface
                    </span>
                  )}
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest bg-neural-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neural-border">
                    Ctrl+K Commands
                  </span>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden relative mt-0">
                <ToolPalette />
                <Canvas />
                <NodeInspector />
                {surfaceHydrated && activeSurface === 'canvas' && <AutoLoader />}
                <CanvasCollaboration />
                <SnoutObserver />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </ReactFlowProvider>
    </ToastProvider>
  );
}

// ── AppShell — top-level router ───────────────────────────────────────────────

export function AppShell() {
  // UC5 mode: activated when ?session=... is in the URL
  if (isUC5Mode()) {
    return (
      <ToastProvider>
        <UC5Shell />
      </ToastProvider>
    );
  }

  // Legacy mode: original dark-theme ReactFlow canvas
  return <LegacyShell />;
}
