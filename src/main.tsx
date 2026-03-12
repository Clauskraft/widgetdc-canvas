import { StrictMode, useEffect, useState } from 'react';
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
        const { nodes, edges } = await generateShowcaseView();
        if (cancelled) return;
        useCanvasStore.setState({ nodes, edges, aiPanelOpen: true });
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-neural-bg/80 z-50 pointer-events-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-tdc-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading CI Pipeline Showcase...</span>
        </div>
      </div>
    );
  }

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
        <div className="flex flex-col h-screen w-screen bg-neural-bg">
          {/* Header */}
          <div className="flex items-center px-4 py-2 bg-neural-surface border-b border-neural-border">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <h1 className="text-sm font-bold text-gray-100 tracking-wide">WidgeTDC Canvas</h1>
            </div>
            <span className="ml-3 text-xs text-gray-500">Competitive Intelligence Explorer</span>
            <span className="ml-auto text-[10px] text-gray-600">Ctrl+K Command Palette</span>
          </div>

          {/* Toolbar */}
          <Toolbar />

          {/* Main area */}
          <div className="flex flex-1 overflow-hidden relative">
            <ToolPalette />
            <Canvas />
            <NodeInspector />
            <AIPanel />
            <AutoLoader />
          </div>

          {/* Status Bar */}
          <StatusBar />
        </div>
      </ReactFlowProvider>
    </ToastProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
