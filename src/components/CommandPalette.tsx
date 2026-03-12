import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, GitBranch, Terminal, Wrench, Bot, Database, Lightbulb, FileSearch, BrainCircuit, Layers, Sparkles, Save, Upload, Trash2, LayoutGrid, BookOpen, Link2, FileCheck } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import type { CanvasNodeType } from './nodes';

interface PaletteItem {
  id: string;
  label: string;
  description: string;
  category: 'action' | 'node' | 'view' | 'ai';
  icon: typeof Search;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const store = useCanvasStore();

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

  const items: PaletteItem[] = [
    // Actions
    { id: 'save', label: 'Save to Neo4j', description: 'Persist canvas state', category: 'action', icon: Save, action: () => store.saveToGraph() },
    { id: 'load', label: 'Load from Neo4j', description: 'Restore saved canvas', category: 'action', icon: Upload, action: () => store.loadFromGraph() },
    { id: 'clear', label: 'Clear Canvas', description: 'Remove all nodes', category: 'action', icon: Trash2, action: () => store.clearCanvas() },
    { id: 'layout-tb', label: 'Layout Top-Bottom', description: 'Auto-arrange vertically', category: 'action', icon: LayoutGrid, action: () => store.applyLayout('TB') },
    { id: 'layout-lr', label: 'Layout Left-Right', description: 'Auto-arrange horizontally', category: 'action', icon: LayoutGrid, action: () => store.applyLayout('LR') },
    { id: 'toggle-ai', label: 'Toggle AI Panel', description: 'Open/close assistant', category: 'action', icon: Sparkles, action: () => store.toggleAiPanel() },
    { id: 'toggle-tools', label: 'Toggle Tool Palette', description: 'Show MCP tools', category: 'action', icon: Wrench, action: () => store.toggleToolPalette() },
    { id: 'toggle-explorer', label: 'Knowledge Explorer', description: 'Filter to thoughts/insights/evidence', category: 'action', icon: BookOpen, action: () => store.toggleKnowledgeExplorer() },
    { id: 'gap-overlay', label: 'Compliance Gap Overlay', description: 'Show compliance gaps from RLM', category: 'action', icon: Lightbulb, action: () => store.toggleGapOverlay() },
    { id: 'undo', label: 'Undo', description: 'Ctrl+Z', category: 'action', icon: Layers, action: () => store.undo() },
    { id: 'redo', label: 'Redo', description: 'Ctrl+Y', category: 'action', icon: Layers, action: () => store.redo() },
    // Add nodes
    ...(['server', 'endpoint', 'tool', 'pipeline', 'agent', 'entity', 'insight', 'evidence', 'thought', 'query', 'artifact', 'combo'] as CanvasNodeType[]).map(type => ({
      id: `add-${type}`,
      label: `Add ${type} node`,
      description: `Create new ${type}`,
      category: 'node' as const,
      icon: type === 'agent' ? Bot : type === 'tool' ? Wrench : type === 'thought' ? BrainCircuit : type === 'entity' ? Database : type === 'insight' ? Lightbulb : type === 'evidence' ? FileSearch : type === 'pipeline' ? GitBranch : type === 'query' ? Terminal : Database,
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
