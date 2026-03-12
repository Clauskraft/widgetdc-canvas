import { useState, useEffect, useMemo } from 'react';
import { X, Search, Wrench, GripVertical } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { listMcpTools, type ToolDefinition } from '../lib/api';

export function ToolPalette() {
  const { toolPaletteOpen, toggleToolPalette } = useCanvasStore();
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!toolPaletteOpen || tools.length > 0) return;
    setLoading(true);
    listMcpTools()
      .then(setTools)
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, [toolPaletteOpen, tools.length]);

  const grouped = useMemo(() => {
    const filtered = search
      ? tools.filter(t =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.description ?? '').toLowerCase().includes(search.toLowerCase())
        )
      : tools;

    const groups: Record<string, ToolDefinition[]> = {};
    for (const tool of filtered) {
      const ns = tool.name.split('.')[0] ?? 'other';
      (groups[ns] ??= []).push(tool);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tools, search]);

  if (!toolPaletteOpen) return null;

  const onDragStart = (e: React.DragEvent, tool: ToolDefinition) => {
    e.dataTransfer.setData('application/canvas-node-type', 'tool');
    e.dataTransfer.setData('application/canvas-tool-name', tool.name);
    e.dataTransfer.setData('application/canvas-tool-group', tool.name.split('.')[0] ?? '');
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-[260px] h-full border-r border-neural-border bg-neural-surface flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neural-border">
        <div className="flex items-center gap-1.5">
          <Wrench size={14} className="text-indigo-400" />
          <span className="text-sm font-semibold text-gray-100">MCP Tools</span>
          <span className="text-[10px] text-gray-500">({tools.length})</span>
        </div>
        <button onClick={toggleToolPalette} className="p-1 rounded hover:bg-neural-border text-gray-400">
          <X size={14} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-neural-border">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-neural-panel border border-neural-border">
          <Search size={12} className="text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Tool List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
            Loading tools...
          </div>
        )}

        {!loading && grouped.length === 0 && (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
            {search ? 'No matches' : 'No tools available'}
          </div>
        )}

        {grouped.map(([ns, nsTools]) => (
          <div key={ns}>
            <button
              onClick={() => setExpandedGroup(expandedGroup === ns ? null : ns)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] uppercase tracking-wider text-gray-500 hover:bg-neural-border/50 border-b border-neural-border/50"
            >
              <span>{ns}</span>
              <span className="text-[10px] text-gray-600">{nsTools.length}</span>
            </button>

            {(expandedGroup === ns || search) && nsTools.map((tool) => (
              <div
                key={tool.name}
                draggable
                onDragStart={(e) => onDragStart(e, tool)}
                className="flex items-start gap-2 px-3 py-1.5 hover:bg-neural-border/30 cursor-grab active:cursor-grabbing border-b border-neural-border/20 group"
              >
                <GripVertical size={12} className="text-gray-600 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-200 truncate">{tool.name}</div>
                  {tool.description && (
                    <div className="text-[10px] text-gray-500 truncate mt-0.5">{tool.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-neural-border text-[10px] text-gray-600 text-center">
        Drag tools onto canvas to create nodes
      </div>
    </div>
  );
}
