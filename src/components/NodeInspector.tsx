import { useState, useCallback } from 'react';
import { X, GitBranch, Search, Trash2, BrainCircuit, Shield, Link2, FileCheck, Sparkles, AlertCircle } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import type { ActionRecommendation } from '../store/canvasStore';
import type { CanvasNodeData, ProvenanceData } from '../types/canvas';

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
  const [loadingRecs, setLoadingRecs] = useState(false);

  const loadRecommendations = useCallback(async () => {
    if (!selectedNodeId) { setRecommendations([]); return; }
    setLoadingRecs(true);
    try {
      const recs = await recommendNextActions(selectedNodeId);
      setRecommendations(recs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRecs(false);
    }
  }, [selectedNodeId, recommendNextActions]);

  if (!node) return null;

  const d = node.data as CanvasNodeData;
  const prov = d.provenance as ProvenanceData | undefined;
  const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
  const thinkingSteps = d.thinkingSteps as string[] | undefined;

  return (
    <div className="w-[280px] h-full border-l border-neural-border bg-neural-surface flex flex-col overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neural-border bg-neural-bg/50">
        <span className="text-sm font-bold text-gray-100 truncate tracking-tight">{d.label}</span>
        <button onClick={() => selectNode(null)} className="p-1 rounded hover:bg-neural-border text-gray-400">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Type + Layer */}
        <div>
          <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1.5 opacity-70">Metadata</div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-neural-panel border border-neural-border text-gray-300">
              {d.nodeType.toUpperCase()}
            </span>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-300">
              LAYER {node.type?.toUpperCase()}
            </span>
          </div>
        </div>

        {d.subtitle && (
          <div>
            <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 opacity-70">Subtitle</div>
            <div className="text-xs text-gray-300 leading-relaxed italic">{d.subtitle}</div>
          </div>
        )}

        {/* Recommendations - AI Proactive */}
        <div>
          <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-2 opacity-70 flex items-center justify-between">
            <span>Oraklets Forslag</span>
            {loadingRecs && <Sparkles size={10} className="animate-spin text-purple-400" />}
          </div>
          
          {recommendations.length > 0 ? (
            <div className="space-y-2">
              {recommendations.map((rec: any, i) => (
                <div 
                  key={i} 
                  className={`relative px-3 py-2 rounded-xl border transition-all hover:bg-neural-panel/50 group
                    ${rec.proactive 
                      ? 'bg-amber-500/5 border-amber-500/30 shadow-lg shadow-amber-500/5' 
                      : 'bg-neural-panel/30 border-neural-border/50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {rec.proactive && <AlertCircle size={12} className="text-amber-400" />}
                      <span className={`text-[11px] font-bold ${rec.proactive ? 'text-amber-200' : 'text-gray-200'}`}>
                        {rec.label}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 group-hover:text-gray-300">
                      {(rec.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 leading-tight opacity-80">{rec.reasoning}</div>
                  
                  {rec.proactive && (
                    <div className="absolute -top-1.5 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-[8px] font-black text-black uppercase tracking-tighter shadow-sm">
                      Kritisk
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={loadRecommendations}
              disabled={loadingRecs}
              className="w-full group flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neural-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
            >
              <Sparkles size={14} className={`text-purple-400 ${loadingRecs ? 'animate-spin' : 'group-hover:scale-110'}`} />
              <span className="text-[11px] font-bold text-gray-400 group-hover:text-gray-200 uppercase tracking-widest">
                Spørg Oraklet...
              </span>
            </button>
          )}
        </div>

        {/* Visual Properties */}
        {(d.regulatoryLevel || d.complianceScore != null || d.signalIntensity != null) && (
          <div className="bg-neural-panel/20 p-2.5 rounded-xl border border-neural-border/30">
            <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-2 opacity-70">Signals</div>
            <div className="space-y-2 text-xs">
              {d.regulatoryLevel && (
                <div className="flex items-center gap-1.5">
                  <Shield size={11} className={d.regulatoryLevel === 'strict' ? 'text-amber-400' : 'text-blue-400'} />
                  <span className="text-gray-300 font-medium">Compliance: <span className="text-gray-100 uppercase">{d.regulatoryLevel}</span></span>
                </div>
              )}
              {d.complianceScore != null && (
                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-400 font-bold uppercase tracking-tighter">Confidence</span>
                    <span className="text-gray-200">{(Number(d.complianceScore) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-neural-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                      style={{
                        width: `${Number(d.complianceScore) * 100}%`,
                        backgroundColor: Number(d.complianceScore) >= 0.8 ? '#22c55e' : Number(d.complianceScore) >= 0.5 ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Thinking Steps */}
        {thinkingSteps && thinkingSteps.length > 0 && (
          <div className="bg-purple-500/5 p-2.5 rounded-xl border border-purple-500/10">
            <div className="text-[9px] text-purple-400 uppercase font-black tracking-widest mb-2 flex items-center gap-1.5">
              <BrainCircuit size={12} /> Reasoning Chain
            </div>
            <div className="space-y-2 pr-1 max-h-[150px] overflow-y-auto custom-scrollbar">
              {thinkingSteps.map((step, i) => (
                <div key={i} className="flex gap-2 text-[10px] text-gray-400 leading-relaxed border-l border-purple-500/20 pl-2">
                  <span className="text-purple-500/50 font-mono font-bold shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="opacity-90">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provenance */}
        {prov && (
          <div className="text-[10px] bg-neural-bg/30 p-2 rounded-lg border border-neural-border/20">
            <div className="text-[8px] text-gray-600 uppercase font-bold mb-1 tracking-widest">Origin</div>
            <div className="text-gray-400 font-medium">{PROVENANCE_LABELS[prov.createdBy] ?? prov.createdBy}</div>
            <div className="text-gray-500 mt-0.5 truncate italic">Source: {prov.source}</div>
            <div className="text-[8px] text-gray-600 mt-1 uppercase tracking-tighter">{new Date(prov.createdAt).toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-neural-border bg-neural-bg/50 grid grid-cols-2 gap-2">
        <button
          onClick={() => expandNode(node.id)}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-neural-panel border border-neural-border hover:bg-neural-border hover:border-purple-500/30 text-gray-200 transition-all"
        >
          <GitBranch size={12} /> Expand
        </button>
        <button
          onClick={() => matchTenders(node.id)}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-neural-panel border border-neural-border hover:bg-neural-border hover:border-amber-500/30 text-amber-300 transition-all"
        >
          <Search size={12} /> Tenders
        </button>
        <button
          onClick={() => crossReference(node.id)}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-neural-panel border border-neural-border hover:bg-neural-border hover:border-blue-500/30 text-blue-300 transition-all"
        >
          <Link2 size={12} /> Link
        </button>
        <button
          onClick={removeSelected}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-900/20 border border-red-900/30 hover:bg-red-900/40 text-red-400 transition-all"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}
