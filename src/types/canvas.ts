import { type Node } from '@xyflow/react';
import type { NodeLabel, RelationshipType } from '@widgetdc/contracts/graph';

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
  qualityGate?: 'pass' | 'warning' | 'degraded';
  reviewState?: 'draft' | 'verified' | 'review_requested' | 'in_review' | 'approved' | 'rejected' | 'export_ready' | 'exported' | 'degraded';
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
  coverageGaps?: Array<Record<string, unknown>>;
  governedOutputs?: Array<Record<string, unknown>>;
  readOnly?: boolean;
  routeFlowRef?: string;
  routeSelectedAgent?: string;
  routeCapability?: string;
}

export type CanvasNode = Node<CanvasNodeData>;

export interface NodeConfig {
  color: string;
  icon: any;
  layerLabel: string;
}
