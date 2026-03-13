import { memo, useState } from 'react';
import { Handle, Position, NodeToolbar, useStore, type NodeProps, type Node } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Bot, Wrench, Database, Lightbulb, FileSearch, Search,
  GitBranch, Plug, Terminal, FileCode, Layers,
  ChevronDown, ChevronRight, Play, BrainCircuit, Shield, Sparkles, Link2, Activity
} from 'lucide-react';
import { useCanvasStore } from '../../store/canvasStore';
import type { CanvasNodeData, CanvasNodeType, CanvasNode } from '../../types/canvas';

// Strict comparison for memoization to fix O(N) re-render bottleneck (Audit Day 5)
const areNodePropsEqual = (prev: NodeProps<CanvasNode>, next: NodeProps<CanvasNode>) => {
  return (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data.label === next.data.label &&
    prev.data.reasoningStatus === next.data.reasoningStatus &&
    prev.data.hasProactiveRecommendation === next.data.hasProactiveRecommendation &&
    prev.data.thinkingSteps?.length === next.data.thinkingSteps?.length &&
    prev.data.complianceScore === next.data.complianceScore &&
    prev.data.signalIntensity === next.data.signalIntensity
  );
};

const NODE_CONFIG: Record<CanvasNodeType, { color: string; icon: typeof Server; layerLabel: string }> = {
  server:   { color: '#64748b', icon: Server,       layerLabel: 'INFRA' },
  endpoint: { color: '#14b8a6', icon: Plug,         layerLabel: 'INFRA' },
  tool:     { color: '#667eea', icon: Wrench,       layerLabel: 'CAPABILITY' },
  pipeline: { color: '#06b6d4', icon: GitBranch,    layerLabel: 'ORCHESTRATION' },
  agent:    { color: '#e20074', icon: Bot,          layerLabel: 'ORCHESTRATION' },
  entity:   { color: '#f4bb00', icon: Database,     layerLabel: 'INTELLIGENCE' },
  insight:  { color: '#22c55e', icon: Lightbulb,    layerLabel: 'INTELLIGENCE' },
  evidence: { color: '#f97316', icon: FileSearch,   layerLabel: 'INTELLIGENCE' },
  artifact: { color: '#ec4899', icon: FileCode,     layerLabel: 'INTELLIGENCE' },
  thought:  { color: '#8b5cf6', icon: BrainCircuit, layerLabel: 'REASONING' },
  query:    { color: '#a855f7', icon: Terminal,      layerLabel: 'SANDBOX' },
  combo:    { color: '#6b7280', icon: Layers,        layerLabel: 'META' },
};

const PROVENANCE_BADGES: Record<string, { icon: string; color: string }> = {
  query:    { icon: '\u{1F50D}', color: '#667eea' },  // magnifying glass
  ai:      { icon: '\u{1F916}', color: '#a855f7' },  // robot
  expand:  { icon: '\u{1F517}', color: '#14b8a6' },  // link
  tool:    { icon: '\u{1F6E0}', color: '#667eea' },  // wrench (hammer+wrench)
  manual:  { icon: '\u{270B}',  color: '#6b7280' },  // hand
  harvest: { icon: '\u{1F310}', color: '#f97316' },  // globe
  pipeline:{ icon: '\u{2699}',  color: '#06b6d4' },  // gear
};

function getConfidenceStyle(confidence?: number) {
  if (confidence === undefined) return {};
  if (confidence >= 0.9) return { opacity: 1 };
  if (confidence >= 0.7) return { opacity: 0.85 };
  if (confidence >= 0.4) return { opacity: 0.7, borderStyle: 'dashed' as const };
  return { opacity: 0.6, borderStyle: 'dashed' as const };
}

const REGULATORY_COLORS = {
  strict: { bg: '#f4bb0033', border: '#f4bb00', label: 'STRICT' },
  guideline: { bg: '#3b82f633', border: '#3b82f6', label: 'GUIDE' },
  info: { bg: '#6b728033', border: '#6b7280', label: 'INFO' },
} as const;

