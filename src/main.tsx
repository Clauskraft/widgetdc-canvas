import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';
import { BookOpen, Map } from 'lucide-react';
import { Canvas } from './components/Canvas';
import { CanvasCollaboration } from './components/CanvasCollaboration';
import { Toolbar } from './components/Toolbar';
import { AIPanel } from './components/AIPanel';
import { ToolPalette } from './components/ToolPalette';
import { StatusBar } from './components/StatusBar';
import { NodeInspector } from './components/NodeInspector';
import { CommandPalette } from './components/CommandPalette';
import { Journal } from './components/Journal';
import { ToastProvider, useToast } from './components/Toast';
import { SnoutObserver } from './components/SnoutObserver';
import { useCanvasStore } from './store/canvasStore';
import './index.css';

const DEBUG_BUILD_STAMP = 'OMNI-MERGE-VERIFY-2026-03-19T03:17Z';

function hasPersistedCanvasState(): boolean {
  const { nodes, edges } = useCanvasStore.getState();
  return nodes.length > 0 || edges.length > 0;
}

function AutoLoader() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (hasPersistedCanvasState()) {
          if (!cancelled) setStatus('ready');
          return;
        }
        // Run the H10 Strategic North Star flow as the default experience
        await useCanvasStore.getState().loadTemplate('h10-strategic-north-star');
        if (cancelled) return;
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}

function ToastBridge() {
  const { toast } = useToast();
  useEffect(() => {
    useCanvasStore.getState().setToast(toast);
  }, [toast]);
  return null;
}

function App() {
  const [isJournalOpen, setIsJournalOpen] = useState(false);

  return (
    <ToastProvider>
      <ReactFlowProvider>
        <ToastBridge />
        <CommandPalette />

        <div className="flex flex-col h-screen w-screen bg-[#050b14] overflow-hidden">
          <motion.div className="flex-1 w-full h-full relative">
            <motion.div
              className="absolute inset-0 flex flex-col bg-neural-bg"
              animate={{
                opacity: isJournalOpen ? 0 : 1,
                scale: isJournalOpen ? 0.985 : 1,
              }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{
                pointerEvents: isJournalOpen ? 'none' : 'auto',
              }}
            >
              {/* Header - Minimalist */}
              <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-50 flex items-center justify-between">
                <div className="flex items-center gap-3 bg-neural-surface/80 backdrop-blur-md px-4 py-2 rounded-full border border-neural-border shadow-lg pointer-events-auto">
                  <span className="text-xl">🧠</span>
                  <h1 className="text-sm font-bold text-gray-100 tracking-wide">WidgeTDC Canvas</h1>
                  <button className="text-xs text-gray-500 border-l border-neural-border pl-3 hover:text-gray-300">Se Cockpit-version</button>
                  <span className="text-[10px] font-black text-lime-300 border-l border-lime-500/30 pl-3 tracking-widest">
                    {DEBUG_BUILD_STAMP}
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest bg-neural-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neural-border">
                    Dobbeltklik for ny tanke
                  </span>
                  <span className="text-[10px] text-purple-400 font-medium uppercase tracking-widest bg-purple-500/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/20">
                    Træk fra prik = Orakel
                  </span>
                  <span className="text-[10px] text-gray-600 bg-neural-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neural-border">
                    Ctrl+K Commands
                  </span>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden relative mt-0">
                {/* Keeping the toolbars but they might be hidden/managed by their own state */}
                <ToolPalette />
                <Canvas />
                <NodeInspector />
                <AIPanel />
                <AutoLoader />
                <CanvasCollaboration />
                <SnoutObserver />
              </div>

              <StatusBar />
            </motion.div>

            <Journal isVisible={isJournalOpen} onFlip={() => setIsJournalOpen(false)} />
          </motion.div>

          {/* Master Flip Toggle */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100]">
            <div className="bg-neural-surface/90 backdrop-blur-xl p-1 rounded-full border border-neural-border shadow-2xl flex gap-1">
              <button
                onClick={() => setIsJournalOpen(false)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold tracking-widest uppercase transition-all duration-300 ${!isJournalOpen ? 'bg-tdc-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              >
                <Map size={14} />
                Lærred
              </button>
              <button
                onClick={() => setIsJournalOpen(true)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold tracking-widest uppercase transition-all duration-300 ${isJournalOpen ? 'bg-slate-900 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              >
                <BookOpen size={14} />
                Notesblok
              </button>
            </div>
          </div>

        </div>
      </ReactFlowProvider>
    </ToastProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  // Expose store for Stability Audit (Day 5)
  if (import.meta.env.DEV) {
    (window as any).useCanvasStore = useCanvasStore;
    (window as any).__WIDGETDC_CANVAS_BUILD__ = DEBUG_BUILD_STAMP;
    document.title = `WidgeTDC Canvas ${DEBUG_BUILD_STAMP}`;
  }

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
