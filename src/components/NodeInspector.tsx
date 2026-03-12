import { useState, useCallback } from 'react';
import { X, GitBranch, Search, Trash2, BrainCircuit, Shield, Link2, FileCheck } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import type { ActionRecommendation } from '../store/canvasStore';
import type { CanvasNodeData, ProvenanceData } from './nodes';

const PROVENANCE_LABELS: Record<string, string> = {
  manual: 'Created manually',
  query: 'From graph query',
  expand: 'Graph expansion',
  tool: 'MCP tool result',
  ai: 'AI-generated',
  pipeline: 'Pipeline output',
  harvest: 'Harvested data',
  'tender-match': 'Tender match',
};

export function NodeInspector() {
  const { nodes, edges, selectedNodeId, selectNode, expandNode, matchTenders, removeSelected, crossReference, exportAuditTrail, recommendNextActions } = useCanvasStore();
  const node = nodes.find(n => n.id === selectedNodeId);
  const [recommendations, setRecommendations] = useState<ActionRecommendation[]>([]);

  const loadRecommendations = useCallback(() => {
    if (!selectedNodeId) { setRecommendations([]); return; }
    recommendNextActions(selectedNodeId).then(setRecommendations).catch(() => setRecommendations([]));
  }, [selectedNodeId, recommendNextActions]);

  if (!node) return null;

  const d = node.data as CanvasNodeData;
  const prov = d.provenance as ProvenanceData | undefined;
  const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
  const thinkingSteps = d.thinkingSteps as string[] | undefined;

  return (
    <div className="w-[280px] h-full border-l border-neural-border bg-neural-surface flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neural-border">
        <span className="text-sm font-semibold text-gray-100 truncate">{d.label}</span>
        <button onClick={() => selectNode(null)} className="p-1 rounded hover:bg-neural-border text-gray-400">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Type + Layer */}
        <div>
          <div className="text-[10px] text-gray-500 uppercase mb-1">Type</div>
          <span className="inline-block px-2 py-0.5 rounded text-xs bg-neural-panel text-gray-200">
            {d.nodeType} / {node.type}
          </span>
        </div>

        {d.subtitle && (
          <div>
            <div className="text-[10px] text-gray-500 uppercase mb-1">Subtitle</div>
            <div className="text-xs text-gray-300">{d.subtitle}</div>
          </div>
        )}

        {/* Visual Properties */}
        {(d.regulatoryLevel || d.complianceScore != null || d.signalIntensity != null) && (
          <div>
            <div className="text-[10px] text-gray-500 uppercase mb-1">Signals</div>
            <div className="space-y-1.5 text-xs">
              {d.regulatoryLevel && (
                <div className="flex items-center gap-1.5">
                  <Shield size={11} className="text-amber-400" />
                  <span className="text-gray-300">Regulatory: <strong className="text-gray-100">{d.regulatoryLevel}</strong></span>
                </div>
              )}
              {d.complianceScore != null && (
                <div>
                  <span className="text-gray-400">Compliance: {(Number(d.complianceScore) * 100).toFixed(0)}%</span>
                  <div className="mt-0.5 h-1.5 rounded-full bg-neural-border overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Number(d.complianceScore) * 100}%`,
                        backgroundColor: Number(d.complianceScore) >= 0.8 ? '#22c55e' : Number(d.complianceScore) >= 0.5 ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              )}
              {d.signalIntensity != null && (
                <span className="text-gray-400">Signal: {(Number(d.signalIntensity) * 100).toFixed(0)}%</span>
              )}
            </div>
          </div>
        )}

        {/* Provenance */}
        {prov && (
          <div>
            <div className="text-[10px] text-gray-500 uppercase mb-1">Provenance</div>
            <div className="space-y-1 text-xs text-gray-400">
              <div>{PROVENANCE_LABELS[prov.createdBy] ?? prov.createdBy}</div>
              <div>Source: <span className="text-gray-300">{prov.source}</span></div>
              {prov.tool && <div>Tool: <span className="text-gray-300">{prov.tool}</span></div>}
              {prov.confidence != null && <div>Confidence: {(prov.confidence * 100).toFixed(0)}%</div>}
              <div className="text-[10px] text-gray-600">{prov.createdAt}</div>
            </div>
          </div>
        )}

        {/* Thinking Steps */}
        {thinkingSteps && thinkingSteps.length > 0 && (
          <div>
            <div className="text-[10px] text-gray-500 uppercase mb-1 flex items-center gap-1">
              <BrainCircuit size={10} /> Reasoning ({thinkingSteps.length} steps)
            </div>
            <div className="border-l-2 border-purple-500/30 pl-2 space-y-1 max-h-[120px] overflow-y-auto">
              {thinkingSteps.map((step, i) => (
                <div key={i} className="text-[11px] text-gray-400">
                  <span className="text-purple-500">{i + 1}.</span> {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connections */}
        <div>
          <div className="text-[10px] text-gray-500 uppercase mb-1">Connections ({connectedEdges.length})</div>
          <div className="space-y-1 max-h-[100px] overflow-y-auto">
            {connectedEdges.slice(0, 15).map(e => {
              const otherId = e.source === node.id ? e.target : e.source;
              const other = nodes.find(n => n.id === otherId);
              const label = (e as { label?: string }).label;
              return (
                <div key={e.id} className="text-[11px] text-gray-400 truncate">
                  {label && <span className="text-gray-500">[{label}]</span>}{' '}
                  <button
                    onClick={() => selectNode(otherId)}
                    className="text-tdc-400 hover:text-tdc-300"
                  >
                    {String(other?.data?.label ?? otherId)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 ? (
          <div>
            <div className="text-[10px] text-gray-500 uppercase mb-1">Recommendations</div>
            <div className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <div key={i} className="px-2 py-1.5 rounded bg-neural-panel border border-neural-border/50 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-200 font-medium">{rec.label}</span>
                    <span className="text-[10px] text-tdc-400">{(rec.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{rec.reasoning}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={loadRecommendations}
            className="w-full text-[11px] text-tdc-400 hover:text-tdc-300 py-1"
          >
            Load recommendations...
          </button>
        )}

        {/* Rejected info */}
        {d.isRejected && (
          <div className="px-2 py-1.5 rounded bg-red-900/30 border border-red-800/50 text-xs text-red-300">
            Rejected: {d.rejectionReason ?? 'Quality gate failed'}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-neural-border space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => expandNode(node.id)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-neural-panel hover:bg-neural-border text-gray-200"
          >
            <GitBranch size={12} /> Expand
          </button>
          <button
            onClick={() => matchTenders(node.id)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-neural-panel hover:bg-neural-border text-amber-300"
          >
            <Search size={12} /> Tenders
          </button>
          <button
            onClick={removeSelected}
            className="px-2 py-1.5 rounded text-xs bg-red-900/30 hover:bg-red-900/50 text-red-400"
          >
            <Trash2 size={12} />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => crossReference(node.id)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-neural-panel hover:bg-neural-border text-blue-300"
          >
            <Link2 size={12} /> Cross-Ref
          </button>
          <button
            onClick={() => exportAuditTrail('json')}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-neural-panel hover:bg-neural-border text-green-300"
          >
            <FileCheck size={12} /> Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
}
