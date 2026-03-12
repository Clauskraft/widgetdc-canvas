import { memo, useState } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import {
  Server, Bot, Wrench, Database, Lightbulb, FileSearch,
  GitBranch, Plug, Terminal, FileCode, Layers,
  ChevronDown, ChevronRight, Play, BrainCircuit, Shield,
} from 'lucide-react';

/**
 * 12 Node Types — 6 Layers reflecting Canvas 5X architecture
 *
 * INFRASTRUCTURE:  server | endpoint
 * CAPABILITY:      tool
 * ORCHESTRATION:   pipeline | agent
 * INTELLIGENCE:    entity | insight | evidence | artifact
 * REASONING:       thought
 * SANDBOX:         query
 * META:            combo
 */
export type CanvasNodeType =
  | 'server'    // Infrastructure: servers, bridges, gateways, databases
  | 'endpoint'  // Infrastructure: API endpoints, MCP routes
  | 'tool'      // Capability: MCP tools (329 across 56 namespaces)
  | 'pipeline'  // Orchestration: workflows, sequences, pipelines
  | 'agent'     // Orchestration: autonomous actors (8 agents)
  | 'entity'    // Intelligence: graph data nodes (Competitor, Domain, etc.)
  | 'insight'   // Intelligence: findings, analysis, recommendations
  | 'evidence'  // Intelligence: data artifacts, source material
  | 'artifact'  // Intelligence: rendered content (mermaid, charts, markdown)
  | 'thought'   // Reasoning: MLTM thinking chains, reasoning steps
  | 'query'     // Sandbox: executable Cypher/MCP queries
  | 'combo';    // Meta: collapsed group of nodes

export interface ProvenanceData {
  createdBy: 'manual' | 'query' | 'expand' | 'tool' | 'ai' | 'pipeline' | 'harvest';
  createdAt: string;
  source: string;
  confidence?: number;
  parentNodeId?: string;
  tool?: string;
  query?: string;
}

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  subtitle?: string;
  nodeType: CanvasNodeType;
  metadata?: Record<string, unknown>;
  provenance?: ProvenanceData;
  // Query node specifics
  queryText?: string;
  queryType?: 'cypher' | 'mcp';
  queryStatus?: 'idle' | 'running' | 'success' | 'error';
  queryResultCount?: number;
  // Artifact specifics
  artifactType?: 'mermaid' | 'markdown' | 'chart' | 'table' | 'html';
  artifactSource?: string;
  // Combo specifics
  childCount?: number;
  collapsed?: boolean;
  // Thought/Reasoning specifics
  thinkingSteps?: string[];
  reasoningStatus?: 'thinking' | 'complete' | 'error';
  // Regulatory badge
  regulatoryLevel?: 'strict' | 'guideline' | 'info';
  complianceScore?: number;
  // Ghost/rejected rendering
  isRejected?: boolean;
  rejectionReason?: string;
  // Signal intensity for aura glow
  signalIntensity?: number;
}

export type CanvasNode = Node<CanvasNodeData>;

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

