import { type Node } from '@xyflow/react';
import type { NodeLabel, RelationshipType } from './graph';
import type { CanvasModeId as SessionCanvasModeId } from './session';

export type CanvasNodeType = Extract<
  NodeLabel,
  | 'Agent'
  | 'Artifact'
  | 'Claim'
  | 'CodeImplementation'
  | 'ComplianceGap'
  | 'Decision'
  | 'Entity'
  | 'Evidence'
  | 'GuardrailRule'
  | 'Insight'
  | 'KnowledgePattern'
  | 'MCPTool'
  | 'Memory'
  | 'StrategicInsight'
  | 'StrategicLeverage'
  | 'Tool'
  | 'Track'
> | 'combo' | 'query';

export type LegacyCanvasNodeType =
  | 'agent'
  | 'answer-block'
  | 'artifact'
  | 'control-pack'
  | 'endpoint'
  | 'entity'
  | 'evidence'
  | 'insight'
  | 'migration-path'
  | 'pattern'
  | 'pipeline'
  | 'replacement-candidate'
  | 'server'
  | 'thought'
  | 'tool';

export type CanvasNodeInputType = CanvasNodeType | LegacyCanvasNodeType;

export const LEGACY_NODE_TYPE_MAP: Record<LegacyCanvasNodeType, CanvasNodeType> = {
  agent: 'Agent',
  'answer-block': 'StrategicLeverage',
  artifact: 'Artifact',
  'control-pack': 'GuardrailRule',
  endpoint: 'MCPTool',
  entity: 'Entity',
  evidence: 'Evidence',
  insight: 'Insight',
  'migration-path': 'Track',
  pattern: 'KnowledgePattern',
  pipeline: 'Track',
  'replacement-candidate': 'Decision',
  server: 'CodeImplementation',
  thought: 'Claim',
  tool: 'Tool',
};

export function normalizeCanvasNodeType(value: CanvasNodeInputType): CanvasNodeType {
  return value in LEGACY_NODE_TYPE_MAP
    ? LEGACY_NODE_TYPE_MAP[value as LegacyCanvasNodeType]
    : value as CanvasNodeType;
}

export const FOUNDRY_BLOCK_TYPES: CanvasNodeType[] = [
  'StrategicLeverage',
  'KnowledgePattern',
  'GuardrailRule',
  'Track',
  'Decision',
];

export type CanvasNodeFamilyId =
  | 'knowledge'
  | 'evidence'
  | 'artifact'
  | 'foundry'
  | 'reasoning'
  | 'capability'
  | 'orchestration'
  | 'memory'
  | 'query'
  | 'meta';

export type CanvasNodeModeId =
  | SessionCanvasModeId
  | 'card'
  | 'outline'
  | 'canvas_block'
  | 'stepper'
  | 'checklist'
  | 'code';

interface CanvasNodeModeDefinition {
  label: string;
  description: string;
  shellMode?: SessionCanvasModeId;
}

interface CanvasNodeFamilyDefinition {
  label: string;
  description: string;
  defaultMode: CanvasNodeModeId;
  allowedModes: CanvasNodeModeId[];
}

export const CANVAS_NODE_MODE_REGISTRY: Record<CanvasNodeModeId, CanvasNodeModeDefinition> = {
  card: { label: 'Card', description: 'Compact card view for scanning and grouping.' },
  outline: { label: 'Outline', description: 'Structured outline or hierarchical list view.' },
  canvas_block: { label: 'Canvas Block', description: 'Block-style node optimized for composition on the canvas.' },
  stepper: { label: 'Stepper', description: 'Sequenced steps for reasoning or staged execution.' },
  checklist: { label: 'Checklist', description: 'Task/checklist view for constraints, gates, or remediation.' },
  code: { label: 'Code', description: 'Code-like or command-centric detail surface.' },
  document: { label: 'Document', description: 'Long-form document or prose surface.', shellMode: 'document' },
  slides: { label: 'Slides', description: 'Slide-oriented presentation surface.', shellMode: 'slides' },
  diagram: { label: 'Diagram', description: 'Diagrammatic canvas or structured visual surface.', shellMode: 'diagram' },
  graph: { label: 'Graph', description: 'Graph-native relationship view.', shellMode: 'graph' },
  split: { label: 'Split', description: 'Split-pane composite working surface.', shellMode: 'split' },
  inspector: { label: 'Inspector', description: 'Detailed property and lineage inspector.', shellMode: 'inspector' },
  timeline: { label: 'Timeline', description: 'Chronological event or evolution view.', shellMode: 'timeline' },
  risk_overlay: { label: 'Risk Overlay', description: 'Risk/governance overlay view.', shellMode: 'risk_overlay' },
  diff: { label: 'Diff', description: 'Change comparison and delta inspection.', shellMode: 'diff' },
};

