import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';
import { BookOpen, Map } from 'lucide-react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { AIPanel } from './components/AIPanel';
import { ToolPalette } from './components/ToolPalette';
import { StatusBar } from './components/StatusBar';
import { NodeInspector } from './components/NodeInspector';
import { CommandPalette } from './components/CommandPalette';
import { Journal } from './components/Journal';
import { ToastProvider, useToast } from './components/Toast';
import { useCanvasStore } from './store/canvasStore';
import './index.css';

function hasPersistedCanvasState(): boolean {
  try {
    const raw = localStorage.getItem('widgetdc-canvas-storage');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { nodes?: unknown[]; edges?: unknown[] } };
    const nodes = parsed?.state?.nodes;
    const edges = parsed?.state?.edges;
    return (Array.isArray(nodes) && nodes.length > 0) || (Array.isArray(edges) && edges.length > 0);
  } catch {
    return false;
  }
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
        
        {/* 3D Perspective Container */}
        <div className="flex flex-col h-screen w-screen bg-[#050b14] overflow-hidden" style={{ perspective: '2000px' }}>
          
          {/* Flip Container */}
          <motion.div 
            className="flex-1 w-full h-full relative"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: isJournalOpen ? 180 : 0 }}
            transition={{ duration: 0.8, type: 'spring', bounce: 0.15 }}
          >
            {/* FRONT SIDE (Canvas) */}
            <div 
              className="absolute inset-0 flex flex-col bg-neural-bg"
              style={{ backfaceVisibility: 'hidden' }}
            >
              {/* Header - Minimalist */}
              <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-50 flex items-center justify-between">
                <div className="flex items-center gap-3 bg-neural-surface/80 backdrop-blur-md px-4 py-2 rounded-full border border-neural-border shadow-lg pointer-events-auto">
                  <span className="text-xl">🧠</span>
                  <h1 className="text-sm font-bold text-gray-100 tracking-wide">WidgeTDC Canvas</h1>
                  <button className="text-xs text-gray-500 border-l border-neural-border pl-3 hover:text-gray-300">Se Cockpit-version</button>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest bg-neural-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neural-border pointer-events-auto">
                    Dobbeltklik for ny tanke
                  </span>
                  <span className="text-[10px] text-purple-400 font-medium uppercase tracking-widest bg-purple-500/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/20 pointer-events-auto">
                    Træk fra prik = Orakel
                  </span>
                  <span className="text-[10px] text-gray-600 bg-neural-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neural-border pointer-events-auto">
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
              </div>

              <StatusBar />
            </div>

            {/* BACK SIDE (Journal) */}
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
  }

  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
