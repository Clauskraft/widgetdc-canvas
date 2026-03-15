import { type Node } from '@xyflow/react';

/**
 * 17 Node Types — 7 Layers reflecting Canvas 5X + Foundry architecture
 *
 * INFRASTRUCTURE:  server | endpoint
 * CAPABILITY:      tool
 * ORCHESTRATION:   pipeline | agent
 * INTELLIGENCE:    entity | insight | evidence | artifact
 * REASONING:       thought
 * SANDBOX:         query
 * FOUNDRY:         answer-block | pattern | control-pack | migration-path | replacement-candidate
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
  | 'answer-block'           // Foundry: structured advisory answers
  | 'pattern'                // Foundry: reusable architectural patterns
  | 'control-pack'           // Foundry: security/compliance control sets
  | 'migration-path'         // Foundry: migration/transition plans
  | 'replacement-candidate'  // Foundry: alternative solution proposals
  | 'combo';    // Meta: collapsed group of nodes

/** Foundry block types — the 5 core blocks per ADR-001 */
export const FOUNDRY_BLOCK_TYPES: CanvasNodeType[] = [
  'answer-block', 'pattern', 'control-pack', 'migration-path', 'replacement-candidate',
];

/** Typed edge semantics for Foundry relationships */
export type FoundryEdgeType =
  | 'USES_PATTERN'
  | 'MITIGATES'
  | 'REPLACES'
  | 'ALTERNATIVE_TO'
  | 'HAS_BLOCK'
  | 'IMPLEMENTED_BY';

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
  artifactType?: 'mermaid' | 'markdown' | 'chart' | 'table' | 'html' | 'audio' | 'summary' | 'faq' | 'study-guide';
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
  isNew?: boolean;
  // Empirical Validity Layer
  validityScore?: number; // 0.0 - 1.0
  evidenceLinks?: Array<{ label: string; url?: string; snippet?: string; type: 'support' | 'conflict' }>;
  // Foundry block specifics
  blockConfidence?: number; // 0.0 - 1.0 from graph source
  blockSource?: string; // originating engagement/session
  // Canonical architecture artifact surface binding
  artifactId?: string;
  artifactFamily?: string;
  qualityGate?: 'pass' | 'warning' | 'degraded';
  reviewState?: 'draft' | 'verified' | 'review_requested' | 'in_review' | 'approved' | 'rejected' | 'export_ready' | 'exported' | 'degraded';
  renderContract?: string;
  renderPackageId?: string;
  sourceGraphNodeId?: string;
  sourceGraphLabels?: string[];
  sourceAssetIds?: string[];
  availableActions?: string[];
  backendTargets?: string[];
}

export type CanvasNode = Node<CanvasNodeData>;

export interface NodeConfig {
  color: string;
  icon: any; // Using any here to avoid lucide-react dependency in types if possible, or just import it
  layerLabel: string;
}
