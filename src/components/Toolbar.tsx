import { useState } from 'react';
import {
  Plus,
  Save,
  Download,
  Upload,
  Trash2,
  LayoutGrid,
  GitBranch,
  Sparkles,
  ZoomIn,
  ArrowDownUp,
  ArrowLeftRight,
  Server,
  Plug,
  Wrench,
  Bot,
  Database,
  Lightbulb,
  FileSearch,
  FlaskConical,
  Undo2,
  Redo2,
  Layers,
  Terminal,
  FileCode,
  PanelLeftOpen,
  BrainCircuit,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { useCanvasStore } from '../store/canvasStore';
import { mcpCall } from '../lib/api';
import type { CanvasNodeType } from '../types/canvas';

const NODE_OPTIONS: { type: CanvasNodeType; label: string; icon: typeof Server; group: string }[] = [
  // Infrastructure
  { type: 'server',   label: 'Server / Gateway',  icon: Server,     group: 'INFRA' },
  { type: 'endpoint', label: 'API Endpoint',       icon: Plug,       group: 'INFRA' },
  // Capability
  { type: 'tool',     label: 'MCP Tool',           icon: Wrench,     group: 'CAPABILITY' },
  // Orchestration
  { type: 'pipeline', label: 'Pipeline / Workflow', icon: GitBranch,  group: 'ORCHESTRATION' },
  { type: 'agent',    label: 'Agent',               icon: Bot,        group: 'ORCHESTRATION' },
  // Intelligence
  { type: 'entity',   label: 'Entity (Graph)',      icon: Database,     group: 'INTELLIGENCE' },
  { type: 'insight',  label: 'Insight / Finding',   icon: Lightbulb,    group: 'INTELLIGENCE' },
  { type: 'evidence', label: 'Evidence / Artifact', icon: FileSearch,   group: 'INTELLIGENCE' },
  // Reasoning
  { type: 'thought',  label: 'Thought / Reasoning', icon: BrainCircuit, group: 'REASONING' },
  // Sandbox + Meta
  { type: 'query',    label: 'Query Node',          icon: Terminal,     group: 'SANDBOX' },
  { type: 'artifact', label: 'Artifact',            icon: FileCode,     group: 'SANDBOX' },
  { type: 'combo',    label: 'Combo Group',         icon: Layers,       group: 'META' },
];

export function Toolbar() {
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const { fitView } = useReactFlow();
  const {
    addNode, removeSelected, layoutMode, setLayoutMode,
    applyLayout, alignLayout, toggleAiPanel, toggleToolPalette, toggleKnowledgeExplorer, toggleGapOverlay,
    saveToGraph, loadFromGraph,
    clearCanvas, isLoading, selectedNodeId,
    undo, redo, undoStack, redoStack,
    groupSelected, knowledgeExplorerMode, gapOverlayMode,
    generateBriefing,
  } = useCanvasStore();

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const results: string[] = [];
    try {
      // Test 1: Backend health
      const health = await mcpCall<{ success: boolean }>('graph.health', {});
      results.push(health?.success ? '+ Graph: OK' : 'x Graph: FAILED');
    } catch { results.push('x Graph: unreachable'); }
    try {
      // Test 2: Ghost metrics
      const metrics = await mcpCall<{ success: boolean; total_ghosts?: number; entropy?: number; fulfillment_rate?: number }>('aura.ghost_metrics', { window_hours: 72 });
      if (metrics?.success) {
        results.push(`+ Ghosts: ${metrics.total_ghosts} (entropy ${metrics.entropy}, fill ${metrics.fulfillment_rate})`);
      } else { results.push('x Ghosts: metrics failed'); }
    } catch { results.push('- Ghosts: not available'); }
    try {
      // Test 3: Graph stats
      const stats = await mcpCall<{ success: boolean; result?: { nodeCount?: number; edgeCount?: number } }>('graph.stats', {});
      if (stats?.success) {
        results.push(`+ Neo4j: ${stats.result?.nodeCount ?? '?'} nodes, ${stats.result?.edgeCount ?? '?'} edges`);
      } else { results.push('x Neo4j: stats failed'); }
    } catch { results.push('x Neo4j: unreachable'); }
    setTestResult(results.join('\n'));
    setTesting(false);
  };

  const handleAddNode = (type: CanvasNodeType, label: string) => {
    addNode(type, label);
    setShowAdd(false);
  };

  const handleExport = async (format: 'png' | 'svg') => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) return;
    try {
      const fn = format === 'png' ? toPng : toSvg;
      const dataUrl = await fn(viewport, { backgroundColor: '#050b14' });
      const link = document.createElement('a');
      link.download = `widgetdc-canvas.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
    setShowExport(false);
  };

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-neural-surface border-b border-neural-border">
      {/* Add Node */}
      <div className="relative">
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-neural-panel hover:bg-neural-border text-gray-200 transition-colors"
        >
          <Plus size={14} /> Add Node
        </button>
        {showAdd && (
          <div className="absolute top-full left-0 mt-1 bg-neural-panel border border-neural-border rounded-lg shadow-xl z-50 min-w-[200px]">
            {NODE_OPTIONS.map(({ type, label, icon: Icon, group }, idx) => {
              const prevGroup = idx > 0 ? NODE_OPTIONS[idx - 1].group : '';
              const showDivider = group !== prevGroup;
              return (
                <div key={type}>
                  {showDivider && (
                    <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider border-t border-neural-border first:border-t-0">
                      {group}
                    </div>
                  )}
                  <button
                    onClick={() => handleAddNode(type, `New ${label}`)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-200 hover:bg-neural-border transition-colors"
                  >
                    <Icon size={14} /> {label}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-neural-border mx-1" />

      {/* Layout Mode */}
      <button
        onClick={() => setLayoutMode(layoutMode === 'mindmap' ? 'freeform' : 'mindmap')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          layoutMode === 'mindmap'
            ? 'bg-tdc-500 text-white'
            : 'bg-neural-panel hover:bg-neural-border text-gray-200'
        }`}
        title={layoutMode === 'mindmap' ? 'Switch to Freeform' : 'Switch to Mindmap'}
      >
        {layoutMode === 'mindmap' ? <GitBranch size={14} /> : <LayoutGrid size={14} />}
        {layoutMode === 'mindmap' ? 'Mindmap' : 'Freeform'}
      </button>

      {/* Layout Direction */}
      <button
        onClick={() => applyLayout('TB')}
        className="p-1.5 rounded-md bg-neural-panel hover:bg-neural-border text-gray-300 transition-colors"
        title="Layout Top-Bottom"
      >
        <ArrowDownUp size={14} />
      </button>
      <button
        onClick={() => applyLayout('LR')}
        className="p-1.5 rounded-md bg-neural-panel hover:bg-neural-border text-gray-300 transition-colors"
        title="Layout Left-Right"
      >
        <ArrowLeftRight size={14} />
      </button>
      <button
        onClick={alignLayout}
        className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-neural-panel hover:bg-neural-border text-amber-400 font-bold text-[10px] uppercase tracking-tighter transition-all border border-amber-500/20"
        title="Align Strategy Columns"
      >
        <LayoutGrid size={14} /> Align
      </button>

      <div className="w-px h-6 bg-neural-border mx-1" />

      {/* Undo/Redo */}
      <button
        onClick={undo}
        disabled={undoStack.length === 0}
        className="p-1.5 rounded-md bg-neural-panel hover:bg-neural-border text-gray-300 transition-colors disabled:opacity-30"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={14} />
      </button>
      <button
        onClick={redo}
        disabled={redoStack.length === 0}
        className="p-1.5 rounded-md bg-neural-panel hover:bg-neural-border text-gray-300 transition-colors disabled:opacity-30"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={14} />
      </button>

      <div className="w-px h-6 bg-neural-border mx-1" />

      {/* Actions */}
      <button
        onClick={() => fitView({ padding: 0.2, duration: 300 })}
        className="p-1.5 rounded-md bg-neural-panel hover:bg-neural-border text-gray-300 transition-colors"
        title="Zoom to Fit"
      >
        <ZoomIn size={14} />
      </button>

      {selectedNodeId && (
        <>
          <button
            onClick={removeSelected}
            className="p-1.5 rounded-md bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors"
            title="Delete Selected"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={groupSelected}
            className="p-1.5 rounded-md bg-neural-panel hover:bg-neural-border text-gray-300 transition-colors"
            title="Group connected nodes"
          >
            <Layers size={14} />
          </button>
        </>
      )}

      <button
        onClick={clearCanvas}
        className="p-1.5 rounded-md bg-neural-panel hover:bg-neural-border text-gray-300 transition-colors"
        title="Clear Canvas"
      >
        <Trash2 size={14} />
      </button>

      <div className="w-px h-6 bg-neural-border mx-1" />

      {/* Persistence */}
      <button
        onClick={() => saveToGraph()}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-neural-panel hover:bg-neural-border text-gray-200 transition-colors disabled:opacity-50"
        title="Save to Neo4j"
      >
        <Save size={14} /> {isLoading ? 'Saving...' : 'Save'}
      </button>
      <button
        onClick={() => loadFromGraph()}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-neural-panel hover:bg-neural-border text-gray-200 transition-colors disabled:opacity-50"
        title="Load from Neo4j"
      >
        <Upload size={14} /> Load
      </button>

      {/* Export */}
      <div className="relative">
        <button
          onClick={() => setShowExport(!showExport)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-neural-panel hover:bg-neural-border text-gray-200 transition-colors"
        >
          <Download size={14} /> Export
        </button>
        {showExport && (
          <div className="absolute top-full left-0 mt-1 bg-neural-panel border border-neural-border rounded-lg shadow-xl z-50">
            <button onClick={() => handleExport('png')} className="block w-full px-4 py-2 text-sm text-gray-200 hover:bg-neural-border rounded-t-lg">PNG</button>
            <button onClick={() => handleExport('svg')} className="block w-full px-4 py-2 text-sm text-gray-200 hover:bg-neural-border rounded-b-lg">SVG</button>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-neural-border mx-1" />

      {/* System Test */}
      <div className="relative">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-neural-panel hover:bg-neural-border text-gray-200 transition-colors disabled:opacity-50"
          title="Run system health check"
        >
          <FlaskConical size={14} /> {testing ? 'Testing...' : 'Test'}
        </button>
        {testResult && (
          <div className="absolute top-full right-0 mt-1 bg-neural-panel border border-neural-border rounded-lg shadow-xl z-50 p-3 min-w-[280px]">
            <div className="text-xs font-mono text-gray-300 whitespace-pre">{testResult}</div>
            <button
              onClick={() => setTestResult(null)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-300"
            >
              dismiss
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Neural Briefing (NotebookLM) */}
      <button
        onClick={generateBriefing}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-neural-panel hover:bg-neural-border text-purple-400 transition-colors border border-purple-500/20 disabled:opacity-50"
        title="Neural Briefing — Generate Audio Overview in NotebookLM"
      >
        <BrainCircuit size={14} /> Briefing
      </button>

      {/* Knowledge Explorer Toggle */}
      <button
        onClick={toggleKnowledgeExplorer}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          knowledgeExplorerMode
            ? 'bg-purple-600 text-white'
            : 'bg-neural-panel hover:bg-neural-border text-gray-200'
        }`}
        title="Knowledge Explorer — show only thoughts, insights, evidence"
      >
        <BookOpen size={14} /> {knowledgeExplorerMode ? 'Explorer ON' : 'Explorer'}
      </button>

      <button
        onClick={() => void toggleGapOverlay()}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          gapOverlayMode
            ? 'bg-amber-500 text-black'
            : 'bg-neural-panel hover:bg-neural-border text-gray-200'
        }`}
        title="Gap Overlay — show compliance gaps from RLM"
      >
        <AlertTriangle size={14} /> {gapOverlayMode ? 'Gaps ON' : 'Gaps'}
      </button>

      {/* Tool Palette Toggle */}
      <button
        onClick={toggleToolPalette}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-neural-panel hover:bg-neural-border text-gray-200 transition-colors"
        title="MCP Tool Palette"
      >
        <PanelLeftOpen size={14} /> Tools
      </button>

      {/* AI Panel Toggle */}
      <button
        onClick={toggleAiPanel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-tdc-500 hover:bg-tdc-600 text-white transition-colors"
      >
        <Sparkles size={14} /> AI Panel
      </button>
    </div>
  );
}
