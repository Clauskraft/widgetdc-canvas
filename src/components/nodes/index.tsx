import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import {
  Server,
  Bot,
  Wrench,
  Database,
  Lightbulb,
  FileSearch,
  GitBranch,
  Plug,
} from 'lucide-react';

/**
 * 8 Node Types — 4 Layers reflecting the actual WidgeTDC architecture
 *
 * INFRASTRUCTURE:  server (gateways, bridges, DBs) | endpoint (API routes)
 * CAPABILITY:      tool (329 MCP tools)
 * ORCHESTRATION:   pipeline (workflows, sequences) | agent (8 autonomous actors)
 * INTELLIGENCE:    entity (graph data) | insight (findings) | evidence (artifacts)
 */
export type CanvasNodeType =
  | 'server'    // Infrastructure: servers, bridges, gateways, databases
  | 'endpoint'  // Infrastructure: API endpoints, MCP routes
  | 'tool'      // Capability: MCP tools (329 across 56 namespaces)
  | 'pipeline'  // Orchestration: workflows, sequences, pipelines
  | 'agent'     // Orchestration: autonomous actors (8 agents)
  | 'entity'    // Intelligence: graph data nodes (Competitor, Domain, etc.)
  | 'insight'   // Intelligence: findings, analysis, recommendations
  | 'evidence'; // Intelligence: data artifacts, source material

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  subtitle?: string;
  nodeType: CanvasNodeType;
  metadata?: Record<string, unknown>;
}

export type CanvasNode = Node<CanvasNodeData>;

const NODE_CONFIG: Record<CanvasNodeType, { color: string; icon: typeof Server; layerLabel: string }> = {
  // Infrastructure
  server:   { color: '#64748b', icon: Server,     layerLabel: 'INFRA' },
  endpoint: { color: '#14b8a6', icon: Plug,       layerLabel: 'INFRA' },
  // Capability
  tool:     { color: '#667eea', icon: Wrench,     layerLabel: 'CAPABILITY' },
  // Orchestration
  pipeline: { color: '#06b6d4', icon: GitBranch,  layerLabel: 'ORCHESTRATION' },
  agent:    { color: '#e20074', icon: Bot,         layerLabel: 'ORCHESTRATION' },
  // Intelligence
  entity:   { color: '#f4bb00', icon: Database,    layerLabel: 'INTELLIGENCE' },
  insight:  { color: '#22c55e', icon: Lightbulb,   layerLabel: 'INTELLIGENCE' },
  evidence: { color: '#f97316', icon: FileSearch,  layerLabel: 'INTELLIGENCE' },
};

function BaseNode({ data }: NodeProps<CanvasNode>) {
  const config = NODE_CONFIG[data.nodeType] ?? NODE_CONFIG.entity;
  const Icon = config.icon;
  const isGhost = /ghost/i.test(data.subtitle ?? '');

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-neural-border !w-2 !h-2" />
      <div
        className={[
          'relative px-4 py-3 rounded-lg border bg-neural-surface shadow-lg min-w-[180px] max-w-[280px] cursor-grab active:cursor-grabbing',
          isGhost ? 'border-dashed border-neural-border opacity-80' : 'border-neural-border',
        ].join(' ')}
        style={{ borderLeftWidth: 4, borderLeftColor: config.color }}
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
        </div>
        {data.subtitle && (
          <p className="text-xs text-gray-400 mt-1 truncate">{data.subtitle}</p>
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
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-neural-border !w-2 !h-2" />
    </>
  );
}

export const MemoizedNode = memo(BaseNode);

export const nodeTypes = {
  server: MemoizedNode,
  endpoint: MemoizedNode,
  tool: MemoizedNode,
  pipeline: MemoizedNode,
  agent: MemoizedNode,
  entity: MemoizedNode,
  insight: MemoizedNode,
  evidence: MemoizedNode,
};
