import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';

import { Canvas } from './components/Canvas';
import { CanvasCollaboration } from './components/CanvasCollaboration';
import { Toolbar } from './components/Toolbar';
import { ToolPalette } from './components/ToolPalette';
import { NodeInspector } from './components/NodeInspector';
import { CommandPalette } from './components/CommandPalette';
import { ToastProvider, useToast } from './components/Toast';
import { SnoutObserver } from './components/SnoutObserver';
// LIN-584: AIPanel, Journal, StatusBar deleted — replaced by Open WebUI tools
import { useCanvasStore, type CanvasSurface } from './store/canvasStore';

export const DEBUG_BUILD_STAMP = 'OMNI-MERGE-VERIFY-2026-03-19T03:17Z';

export function resolveCockpitUrl(): string {
  const configured = String(import.meta.env.VITE_COCKPIT_URL ?? '').trim().replace(/\/$/, '');
  return configured || '/api/consulting-cockpit/stats';
}

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

    if (activeSurface !== 'canvas') {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        if (hasPersistedCanvasState()) {
          return;
        }

        await useCanvasStore.getState().loadTemplate('h10-strategic-north-star');
      } catch {
        if (!cancelled) {
          // Keep the shell alive; template bootstrap is not allowed to kill the surface.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSurface]);

  return null;
}

function ToastBridge() {
  const { toast } = useToast();

  useEffect(() => {
    useCanvasStore.getState().setToast(toast);
  }, [toast]);

  return null;
}

export function AppShell() {
  const activeSurface = useCanvasStore((state) => state.activeSurface);
  const setActiveSurface = useCanvasStore((state) => state.setActiveSurface);
  const [surfaceHydrated, setSurfaceHydrated] = useState(false);

  useEffect(() => {
    setActiveSurface(readSurfaceFromUrl());
    setSurfaceHydrated(true);
  }, [setActiveSurface]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveSurface(readSurfaceFromUrl());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveSurface]);

  useEffect(() => {
    if (!surfaceHydrated) {
      return;
    }

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
                  <span className="text-xl">🧠</span>
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
