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
  const { nodes, edges, selectedNodeId, selectNode, expandNode, matchTenders, removeSelected, crossReference, exportAuditTrail, recommendNextActions, syncArtifactNode, applyArtifactAction } = useCanvasStore();
  const node = nodes.find(n => n.id === selectedNodeId);
  const [recommendations, setRecommendations] = useState<ActionRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [runningArtifactAction, setRunningArtifactAction] = useState<string | null>(null);

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

  const handleSyncArtifact = useCallback(async () => {
    if (!selectedNodeId) return;
    setRunningArtifactAction('sync');
    try {
      await syncArtifactNode(selectedNodeId);
    } finally {
      setRunningArtifactAction(null);
    }
  }, [selectedNodeId, syncArtifactNode]);

  const handleArtifactAction = useCallback(async (action: string) => {
    if (!selectedNodeId) return;
    setRunningArtifactAction(action);
    try {
      await applyArtifactAction(selectedNodeId, action);
    } finally {
      setRunningArtifactAction(null);
    }
  }, [applyArtifactAction, selectedNodeId]);

  if (!node) return null;

  const d = node.data as CanvasNodeData;
  const prov = d.provenance as ProvenanceData | undefined;
  const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id);
  const metadata = (d.metadata as Record<string, unknown> | undefined) ?? {};
  const thinkingSteps = d.thinkingSteps as string[] | undefined;
  const routingDecision = d.routingDecision as Record<string, unknown> | undefined;
  const workflowEnvelope = d.workflowEnvelope as Record<string, unknown> | undefined;
  const trustProfiles = d.trustProfiles as Array<Record<string, unknown>> | undefined;
  const governanceScorecard = d.governanceScorecard as Record<string, unknown> | undefined;
  const legoFactorySummary = d.legoFactorySummary as Record<string, unknown> | undefined;
  const memoryGovernance = d.memoryGovernance as Record<string, unknown> | undefined;
  const reviewBacklog = d.reviewBacklog as Record<string, unknown> | undefined;
  const reviewBacklogSummary = reviewBacklog?.queueSummary as Record<string, unknown> | undefined;
  const reviewBacklogItems = Array.isArray(reviewBacklog?.items) ? reviewBacklog.items as Array<Record<string, unknown>> : [];
  const coverageGaps = d.coverageGaps as Array<Record<string, unknown>> | undefined;
  const governedOutputs = d.governedOutputs as Array<Record<string, unknown>> | undefined;
  const verificationStatus = typeof metadata.verificationStatus === 'string' ? metadata.verificationStatus : undefined;
  const surfaceOrigin = typeof metadata.surfaceOrigin === 'string' ? metadata.surfaceOrigin : undefined;
  const routeToContract = typeof metadata.routeToContract === 'string' ? metadata.routeToContract : undefined;
  const confidence = typeof prov?.confidence === 'number' ? prov.confidence : undefined;
  const provenanceTool = typeof prov?.tool === 'string' ? prov.tool : undefined;

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

        {(d.artifactId || d.reviewState || d.renderPackageId || d.sourceGraphNodeId) && (
          <div className="bg-neural-panel/20 p-2.5 rounded-xl border border-neural-border/30">
            <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-2 opacity-70">Artifact Binding</div>
            <div className="space-y-1.5 text-[11px] text-gray-300">
              {d.artifactId && <div><span className="text-gray-500">Artifact</span>: <span className="font-mono text-gray-200">{d.artifactId}</span></div>}
              {d.artifactFamily && <div><span className="text-gray-500">Type</span>: {d.artifactFamily}</div>}
              {d.reviewState && <div><span className="text-gray-500">Review</span>: {d.reviewState}</div>}
              {d.qualityGate && <div><span className="text-gray-500">Quality</span>: {d.qualityGate}</div>}
              {d.renderPackageId && <div><span className="text-gray-500">Render</span>: <span className="font-mono text-gray-200">{d.renderPackageId}</span></div>}
              {d.renderContract && <div><span className="text-gray-500">Contract</span>: <span className="font-mono text-gray-200">{d.renderContract}</span></div>}
              {verificationStatus && <div><span className="text-gray-500">Verification</span>: {verificationStatus}</div>}
              {routeToContract && <div><span className="text-gray-500">Route</span>: <span className="font-mono text-gray-200">{routeToContract}</span></div>}
              {d.sourceGraphNodeId && <div><span className="text-gray-500">Graph</span>: <span className="font-mono text-gray-200">{d.sourceGraphNodeId}</span></div>}
              {Array.isArray(d.sourceGraphLabels) && d.sourceGraphLabels.length > 0 && (
                <div><span className="text-gray-500">Labels</span>: {d.sourceGraphLabels.join(', ')}</div>
              )}
              {Array.isArray(d.sourceAssetIds) && d.sourceAssetIds.length > 0 && (
                <div><span className="text-gray-500">Assets</span>: {d.sourceAssetIds.join(', ')}</div>
              )}
              {Array.isArray(d.availableActions) && d.availableActions.length > 0 && (
                <div><span className="text-gray-500">Actions</span>: {d.availableActions.join(', ')}</div>
              )}
            </div>
            {d.artifactId && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={handleSyncArtifact}
                  disabled={runningArtifactAction !== null}
                  className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-neural-panel border border-neural-border text-blue-300 hover:border-blue-500/30 disabled:opacity-50"
                >
                  {runningArtifactAction === 'sync' ? 'Syncing' : 'Sync'}
                </button>
                {Array.isArray(d.availableActions) && d.availableActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleArtifactAction(action)}
                    disabled={runningArtifactAction !== null}
                    className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-neural-panel border border-neural-border text-emerald-300 hover:border-emerald-500/30 disabled:opacity-50"
                  >
                    {runningArtifactAction === action ? 'Running' : action.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {(routingDecision || workflowEnvelope || (trustProfiles && trustProfiles.length > 0)) && (
          <div className="bg-neural-panel/20 p-2.5 rounded-xl border border-neural-border/30">
            <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-2 opacity-70">Routing Lineage</div>
            <div className="space-y-1.5 text-[11px] text-gray-300">
              {routingDecision && (
                <>
                  <div><span className="text-gray-500">Capability</span>: {String(routingDecision.selected_capability ?? d.routeCapability ?? 'n/a')}</div>
                  <div><span className="text-gray-500">Selected</span>: {String(routingDecision.selected_agent_id ?? d.routeSelectedAgent ?? 'n/a')}</div>
                  <div><span className="text-gray-500">Reason</span>: {String(routingDecision.reason_code ?? 'n/a')}</div>
                  {typeof routingDecision.trust_score === 'number' && (
                    <div><span className="text-gray-500">Trust</span>: {(Number(routingDecision.trust_score) * 100).toFixed(0)}%</div>
                  )}
                </>
              )}
              {workflowEnvelope && (
                <>
                  <div><span className="text-gray-500">Flow</span>: {String(workflowEnvelope.flow_ref ?? d.routeFlowRef ?? 'n/a')}</div>
                  <div><span className="text-gray-500">Phase</span>: {String(workflowEnvelope.current_phase ?? 'n/a')}</div>
                  <div><span className="text-gray-500">Surface</span>: {String(workflowEnvelope.primary_surface ?? 'n/a')}</div>
                </>
              )}
              {trustProfiles && trustProfiles.length > 0 && (
                <div className="pt-1">
                  <div className="text-gray-500 mb-1">Top trust</div>
                  <div className="space-y-1">
                    {trustProfiles.slice(0, 3).map((profile, index) => (
                      <div key={`${profile.agent_id ?? 'agent'}-${index}`} className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-gray-200">{String(profile.agent_id ?? 'unknown')}</span>
                        <span className="text-gray-500">{typeof profile.bayesian_score === 'number' ? `${(Number(profile.bayesian_score) * 100).toFixed(0)}%` : 'n/a'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(governanceScorecard || legoFactorySummary || memoryGovernance || reviewBacklog) && (
          <div className="bg-neural-panel/20 p-2.5 rounded-xl border border-neural-border/30">
            <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-2 opacity-70">Governance Eval</div>
            <div className="space-y-1.5 text-[11px] text-gray-300">
              {governanceScorecard && (
                <>
                  <div><span className="text-gray-500">Verified</span>: {String(governanceScorecard.verifiedDecisions ?? '0')}</div>
                  <div><span className="text-gray-500">Acceptance</span>: {typeof governanceScorecard.acceptanceRate === 'number' ? `${(Number(governanceScorecard.acceptanceRate) * 100).toFixed(0)}%` : 'n/a'}</div>
                  <div><span className="text-gray-500">Routed coverage</span>: {typeof governanceScorecard.routedDecisionCoverage === 'number' ? `${(Number(governanceScorecard.routedDecisionCoverage) * 100).toFixed(0)}%` : 'n/a'}</div>
                  <div><span className="text-gray-500">OODA runs</span>: {String(governanceScorecard.oodaRunEvents ?? '0')}</div>
                  <div><span className="text-gray-500">OODA fallback</span>: {typeof governanceScorecard.oodaFallbackRate === 'number' ? `${(Number(governanceScorecard.oodaFallbackRate) * 100).toFixed(0)}%` : 'n/a'}</div>
                  <div><span className="text-gray-500">OODA avg ms</span>: {String(governanceScorecard.oodaAverageDurationMs ?? 'n/a')}</div>
                </>
              )}
              {legoFactorySummary && (
                <>
                  <div className="pt-1 text-gray-500">LegoFactory</div>
                  <div><span className="text-gray-500">Blocked</span>: {String(legoFactorySummary.blocked ?? '0')}</div>
                  <div><span className="text-gray-500">Promotable</span>: {String(legoFactorySummary.promotable ?? '0')}</div>
                  <div><span className="text-gray-500">Waiting</span>: {String(legoFactorySummary.waiting ?? '0')}</div>
                  <div><span className="text-gray-500">Outputs</span>: {String(legoFactorySummary.outputCount ?? '0')}</div>
                </>
              )}
              {memoryGovernance && (
                <>
                  <div className="pt-1 text-gray-500">Memory</div>
                  <div><span className="text-gray-500">Coverage</span>: {typeof memoryGovernance.memoryConnectionCoverage === 'number' ? `${(Number(memoryGovernance.memoryConnectionCoverage) * 100).toFixed(1)}%` : 'n/a'}</div>
                  <div><span className="text-gray-500">Connections</span>: {String(memoryGovernance.memoryConnections ?? '0')}</div>
                  <div><span className="text-gray-500">Learning obs</span>: {String(memoryGovernance.learningObservations ?? '0')}</div>
                </>
              )}
              {/* Keep review backlog visible in the canonical governance eval node. */}
              {reviewBacklog && (
                <>
                  <div className="pt-1 text-gray-500">Review backlog</div>
                  <div><span className="text-gray-500">Status</span>: {String(reviewBacklogSummary?.status ?? 'n/a')}</div>
                  <div><span className="text-gray-500">Unreviewed</span>: {String(reviewBacklogSummary?.unreviewedCount ?? '0')}</div>
                  <div><span className="text-gray-500">Critical</span>: {String(reviewBacklogSummary?.criticalCount ?? '0')}</div>
                  <div><span className="text-gray-500">Oldest age</span>: {typeof reviewBacklogSummary?.oldestAgeMinutes === 'number' ? `${Number(reviewBacklogSummary.oldestAgeMinutes).toFixed(1)} min` : 'n/a'}</div>
                </>
              )}
              {coverageGaps && coverageGaps.length > 0 && (
                <div className="pt-1">
                  <div className="text-gray-500 mb-1">Coverage gaps</div>
                  <div className="space-y-1">
                    {coverageGaps.slice(0, 3).map((gap, index) => (
                      <div key={`${gap.metric ?? 'gap'}-${index}`} className="text-[10px] text-amber-200">
                        {String(gap.metric ?? 'gap')}: {String(gap.reason ?? 'missing reason')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {reviewBacklog && reviewBacklogItems.length > 0 && (
                <div className="pt-1">
                  <div className="text-gray-500 mb-1">Review queue</div>
                  <div className="space-y-1">
                    {reviewBacklogItems.slice(0, 3).map((item, index) => (
                      <div key={`${String(item.decisionId ?? 'review')}-${index}`} className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-gray-200 truncate">{String(item.decisionId ?? 'unknown')}</span>
                        <span className="text-gray-500">{typeof item.ageMinutes === 'number' ? `${Number(item.ageMinutes).toFixed(1)}m` : 'n/a'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {governedOutputs && governedOutputs.length > 0 && (
                <div className="pt-1">
                  <div className="text-gray-500 mb-1">Recent outputs</div>
                  <div className="space-y-1">
                    {governedOutputs.slice(0, 3).map((output, index) => (
                      <div key={`${output.id ?? 'output'}-${index}`} className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-gray-200">{String(output.kind ?? 'unknown')}</span>
                        <span className={Boolean(output.gate && typeof output.gate === 'object' && 'blocked' in output.gate && output.gate.blocked) ? 'text-amber-300' : 'text-emerald-300'}>
                          {String(output.status ?? 'n/a')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
            <div className="text-[8px] text-gray-600 uppercase font-bold mb-1 tracking-widest">Provenance</div>
            <div className="grid grid-cols-[auto,1fr] gap-x-2 gap-y-1 items-start">
              <span className="text-gray-600 uppercase tracking-tighter">Created</span>
              <span className="text-gray-400 font-medium">{PROVENANCE_LABELS[prov.createdBy] ?? prov.createdBy}</span>
              <span className="text-gray-600 uppercase tracking-tighter">Source</span>
              <span className="text-gray-500 truncate italic">{prov.source}</span>
              {provenanceTool && (
                <>
                  <span className="text-gray-600 uppercase tracking-tighter">Tool</span>
                  <span className="text-gray-300 font-mono break-all">{provenanceTool}</span>
                </>
              )}
              {surfaceOrigin && (
                <>
                  <span className="text-gray-600 uppercase tracking-tighter">Origin</span>
                  <span className="text-gray-300 break-all">{surfaceOrigin}</span>
                </>
              )}
              {confidence !== undefined && (
                <>
                  <span className="text-gray-600 uppercase tracking-tighter">Confidence</span>
                  <span className="text-gray-300">{(confidence * 100).toFixed(0)}%</span>
                </>
              )}
              <span className="text-gray-600 uppercase tracking-tighter">Timestamp</span>
              <span className="text-gray-500">{new Date(prov.createdAt).toLocaleString()}</span>
            </div>
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
