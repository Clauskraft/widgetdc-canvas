import { useState, useEffect, useCallback, useMemo, useRef, type ComponentType } from 'react';
import { Search, GitBranch, Terminal, Wrench, Bot, Database, Lightbulb, FileSearch, BrainCircuit, Layers, Sparkles, Save, Upload, Trash2, LayoutGrid, BookOpen, Link2, FileCheck, Clock3, SplitSquareVertical } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { useCanvasSession } from '../state/canvasSession';
import type { PaneId } from '../types/session';
import type { CanvasNodeInputType } from '../types/canvas';

interface PaletteItem {
  id: string;
  label: string;
  description: string;
  category: 'action' | 'node' | 'view' | 'ai';
  icon: ComponentType<{ size?: number; className?: string }>;
  action: () => void;
}

interface CommandPaletteProps {
  mode?: 'legacy' | 'uc5';
}

export function CommandPalette({ mode = 'legacy' }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const store = useCanvasStore();
  const switchPane = useCanvasSession((s) => s.switchPane);
  const refreshInnovationBacklog = useCanvasSession((s) => s.refreshInnovationBacklog);
  const fetchPatternPalette = useCanvasSession((s) => s.fetchPatternPalette);

  // Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const uc5Items = useMemo<PaletteItem[]>(() => {
    const openPane = (pane: PaneId) => () => switchPane(pane);
    return [
      { id: 'uc5-research', label: 'research', description: 'Open graph-native research pane', category: 'view', icon: Search, action: openPane('research') },
      { id: 'uc5-pattern-palette', label: 'pattern palette', description: 'Browse ingested patterns and extraction pressure', category: 'view', icon: BookOpen, action: openPane('pattern_palette') },
      { id: 'uc5-evidence', label: 'evidence inspector', description: 'Inspect live lineage around the current bomrun', category: 'view', icon: FileSearch, action: openPane('evidence') },
      { id: 'uc5-timeline', label: 'timeline', description: 'Scan recent bomruns by fitness and rejection', category: 'view', icon: Clock3, action: openPane('timeline') },
      { id: 'uc5-diff', label: 'diff view', description: 'Compare two recent runs side by side', category: 'view', icon: SplitSquareVertical, action: openPane('diff') },
      { id: 'uc5-telemetry', label: 'telemetry', description: 'Open graph telemetry and arbitration pane', category: 'view', icon: ActivityIcon, action: openPane('telemetry') },
      { id: 'uc5-innovation', label: 'innovation backlog', description: 'Open innovation backlog triage pane', category: 'view', icon: Lightbulb, action: openPane('innovation_backlog') },
      { id: 'uc5-architecture', label: 'architecture canvas', description: 'Return to canvas architecture pane', category: 'view', icon: LayoutGrid, action: openPane('canvas') },
      { id: 'uc5-patterns', label: 'refresh patterns', description: 'Refresh the current pattern palette from graph', category: 'action', icon: BookOpen, action: () => { void fetchPatternPalette(); } },
      { id: 'uc5-backlog-refresh', label: 'refresh backlog', description: 'Refresh innovation tickets from backend', category: 'action', icon: RefreshIcon, action: () => { void refreshInnovationBacklog(); } },
      { id: 'uc5-slides', label: 'slides pane', description: 'Switch to slide flow pane', category: 'view', icon: LayoutGrid, action: openPane('slides') },
      { id: 'uc5-markdown', label: 'text pane', description: 'Switch to markdown/text output pane', category: 'view', icon: FileCheck, action: openPane('markdown') },
    ];
  }, [fetchPatternPalette, refreshInnovationBacklog, switchPane]);

  const legacyItems: PaletteItem[] = [
    // Views
    { id: 'open-canvas', label: 'Open Canvas Surface', description: 'Switch to the main canvas shell', category: 'view', icon: Search, action: () => store.setActiveSurface('canvas') },
    { id: 'open-knowledge', label: 'Open Knowledge Surface', description: 'Expose the knowledge-focused canvas shell', category: 'view', icon: BookOpen, action: () => store.setActiveSurface('knowledge') },
    { id: 'open-journal', label: 'Open Journal Surface', description: 'Switch to the notes surface', category: 'view', icon: BookOpen, action: () => store.setActiveSurface('journal') },
    // Actions
    { id: 'save', label: 'Save to Neo4j', description: 'Persist canvas state', category: 'action', icon: Save, action: () => store.saveToGraph() },
    { id: 'load', label: 'Load from Neo4j', description: 'Restore saved canvas', category: 'action', icon: Upload, action: () => store.loadFromGraph() },
    { id: 'clear', label: 'Clear Canvas', description: 'Remove all nodes', category: 'action', icon: Trash2, action: () => store.clearCanvas() },
    { id: 'layout-tb', label: 'Layout Top-Bottom', description: 'Auto-arrange vertically', category: 'action', icon: LayoutGrid, action: () => store.applyLayout('TB') },
    { id: 'layout-lr', label: 'Layout Left-Right', description: 'Auto-arrange horizontally', category: 'action', icon: LayoutGrid, action: () => store.applyLayout('LR') },
    { id: 'toggle-ai', label: 'Toggle AI Panel', description: 'Open/close assistant', category: 'action', icon: Sparkles, action: () => store.toggleAiPanel() },
    { id: 'toggle-tools', label: 'Toggle Tool Palette', description: 'Show MCP tools', category: 'action', icon: Wrench, action: () => store.toggleToolPalette() },
    { id: 'toggle-explorer', label: 'Toggle Knowledge Surface', description: 'Switch between canvas and knowledge surfaces', category: 'action', icon: BookOpen, action: () => store.toggleKnowledgeExplorer() },
    { id: 'gap-overlay', label: 'Compliance Gap Overlay', description: 'Show compliance gaps from RLM', category: 'action', icon: Lightbulb, action: () => store.toggleGapOverlay() },
    { id: 'undo', label: 'Undo', description: 'Ctrl+Z', category: 'action', icon: Layers, action: () => store.undo() },
    { id: 'redo', label: 'Redo', description: 'Ctrl+Y', category: 'action', icon: Layers, action: () => store.redo() },
    // Add nodes
    ...(['CodeImplementation', 'MCPTool', 'Tool', 'Track', 'Agent', 'Entity', 'Insight', 'Evidence', 'Claim', 'query', 'Artifact', 'combo'] as CanvasNodeInputType[]).map(type => ({
      id: `add-${type}`,
      label: `Add ${type} node`,
      description: `Create new ${type}`,
      category: 'node' as const,
      icon: type === 'Agent' ? Bot : type === 'Tool' ? Wrench : type === 'Claim' ? BrainCircuit : type === 'Entity' ? Database : type === 'Insight' ? Lightbulb : type === 'Evidence' ? FileSearch : type === 'Track' ? GitBranch : type === 'query' ? Terminal : Database,
      action: () => store.addNode(type, `New ${type}`),
    })),
    // AI commands
    { id: 'auto-analyze', label: 'Auto-Analyze Selected', description: 'Run full analysis pipeline on selected node', category: 'ai', icon: Sparkles, action: () => { if (store.selectedNodeId) store.autoAnalyze(store.selectedNodeId); } },
    { id: 'narrative', label: 'Generate Narrative Report', description: 'Create structured report from canvas', category: 'ai', icon: BrainCircuit, action: () => store.generateNarrative() },
    { id: 'patterns', label: 'Discover Patterns', description: 'Find cross-engagement patterns', category: 'ai', icon: Search, action: () => store.discoverPatterns() },
    { id: 'eval-hypothesis', label: 'Evaluate Hypothesis', description: 'Score selected thought node against evidence', category: 'ai', icon: BrainCircuit, action: () => { if (store.selectedNodeId) store.evaluateHypothesis(store.selectedNodeId); } },
    { id: 'cross-reference', label: 'Cross-Reference Selected', description: 'Find cross-references for the selected node', category: 'ai', icon: Link2, action: () => { if (store.selectedNodeId) store.crossReference(store.selectedNodeId); } },
    { id: 'run-pipeline', label: 'Run Analysis Pipeline', description: 'Run full analysis pipeline on an entity', category: 'ai', icon: Sparkles, action: () => { if (store.selectedNodeId) { const node = store.nodes.find(n => n.id === store.selectedNodeId); if (node) store.runAnalysisPipeline(String(node.data.label)); } } },
    { id: 'export-audit-json', label: 'Export Audit Trail JSON', description: 'Export full provenance audit trail as JSON', category: 'action', icon: FileCheck, action: () => { store.exportAuditTrail('json'); } },
    { id: 'export-audit-md', label: 'Export Audit Trail Markdown', description: 'Export full provenance audit trail as Markdown', category: 'action', icon: FileCheck, action: () => { store.exportAuditTrail('markdown'); } },
  ];

  const items: PaletteItem[] = mode === 'uc5' ? uc5Items : legacyItems;

  const filtered = query
    ? items.filter(i =>
        i.label.toLowerCase().includes(query.toLowerCase()) ||
        i.description.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  const handleSelect = useCallback((item: PaletteItem) => {
    setOpen(false);
    item.action();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  if (!open) return null;

  if (mode === 'uc5') {
    return (
      <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[12vh]" onClick={() => setOpen(false)}>
        <div className="absolute inset-0 bg-black/70" />
        <div
          className="relative w-[640px] overflow-hidden border"
          style={{ background: '#0c0c0c', borderColor: '#333333' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderBottom: '1px solid #333333' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '12px', color: '#7a7a7a' }}>⌘K</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="find · research · telemetry · patterns"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#e6e6e6',
                fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
                fontSize: '13px',
              }}
            />
            <span style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a' }}>Esc</span>
          </div>
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {filtered.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: '1px solid #333333',
                  background: index === selectedIndex ? '#1e1e1e' : 'transparent',
                  color: '#e6e6e6',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
                }}
              >
                <div style={{ fontSize: '11px', color: '#7db4ff', marginBottom: '4px' }}>[{item.category}]</div>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '11px', color: '#7a7a7a' }}>{item.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categories = ['action', 'ai', 'node', 'view'] as const;
  const categoryLabels = { action: 'Actions', ai: 'AI Intelligence', node: 'Add Node', view: 'Views' };

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-[520px] bg-neural-panel border border-neural-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neural-border">
          <Search size={18} className="text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, nodes, AI actions..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-neural-border text-[10px] text-gray-500">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">No results</div>
          )}
          {categories.map(cat => {
            const catItems = filtered.filter(i => i.category === cat);
            if (!catItems.length) return null;
            return (
              <div key={cat}>
                <div className="px-4 py-1.5 text-[10px] text-gray-600 uppercase tracking-wider">
                  {categoryLabels[cat]}
                </div>
                {catItems.map((item, idx) => {
                  const globalIdx = filtered.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`flex items-center gap-3 w-full px-4 py-2 text-left transition-colors ${
                        globalIdx === selectedIndex ? 'bg-tdc-500/20 text-tdc-200' : 'text-gray-300 hover:bg-neural-border/50'
                      }`}
                    >
                      <Icon size={14} className="text-gray-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{item.label}</div>
                        <div className="text-[11px] text-gray-500 truncate">{item.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActivityIcon(props: { size?: number; className?: string }) {
  return <Sparkles {...props} />;
}

function RefreshIcon(props: { size?: number; className?: string }) {
  return <Layers {...props} />;
}