export const CANVAS_NODE_FAMILY_REGISTRY: Record<CanvasNodeFamilyId, CanvasNodeFamilyDefinition> = {
  knowledge: {
    label: 'Knowledge',
    description: 'Canonical ideas, entities, insights, and reusable knowledge units.',
    defaultMode: 'card',
    allowedModes: ['card', 'inspector', 'graph', 'outline'],
  },
  evidence: {
    label: 'Evidence',
    description: 'Grounding material and source-backed findings.',
    defaultMode: 'inspector',
    allowedModes: ['inspector', 'document', 'graph', 'card'],
  },
  artifact: {
    label: 'Artifact',
    description: 'Materialized outputs and deliverables.',
    defaultMode: 'document',
    allowedModes: ['document', 'diff', 'slides', 'diagram', 'inspector'],
  },
  foundry: {
    label: 'Foundry',
    description: 'Composable building blocks for governed product and strategy construction.',
    defaultMode: 'canvas_block',
    allowedModes: ['canvas_block', 'inspector', 'graph', 'outline', 'checklist'],
  },
  reasoning: {
    label: 'Reasoning',
    description: 'Hypotheses, chains of thought, and sequenced analytical work.',
    defaultMode: 'stepper',
    allowedModes: ['stepper', 'inspector', 'graph', 'timeline'],
  },
  capability: {
    label: 'Capability',
    description: 'Tools, services, and execution capabilities.',
    defaultMode: 'inspector',
    allowedModes: ['inspector', 'graph', 'code', 'card'],
  },
  orchestration: {
    label: 'Orchestration',
    description: 'Agents, tracks, and runtime routing structures.',
    defaultMode: 'graph',
    allowedModes: ['graph', 'timeline', 'inspector', 'stepper'],
  },
  memory: {
    label: 'Memory',
    description: 'Durable memory and historical intelligence.',
    defaultMode: 'timeline',
    allowedModes: ['timeline', 'inspector', 'graph', 'outline'],
  },
  query: {
    label: 'Query',
    description: 'Executable graph or tool queries and their working context.',
    defaultMode: 'code',
    allowedModes: ['code', 'inspector', 'graph', 'split'],
  },
  meta: {
    label: 'Meta',
    description: 'Grouping and higher-order structural nodes.',
    defaultMode: 'graph',
    allowedModes: ['graph', 'inspector'],
  },
};

export const CANONICAL_NODE_FAMILY_MAP: Record<CanvasNodeType, CanvasNodeFamilyId> = {
  Agent: 'orchestration',
  Artifact: 'artifact',
  Claim: 'reasoning',
  CodeImplementation: 'capability',
  ComplianceGap: 'foundry',
  Decision: 'foundry',
  Entity: 'knowledge',
  Evidence: 'evidence',
  GuardrailRule: 'foundry',
  Insight: 'knowledge',
  KnowledgePattern: 'foundry',
  MCPTool: 'capability',
  Memory: 'memory',
  StrategicInsight: 'knowledge',
  StrategicLeverage: 'foundry',
  Tool: 'capability',
  Track: 'orchestration',
  combo: 'meta',
  query: 'query',
};

export type FoundryEdgeType = Extract<
  RelationshipType,
  'CONSTRAINS' | 'IMPLEMENTS' | 'LEVERAGES' | 'RELATED_TO' | 'REMEDIATES' | 'TARGETS'
>;

export interface ProvenanceData {
  createdBy: 'manual' | 'query' | 'expand' | 'tool' | 'ai' | 'pipeline' | 'harvest';
  createdAt: string;
  source: string;
  confidence?: number;
  parentNodeId?: string;
  tool?: string;
  query?: string;
}

export const CANONICAL_REGULATORY_LEVELS = ['strict', 'guideline', 'info'] as const;
export type RegulatoryLevel = (typeof CANONICAL_REGULATORY_LEVELS)[number];

export function normalizeRegulatoryLevel(value: unknown): RegulatoryLevel | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if ((CANONICAL_REGULATORY_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as RegulatoryLevel;
  }
  if (normalized === 'critical') return 'strict';
  if (normalized === 'warning' || normalized === 'high') return 'guideline';
  if (normalized === 'medium' || normalized === 'low' || normalized === 'default') return 'info';
  return undefined;
}

