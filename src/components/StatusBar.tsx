import { useCanvasStore } from '../store/canvasStore';

export function StatusBar() {
  const { nodes, edges, canvasId, layoutMode, knowledgeExplorerMode, gapOverlayMode } = useCanvasStore();

  const typeCounts = nodes.reduce<Record<string, number>>((acc, n) => {
    const t = n.type ?? 'entity';
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, c]) => `${c} ${t}`)
    .join(', ');

  return (
    <div className="h-6 flex items-center px-3 gap-4 bg-neural-surface border-t border-neural-border text-[11px] text-gray-500 shrink-0">
      <span>{nodes.length} nodes</span>
      <span>{edges.length} edges</span>
      {topTypes && <span className="text-gray-600">{topTypes}</span>}
      <div className="flex-1" />
      {knowledgeExplorerMode && <span className="text-purple-400">EXPLORER</span>}
      {gapOverlayMode && <span className="text-amber-400">GAP OVERLAY</span>}
      <span className="uppercase">{layoutMode}</span>
      <span>canvas: {canvasId}</span>
      <div className="w-2 h-2 rounded-full bg-green-500" title="Backend connected" />
    </div>
  );
}
