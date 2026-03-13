import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { AIPanel } from './components/AIPanel';
import { ToolPalette } from './components/ToolPalette';
import { StatusBar } from './components/StatusBar';
import { NodeInspector } from './components/NodeInspector';
import { CommandPalette } from './components/CommandPalette';
import { ToastProvider, useToast } from './components/Toast';
import { useCanvasStore } from './store/canvasStore';
import { generateShowcaseView } from './testcases/showcase-view';
import './index.css';

function AutoLoader() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
  return (
    <ToastProvider>
      <ReactFlowProvider>
        <ToastBridge />
        <CommandPalette />
        <div className="flex flex-col h-screen w-screen bg-neural-bg overflow-hidden">
          {/* Header - Minimalist */}
          <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-50 flex items-center justify-between">
            <div className="flex items-center gap-3 bg-neural-surface/80 backdrop-blur-md px-4 py-2 rounded-full border border-neural-border shadow-lg pointer-events-auto">
              <span className="text-xl">🧠</span>
              <h1 className="text-sm font-bold text-gray-100 tracking-wide">WidgeTDC Canvas</h1>
              <span className="text-xs text-gray-500 border-l border-neural-border pl-3">Vision Edition</span>
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