export interface CanvasNodeData extends Record<string, unknown> {
  label: string;
  subtitle?: string;
  nodeType: CanvasNodeType;
  nodeFamily?: CanvasNodeFamilyId;
  defaultMode?: CanvasNodeModeId;
  allowedModes?: CanvasNodeModeId[];
  metadata?: Record<string, unknown>;
  provenance?: ProvenanceData;
  queryText?: string;
  queryType?: 'cypher' | 'mcp';
  queryStatus?: 'idle' | 'running' | 'success' | 'error';
  queryResultCount?: number;
  artifactType?: 'mermaid' | 'markdown' | 'chart' | 'table' | 'html' | 'audio' | 'summary' | 'faq' | 'study-guide';
  artifactSource?: string;
  childCount?: number;
  collapsed?: boolean;
  thinkingSteps?: string[];
  reasoningStatus?: 'thinking' | 'complete' | 'error';
  regulatoryLevel?: RegulatoryLevel;
  complianceScore?: number;
  isRejected?: boolean;
  rejectionReason?: string;
  signalIntensity?: number;
  isNew?: boolean;
  validityScore?: number;
  evidenceLinks?: Array<{ label: string; url?: string; snippet?: string; type: 'support' | 'conflict' }>;
  blockConfidence?: number;
  blockSource?: string;
  artifactId?: string;
  artifactFamily?: string;
  qualityGate?: string;
  reviewState?: 'draft' | 'verified' | 'review_requested' | 'in_review' | 'approved' | 'rejected' | 'export_ready' | 'exported' | 'degraded' | 'canonical' | 'ephemeral' | 'unsigned';
  renderContract?: string;
  renderPackageId?: string;
  sourceGraphNodeId?: string;
  sourceGraphLabels?: NodeLabel[];
  sourceAssetIds?: string[];
  availableActions?: string[];
  backendTargets?: string[];
  routingDecision?: Record<string, unknown>;
  workflowEnvelope?: Record<string, unknown>;
  trustProfiles?: Array<Record<string, unknown>>;
  governanceScorecard?: Record<string, unknown>;
  legoFactorySummary?: Record<string, unknown>;
  memoryGovernance?: Record<string, unknown>;
  reviewBacklog?: Record<string, unknown>;
  coverageGaps?: Array<Record<string, unknown>>;
  governedOutputs?: Array<Record<string, unknown>>;
  readOnly?: boolean;
  routeFlowRef?: string;
  routeSelectedAgent?: string;
  routeSelectedAgentAlias?: string;
  routeSelectedAgentTrustLevel?: string;
  routeSelectedAgentProcessDna?: string[];
  routeSelectedAgentGovernedBy?: string[];
  routeSelectedAgentAdoptionGate?: string;
  routeCapability?: string;
}

export type CanvasNode = Node<CanvasNodeData>;

export interface NodeConfig {
  color: string;
  icon: any;
  layerLabel: string;
}

export function resolveCanvasNodeFamily(nodeType: CanvasNodeType): CanvasNodeFamilyId {
  return CANONICAL_NODE_FAMILY_MAP[nodeType];
}

export function getCanvasNodeFamilyLabel(nodeFamily: CanvasNodeFamilyId): string {
  return CANVAS_NODE_FAMILY_REGISTRY[nodeFamily].label;
}

export function getCanvasNodeModeLabel(mode: CanvasNodeModeId): string {
  return CANVAS_NODE_MODE_REGISTRY[mode].label;
}

function dedupeModes(modes: CanvasNodeModeId[]): CanvasNodeModeId[] {
  return Array.from(new Set(modes));
}

export function resolveCanvasNodePresentation(data: Pick<CanvasNodeData, 'nodeType' | 'nodeFamily' | 'defaultMode' | 'allowedModes'>) {
  const nodeFamily = data.nodeFamily ?? resolveCanvasNodeFamily(data.nodeType);
  const familyDefinition = CANVAS_NODE_FAMILY_REGISTRY[nodeFamily];
  const defaultMode = data.defaultMode ?? familyDefinition.defaultMode;
  const allowedModes = dedupeModes(
    data.allowedModes && data.allowedModes.length > 0
      ? [defaultMode, ...data.allowedModes]
      : [defaultMode, ...familyDefinition.allowedModes],
  );

  return {
    nodeFamily,
    defaultMode,
    allowedModes,
  };
}

export function enrichCanvasNodeData(data: CanvasNodeData): CanvasNodeData {
  const presentation = resolveCanvasNodePresentation(data);
  return {
    ...data,
    nodeFamily: presentation.nodeFamily,
    defaultMode: presentation.defaultMode,
    allowedModes: presentation.allowedModes,
  };
}