function FloatingToolbar({ id, nodeType, isVisible }: { id: string; nodeType: CanvasNodeType; isVisible: boolean }) {
  const { expandNode, autoAnalyze, crossReference, matchTenders, evaluateHypothesis, verifyNode, assessConsequences } = useCanvasStore();

  const getActions = () => {
    const actions = [];
    
    // Core expansion actions
    if (['entity', 'agent', 'thought'].includes(nodeType)) {
      actions.push({ id: 'expand', label: 'Expand', icon: GitBranch, color: 'text-sky-400', onClick: () => expandNode(id) });
    }

    // Empirical Validity Layer (New)
    actions.push({ id: 'verify', label: 'Verify', icon: Shield, color: 'text-emerald-400', onClick: () => verifyNode(id) });

    // Consequence Engine (New)
    actions.push({ id: 'consequences', label: 'Impact', icon: Activity, color: 'text-rose-500', onClick: () => assessConsequences(id) });

    // Intelligence actions
    actions.push({ id: 'analyze', label: 'Analyze', icon: Sparkles, color: 'text-purple-400', onClick: () => autoAnalyze(id) });

    if (['entity', 'agent'].includes(nodeType)) {
      actions.push({ id: 'tenders', label: 'Tenders', icon: Search, color: 'text-amber-400', onClick: () => matchTenders(id) });
    }

    if (['insight', 'evidence', 'artifact'].includes(nodeType)) {
      actions.push({ id: 'link', label: 'Link', icon: Link2, color: 'text-emerald-400', onClick: () => crossReference(id) });
    }

    if (nodeType === 'thought') {
      actions.push({ id: 'score', label: 'Hypothesis', icon: BrainCircuit, color: 'text-rose-400', onClick: () => evaluateHypothesis(id) });
    }

    return actions;
  };

  const actions = getActions();

  return (
    <NodeToolbar isVisible={isVisible} position={Position.Top} className="mb-3 z-[100]">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="flex items-center gap-0.5 p-1 bg-neural-surface/95 backdrop-blur-2xl border border-neural-border shadow-2xl rounded-2xl"
          >
            {actions.map((action, i) => (
              <div key={action.id} className="flex items-center">
                {i > 0 && <div className="w-px h-4 bg-neural-border/50 mx-0.5" />}
                <button
                  onClick={action.onClick}
                  className={`flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest ${action.color} hover:bg-white/5 rounded-xl transition-all active:scale-95`}
                  title={action.label}
                >
                  <action.icon size={14} />
                  <span className="hidden sm:inline">{action.label}</span>
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </NodeToolbar>
  );
}

function BaseNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { executeNodeCommand } = useCanvasStore();
  const zoom = useStore((s) => s.transform[2]);
  const isLowDetail = zoom < 0.6;

  const config = NODE_CONFIG[data.nodeType] ?? NODE_CONFIG.entity;
  const Icon = config.icon;
  const isGhost = /ghost/i.test(data.subtitle ?? '');
  const isRejected = data.isRejected === true;
  const status = (data.reasoningStatus as string) ?? 'complete';
  const provenance = data.provenance;
  const confidenceStyle = getConfidenceStyle(provenance?.confidence);
  const badge = provenance ? PROVENANCE_BADGES[provenance.createdBy] : null;
  const intensity = (data.signalIntensity as number) ?? 0;
  const hasAura = intensity > 0.8;
  const hasProactive = !!data.hasProactiveRecommendation;
  const regLevel = data.regulatoryLevel as keyof typeof REGULATORY_COLORS | undefined;
  const compScore = data.complianceScore as number | undefined;

  const auraColor = intensity > 0.8 ? '#ef4444' : (hasProactive ? '#fbbf24' : config.color);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = e.currentTarget.value.trim();
      if (val) {
        executeNodeCommand(id, val);
        if (val.startsWith('/') || val.includes('?')) {
          e.currentTarget.value = data.label; 
        }
      }
      e.currentTarget.blur();
    }
  };

  return (
    <>
      <FloatingToolbar id={id} nodeType={data.nodeType} isVisible={selected} />
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      
      {/* Aura optimized: Hide glow at low zoom unless selected */}
      {(hasAura || hasProactive || status === 'thinking') && (!isLowDetail || selected) && (
        <div
          className="absolute -inset-3 rounded-2xl animate-pulse pointer-events-none z-0"
          style={{
            background: `radial-gradient(ellipse, ${auraColor}25 0%, transparent 75%)`,
            boxShadow: `0 0 35px ${auraColor}${intensity > 0.9 ? '90' : '40'}`,
          }}
        />
      )}

      <div
        className={[
          'relative px-4 py-3 rounded-xl border bg-neural-surface shadow-lg min-w-[180px] max-w-[280px] cursor-grab active:cursor-grabbing transition-all duration-500',
          isGhost ? 'border-dashed border-neural-border' : 'border-neural-border',
          isRejected ? 'border-dashed' : '',
          selected ? 'ring-2 shadow-2xl ring-opacity-60 scale-[1.02]' : '',
          hasProactive ? 'border-amber-500/50' : ''
        ].join(' ')}
        style={{
          borderLeftWidth: 4,
          borderLeftColor: config.color,
          opacity: isRejected ? 0.3 : (isGhost ? 0.8 : undefined),
          ...(selected ? { ringColor: auraColor } : {}),
          ...confidenceStyle,
        }}
      >
        {hasProactive && (
          <div className="absolute -top-2 -right-2 bg-amber-500 rounded-full p-1 shadow-lg animate-bounce z-20">
            <Sparkles size={10} className="text-black" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: config.color }} />
          <input
            className="bg-transparent border-none outline-none font-bold text-gray-100 text-sm truncate flex-1"
            defaultValue={data.label}
            onKeyDown={handleKeyDown}
          />
          {!isLowDetail && status === 'thinking' && (
            <div className="flex gap-0.5">
              <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            </div>
          )}
          {/* Regulatory badge: Hide at low zoom */}
          {!isLowDetail && regLevel && (
            <span
              className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide"
              style={{
                backgroundColor: REGULATORY_COLORS[regLevel].bg,
                color: REGULATORY_COLORS[regLevel].border,
                border: `1px solid ${REGULATORY_COLORS[regLevel].border}`,
              }}
            >
              <Shield size={9} />
              {REGULATORY_COLORS[regLevel].label}
            </span>
          )}
        </div>

        {/* Details: Hide at low zoom */}
        {!isLowDetail && (
          <>
            {data.subtitle && (
              <p className="text-[11px] text-gray-400 mt-1 truncate opacity-70 leading-tight">{data.subtitle}</p>
            )}
            {compScore !== undefined && (
              <div className="mt-2 h-1 rounded-full bg-neural-border/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${compScore * 100}%`,
                    backgroundColor: compScore >= 0.8 ? '#22c55e' : compScore >= 0.5 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-neural-border/20">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter"
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            {data.nodeType}
          </span>
          <span className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">
            {config.layerLabel}
          </span>
          {!isLowDetail && badge && (
            <span className="text-[10px] ml-auto opacity-60 hover:opacity-100 transition-opacity cursor-help" title={`Source: ${provenance?.createdBy}`}>
              {badge.icon}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-neural-border !w-2 !h-2" />
    </>
  );
}

function QueryNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { executeNodeCommand } = useCanvasStore();
  const zoom = useStore((s) => s.transform[2]);
  const isLowDetail = zoom < 0.6;

  const [expanded, setExpanded] = useState(true);
  const config = NODE_CONFIG.query;
  const status = data.queryStatus ?? 'idle';
  const reasoningStatus = (data.reasoningStatus as string) ?? 'complete';

  const statusColors: Record<string, string> = {
    idle: '#6b7280',
    running: '#eab308',
    success: '#22c55e',
    error: '#ef4444',
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = e.currentTarget.value.trim();
      if (val) executeNodeCommand(id, val);
      e.currentTarget.blur();
    }
  };

  return (
    <>
      <FloatingToolbar id={id} nodeType={data.nodeType} isVisible={selected} />
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      <div
        className="relative px-4 py-3 rounded-lg border bg-neural-surface shadow-lg min-w-[220px] max-w-[320px] cursor-grab active:cursor-grabbing border-neural-border transition-shadow"
        style={{ 
          borderLeftWidth: 4, 
          borderLeftColor: config.color,
          ...(selected ? { boxShadow: `0 0 0 2px ${config.color}40` } : {})
        }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={16} style={{ color: config.color }} />
          <input
            className="bg-transparent border-none outline-none font-semibold text-gray-100 text-sm truncate flex-1"
            defaultValue={data.label}
            onKeyDown={handleKeyDown}
          />
          {!isLowDetail && reasoningStatus === 'thinking' && (
            <Sparkles size={12} className="text-purple-400 animate-pulse shrink-0" />
          )}
          {!isLowDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5 rounded hover:bg-neural-border text-gray-400"
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>

        {!isLowDetail && expanded && data.queryText && (
          <pre className="mt-2 px-2 py-1.5 rounded bg-neural-panel text-[11px] text-gray-300 font-mono overflow-x-auto max-h-[80px] overflow-y-auto whitespace-pre-wrap">
            {data.queryText}
          </pre>
        )}

        <div className="flex items-center gap-1.5 mt-2">
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium"
            style={{ backgroundColor: config.color + '22', color: config.color }}
          >
            {data.queryType ?? 'cypher'}
          </span>
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: statusColors[status] }}
            title={status}
          />
          {status === 'running' && (
            <div className="w-2 h-2 rounded-full animate-ping absolute" style={{ backgroundColor: '#eab308' }} />
          )}
          {!isLowDetail && data.queryResultCount !== undefined && (
            <span className="text-[10px] text-gray-500 ml-auto">{data.queryResultCount} results</span>
          )}
          <Play size={12} className="ml-auto text-gray-500 hover:text-green-400 cursor-pointer" />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-neural-border !w-2 !h-2" />
    </>
  );
}

function ArtifactNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { executeNodeCommand } = useCanvasStore();
  const zoom = useStore((s) => s.transform[2]);
  const isLowDetail = zoom < 0.6;

  const config = NODE_CONFIG.artifact;
  const artType = data.artifactType ?? 'markdown';
  const reasoningStatus = (data.reasoningStatus as string) ?? 'complete';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = e.currentTarget.value.trim();
      if (val) executeNodeCommand(id, val);
      e.currentTarget.blur();
    }
  };

  return (
    <>
      <FloatingToolbar id={id} nodeType={data.nodeType} isVisible={selected} />
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      <div
        className="relative px-4 py-3 rounded-lg border bg-neural-surface shadow-lg min-w-[200px] max-w-[400px] cursor-grab active:cursor-grabbing border-neural-border transition-shadow"
        style={{ 
          borderLeftWidth: 4, 
          borderLeftColor: config.color,
          ...(selected ? { boxShadow: `0 0 0 2px ${config.color}40` } : {})
        }}
      >
        <div className="flex items-center gap-2">
          <FileCode size={16} style={{ color: config.color }} />
          <input
            className="bg-transparent border-none outline-none font-semibold text-gray-100 text-sm truncate flex-1"
            defaultValue={data.label}
            onKeyDown={handleKeyDown}
          />
          {!isLowDetail && reasoningStatus === 'thinking' && (
            <Sparkles size={12} className="text-purple-400 animate-pulse shrink-0" />
          )}
        </div>
        {!isLowDetail && data.artifactSource && (
          <div className="mt-2 rounded bg-neural-panel p-2 max-h-[120px] overflow-auto">
            <pre className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap">
              {data.artifactSource.slice(0, 500)}
              {data.artifactSource.length > 500 ? '\n...' : ''}
            </pre>
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium"
            style={{ backgroundColor: config.color + '22', color: config.color }}
          >
            {artType}
          </span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">ARTIFACT</span>
          {!isLowDetail && data.provenance && (
            <span className="text-[10px] ml-auto" title={`Source: ${data.provenance.createdBy}`}>
              {PROVENANCE_BADGES[data.provenance.createdBy]?.icon ?? ''}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-neural-border !w-2 !h-2" />
    </>
  );
}

function ThoughtNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { executeNodeCommand } = useCanvasStore();
  const zoom = useStore((s) => s.transform[2]);
  const isLowDetail = zoom < 0.6;

  const config = NODE_CONFIG.thought;
  const steps = (data.thinkingSteps as string[]) ?? [];
  const status = (data.reasoningStatus as string) ?? 'complete';
  const label = (data?.label as string) || '';
  const content = (data?.subtitle as string) || '';
  const isNew = !!data?.isNew;
  const intensity = (data.signalIntensity as number) ?? 0;
  const hasAura = intensity > 0.8;
  const hasProactive = !!data.hasProactiveRecommendation;

  const auraColor = intensity > 0.8 ? '#ef4444' : (hasProactive ? '#fbbf24' : config.color);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = e.currentTarget.value.trim();
      if (val) {
        executeNodeCommand(id, val);
        if (val.startsWith('/') || val.includes('?')) {
          e.currentTarget.value = data.label; 
        }
      }
      e.currentTarget.blur();
    }
  };

  return (
    <>
      <FloatingToolbar id={id} nodeType={data.nodeType} isVisible={selected} />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
        className={`relative px-6 py-4 rounded-2xl shadow-lg border backdrop-blur-md transition-all duration-500
          ${selected 
            ? 'bg-neural-surface/90 border-purple-500 ring-4 ring-purple-500/10 shadow-purple-500/20 scale-[1.02]' 
            : 'bg-neural-surface/80 border-neural-border hover:border-purple-300/50'
          }
          ${hasProactive ? 'border-amber-500/50' : ''}
        `}
        style={{ minWidth: 240 }}
      >
        {/* Aura optimized: Hide glow at low zoom unless selected */}
        {(hasAura || hasProactive || status === 'thinking') && (!isLowDetail || selected) && (
          <div 
            className="absolute -inset-4 rounded-3xl animate-pulse pointer-events-none -z-10"
            style={{
              background: `radial-gradient(ellipse, ${auraColor}20 0%, transparent 75%)`,
              boxShadow: `0 0 40px ${auraColor}${intensity > 0.9 ? '80' : '30'}`,
            }}
          />
        )}

        {/* Orakel Prik (Handle) - Kun synlig når markeret */}
        {selected && (
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10"
          >
            <Handle
              type="source"
              position={Position.Right}
              className="w-6 h-6 rounded-full bg-purple-500 border-[3px] border-neural-surface shadow-xl shadow-purple-500/40 cursor-crosshair hover:scale-125 transition-transform flex items-center justify-center"
              isConnectable={true}
            >
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </Handle>
          </motion.div>
        )}

        {/* Target handle - usynlig men nødvendig for forbindelser */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-0 h-0 opacity-0 pointer-events-none"
          isConnectable={true}
        />

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit size={14} style={{ color: config.color }} />
            <span className="text-[9px] text-gray-500 uppercase tracking-wider font-black">
              {steps.length > 0 ? `${steps.length} steps` : 'Reasoning'}
            </span>
            {!isLowDetail && status === 'thinking' && (
              <div className="flex gap-1 ml-auto">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            {hasProactive && !selected && (
              <Sparkles size={12} className="text-amber-400 animate-pulse ml-auto" />
            )}
          </div>
          <input
            autoFocus={isNew}
            className="bg-transparent border-none outline-none font-bold text-gray-100 text-lg placeholder-gray-600 w-full"
            placeholder="Hvad tænker du?"
            defaultValue={label}
            onKeyDown={handleKeyDown}
          />
          {!isLowDetail && content && (
            <p className="text-sm text-gray-400 font-medium leading-relaxed mt-1 opacity-80 whitespace-pre-wrap italic border-l-2 border-neural-border/30 pl-3">
              {content}
            </p>
          )}
          
          {/* Reasoning chain: Hide at low zoom */}
          {!isLowDetail && steps.length > 0 && (
            <div className="mt-3 border-l-2 border-purple-500/40 pl-3 space-y-1.5 max-h-[100px] overflow-y-auto pr-2 custom-scrollbar">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <span className="text-[11px] text-gray-300 opacity-80">{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

function ComboNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const config = NODE_CONFIG.combo;

  return (
    <>
      <FloatingToolbar id={id} nodeType={data.nodeType} isVisible={selected} />
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      <div
        className="relative px-4 py-3 rounded-lg border-2 border-dashed bg-neural-surface shadow-lg min-w-[160px] cursor-grab active:cursor-grabbing transition-shadow"
        style={{ 
          borderColor: config.color,
          ...(selected ? { boxShadow: `0 0 0 2px ${config.color}40` } : {})
        }}
      >
        <div className="flex items-center gap-2">
          <Layers size={16} style={{ color: config.color }} />
          <span className="text-sm font-semibold text-gray-100 truncate">{data.label}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium"
            style={{ backgroundColor: config.color + '22', color: config.color }}
          >
            {data.childCount ?? 0} nodes
          </span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">GROUP</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-neural-border !w-2 !h-2" />
    </>
  );
}

// Strict Memoization with comparison logic
export const MemoizedNode = memo(BaseNode, areNodePropsEqual);
const MemoizedQueryNode = memo(QueryNode, areNodePropsEqual);
const MemoizedArtifactNode = memo(ArtifactNode, areNodePropsEqual);
const MemoizedThoughtNode = memo(ThoughtNode, areNodePropsEqual);
const MemoizedComboNode = memo(ComboNode, areNodePropsEqual);

export const nodeTypes = {
  server: MemoizedNode,
  endpoint: MemoizedNode,
  tool: MemoizedNode,
  pipeline: MemoizedNode,
  agent: MemoizedNode,
  entity: MemoizedNode,
  insight: MemoizedNode,
  evidence: MemoizedNode,
  artifact: MemoizedArtifactNode,
  thought: MemoizedThoughtNode,
  query: MemoizedQueryNode,
  combo: MemoizedComboNode,
};