function BaseNode({ data }: NodeProps<CanvasNode>) {
  const config = NODE_CONFIG[data.nodeType] ?? NODE_CONFIG.entity;
  const Icon = config.icon;
  const isGhost = /ghost/i.test(data.subtitle ?? '');
  const isRejected = data.isRejected === true;
  const provenance = data.provenance;
  const confidenceStyle = getConfidenceStyle(provenance?.confidence);
  const badge = provenance ? PROVENANCE_BADGES[provenance.createdBy] : null;
  const intensity = (data.signalIntensity as number) ?? 0;
  const hasAura = intensity > 0.8;
  const regLevel = data.regulatoryLevel as keyof typeof REGULATORY_COLORS | undefined;
  const compScore = data.complianceScore as number | undefined;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      {/* Aura glow ring for high-intensity signals */}
      {hasAura && (
        <div
          className="absolute -inset-2 rounded-xl animate-pulse pointer-events-none"
          style={{
            background: `radial-gradient(ellipse, ${config.color}40 0%, transparent 70%)`,
            boxShadow: `0 0 20px ${config.color}60`,
          }}
        />
      )}
      <div
        className={[
          'relative px-4 py-3 rounded-lg border bg-neural-surface shadow-lg min-w-[180px] max-w-[280px] cursor-grab active:cursor-grabbing',
          isGhost ? 'border-dashed border-neural-border' : 'border-neural-border',
          isRejected ? 'border-dashed' : '',
        ].join(' ')}
        style={{
          borderLeftWidth: 4,
          borderLeftColor: config.color,
          opacity: isRejected ? 0.3 : (isGhost ? 0.8 : undefined),
          ...confidenceStyle,
        }}
        title={isRejected ? `Rejected: ${data.rejectionReason ?? 'Quality gate failed'}` : undefined}
      >
        {isGhost && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg animate-pulse"
            style={{ backgroundColor: config.color }}
          />
        )}
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: config.color }} />
          <span className="text-sm font-semibold text-gray-100 truncate">
            {data.label}
          </span>
          {/* Regulatory badge */}
          {regLevel && (
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
        {data.subtitle && (
          <p className="text-xs text-gray-400 mt-1 truncate">{data.subtitle}</p>
        )}
        {/* Compliance score bar — values are 0.0-1.0, display as percentage */}
        {compScore !== undefined && (
          <div className="mt-1.5 h-1 rounded-full bg-neural-border overflow-hidden" title={`Compliance: ${(compScore * 100).toFixed(0)}%`}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${compScore * 100}%`,
                backgroundColor: compScore >= 0.8 ? '#22c55e' : compScore >= 0.5 ? '#eab308' : '#ef4444',
              }}
            />
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium"
            style={{ backgroundColor: config.color + '22', color: config.color }}
          >
            {data.nodeType}
          </span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">
            {config.layerLabel}
          </span>
          {badge && (
            <span
              className="text-[10px] ml-auto"
              title={`Source: ${provenance?.createdBy} (${provenance?.source ?? 'unknown'})`}
            >
              {badge.icon}
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-neural-border !w-2 !h-2" />
    </>
  );
}

function QueryNode({ data }: NodeProps<CanvasNode>) {
  const [expanded, setExpanded] = useState(true);
  const config = NODE_CONFIG.query;
  const status = data.queryStatus ?? 'idle';

  const statusColors: Record<string, string> = {
    idle: '#6b7280',
    running: '#eab308',
    success: '#22c55e',
    error: '#ef4444',
  };

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      <div
        className="relative px-4 py-3 rounded-lg border bg-neural-surface shadow-lg min-w-[220px] max-w-[320px] cursor-grab active:cursor-grabbing border-neural-border"
        style={{ borderLeftWidth: 4, borderLeftColor: config.color }}
      >
        <div className="flex items-center gap-2">
          <Terminal size={16} style={{ color: config.color }} />
          <span className="text-sm font-semibold text-gray-100 truncate flex-1">
            {data.label}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 rounded hover:bg-neural-border text-gray-400"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>

        {expanded && data.queryText && (
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
          {data.queryResultCount !== undefined && (
            <span className="text-[10px] text-gray-500 ml-auto">{data.queryResultCount} results</span>
          )}
          <Play size={12} className="ml-auto text-gray-500 hover:text-green-400 cursor-pointer" />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-neural-border !w-2 !h-2" />
    </>
  );
}

function ArtifactNode({ data }: NodeProps<CanvasNode>) {
  const config = NODE_CONFIG.artifact;
  const artType = data.artifactType ?? 'markdown';

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      <div
        className="relative px-4 py-3 rounded-lg border bg-neural-surface shadow-lg min-w-[200px] max-w-[400px] cursor-grab active:cursor-grabbing border-neural-border"
        style={{ borderLeftWidth: 4, borderLeftColor: config.color }}
      >
        <div className="flex items-center gap-2">
          <FileCode size={16} style={{ color: config.color }} />
          <span className="text-sm font-semibold text-gray-100 truncate">{data.label}</span>
        </div>
        {data.artifactSource && (
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
          {data.provenance && (
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

function ThoughtNode({ data }: NodeProps<CanvasNode>) {
  const [expanded, setExpanded] = useState(false);
  const config = NODE_CONFIG.thought;
  const steps = (data.thinkingSteps as string[]) ?? [];
  const status = (data.reasoningStatus as string) ?? 'complete';

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      <div
        className="relative px-4 py-3 rounded-lg border bg-neural-surface shadow-lg min-w-[200px] max-w-[320px] cursor-grab active:cursor-grabbing border-neural-border"
        style={{ borderLeftWidth: 4, borderLeftColor: config.color }}
      >
        <div className="flex items-center gap-2">
          <BrainCircuit size={16} style={{ color: config.color }} />
          <span className="text-sm font-semibold text-gray-100 truncate flex-1">
            {data.label}
          </span>
          {status === 'thinking' && (
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          )}
          {steps.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5 rounded hover:bg-neural-border text-gray-400"
            >
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>
        {data.subtitle && (
          <p className="text-xs text-gray-400 mt-1 truncate">{data.subtitle}</p>
        )}
        {/* Reasoning chain timeline */}
        {expanded && steps.length > 0 && (
          <div className="mt-2 border-l-2 border-purple-500/40 pl-3 space-y-1.5 max-h-[150px] overflow-y-auto">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                <span className="text-[11px] text-gray-300">{step}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium"
            style={{ backgroundColor: config.color + '22', color: config.color }}
          >
            {steps.length > 0 ? `${steps.length} steps` : 'thought'}
          </span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">REASONING</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-neural-border !w-2 !h-2" />
    </>
  );
}

function ComboNode({ data }: NodeProps<CanvasNode>) {
  const config = NODE_CONFIG.combo;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      <div
        className="relative px-4 py-3 rounded-lg border-2 border-dashed bg-neural-surface shadow-lg min-w-[160px] cursor-grab active:cursor-grabbing"
        style={{ borderColor: config.color }}
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

export const MemoizedNode = memo(BaseNode);
const MemoizedQueryNode = memo(QueryNode);
const MemoizedArtifactNode = memo(ArtifactNode);
const MemoizedThoughtNode = memo(ThoughtNode);
const MemoizedComboNode = memo(ComboNode);

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
