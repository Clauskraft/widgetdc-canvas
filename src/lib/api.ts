import type { ArtifactSurfacePayload, LibreChatRuntimeIntelligencePayload } from './artifactSurface';

function resolveBaseUrl(value?: string): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

function getApiUrl(): string {
  return resolveBaseUrl(import.meta.env.VITE_API_URL);
}
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function getOrchestratorUrl(): string {
  return import.meta.env.VITE_ORCHESTRATOR_URL ?? '';
}

export async function mcpCall<T = unknown>(tool: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${getApiUrl()}/api/mcp/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ tool, payload }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`MCP call failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data?.error) {
    throw new Error(data.error?.message ?? String(data.error));
  }
  return data as T;
}

export async function graphRead(query: string, params: Record<string, unknown> = {}): Promise<unknown[]> {
  const result = await mcpCall<Record<string, unknown>>('graph.read_cypher', { query, params });
  const inner = result?.result as Record<string, unknown> | undefined;
  // Backend returns results[] (not records[])
  const records = (inner?.results as unknown[]) ?? (inner?.records as unknown[]) ?? [];
  return records;
}

export async function graphWrite(query: string, params: Record<string, unknown> = {}) {
  return mcpCall('graph.write_cypher', { query, params });
}

// --- Canvas 5X API additions ---

export async function graphExpand(nodeLabel: string, options?: {
  depth?: number;
  direction?: string;
  relTypes?: string[];
  limit?: number;
}): Promise<{ nodes: unknown[]; edges: unknown[] }> {
  // graph.expand uses { node_id, depth?, direction? } per Codex verification (LIN-52)
  const result = await mcpCall<{ success: boolean; result?: { nodes?: unknown[]; edges?: unknown[] } }>(
    'graph.expand',
    {
      node_id: nodeLabel,
      depth: options?.depth ?? 1,
      direction: options?.direction ?? 'both',
    },
  );
  const inner = result?.result ?? {};
  return {
    nodes: (inner.nodes as unknown[]) ?? [],
    edges: (inner.edges as unknown[]) ?? [],
  };
}

// Fallback for graph.window/search (not production-ready per Codex)
// Uses direct Cypher instead
export async function graphNeighborSearch(name: string, relTypes?: string[], limit = 20): Promise<unknown[]> {
  const relFilter = relTypes?.length ? 'AND type(r) IN $relTypes' : '';
  const query = `
    MATCH (n)-[r]-(m)
    WHERE toLower(n.name) = toLower($name) ${relFilter}
    RETURN DISTINCT m, type(r) AS relType, labels(m)[0] AS nodeLabel
    LIMIT $limit
  `;
  return graphRead(query, { name, limit, ...(relTypes?.length ? { relTypes } : {}) });
}

export async function graphTextSearch(text: string, limit = 20): Promise<unknown[]> {
  const query = `
    MATCH (n)
    WHERE n.name IS NOT NULL AND toLower(n.name) CONTAINS toLower($text)
    RETURN n, labels(n)[0] AS nodeLabel
    ORDER BY size(n.name)
    LIMIT $limit
  `;
  return graphRead(query, { text, limit });
}

// --- Canvas 5X Phase 2: RLM Reasoning ---

function getRlmUrl(): string {
  return resolveBaseUrl(import.meta.env.VITE_RLM_URL);
}

export interface ReasonResponse {
  recommendation: string;
  thinking_steps?: string[];
  confidence?: number;
  sources?: string[];
}

export interface ComplianceGapRecord {
  framework_id?: string;
  framework_name?: string;
  obligation_id?: string;
  control_id?: string;
  evidence_id?: string;
  gap_type?: string;
  severity?: string;
  description?: string;
}

export async function reasonCall(query: string, context?: Record<string, unknown>): Promise<ReasonResponse> {
  const requestContext = {
    ...(context ?? {}),
    ...(query.length > 200 ? { enriched_prompt: query } : {}),
  };
  const res = await fetch(`${getRlmUrl()}/reason`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: query,
      context: requestContext,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Reason call failed: ${res.status}`);
  const data = await res.json();
  return {
    recommendation: data?.recommendation ?? data?.content ?? '',
    thinking_steps: data?.thinking_steps ?? data?.steps ?? [],
    confidence: data?.confidence,
    sources: data?.sources ?? [],
  };
}

export async function getComplianceGaps(frameworkId?: string): Promise<ComplianceGapRecord[]> {
  const url = new URL(`${getRlmUrl()}/intelligence/compliance-gaps`);
  if (frameworkId) url.searchParams.set('framework_id', frameworkId);
  const res = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Compliance gap call failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.gaps) ? data.gaps as ComplianceGapRecord[] : [];
}

export async function fetchArtifactSurface(artifactId: string): Promise<ArtifactSurfacePayload> {
  const res = await fetch(`${getApiUrl()}/api/artifacts/surfaces/${encodeURIComponent(artifactId)}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Artifact surface fetch failed: ${res.status}`);
  }
  const data = await res.json();
  if (data?.success === false) {
    throw new Error(data?.error ?? 'Artifact surface fetch failed');
  }
  return data as ArtifactSurfacePayload;
}

export async function applyArtifactSurfaceAction(
  artifactId: string,
  action: string,
): Promise<ArtifactSurfacePayload> {
  const res = await fetch(`${getApiUrl()}/api/artifacts/surfaces/${encodeURIComponent(artifactId)}/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ action }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const maybeError = await res.json().catch(() => null);
    throw new Error(maybeError?.error ?? `Artifact surface action failed: ${res.status}`);
  }
  const data = await res.json();
  if (data?.success === false) {
    throw new Error(data?.error ?? 'Artifact surface action failed');
  }
  return data as ArtifactSurfacePayload;
}

export interface LibreChatRuntimeIntelligenceRequest {
  target_domain: string;
  framework?: string;
  enterprise_grounding?: boolean;
  benchmark_outcomes?: Record<string, unknown>[];
  loose_ends?: Record<string, unknown>[];
  backend_consumption_receipts?: Record<string, unknown>[];
}

export interface OrchestratorRoutingDecisionPayload {
  decision_id: string;
  selected_agent_id: string;
  selected_capability: string;
  trust_score: number;
  reason_code: string;
  decided_at: string;
  evidence_refs?: string[];
  intent?: {
    flow_ref?: string;
    task_domain?: string;
    operator_visible?: boolean;
  };
}

export interface OrchestratorTrustProfilePayload {
  agent_id: string;
  task_domain: string;
  success_count: number;
  fail_count: number;
  bayesian_score: number;
  evidence_source: string;
  scorecard_dimension: string;
  last_verified_at: string;
}

export interface OrchestratorWorkflowEnvelopePayload {
  workflow_id: string;
  workflow_type: string;
  current_phase: string;
  participants: string[];
  primary_surface: string;
  flow_ref: string;
  scorecard_ref: string;
  reasoning_lineage_visible: boolean;
  started_at: string;
  updated_at: string;
}

export interface OrchestratorRoutingSnapshotPayload {
  recentDecisions: OrchestratorRoutingDecisionPayload[];
  topTrustProfiles: OrchestratorTrustProfilePayload[];
  latestWorkflow?: OrchestratorWorkflowEnvelopePayload | null;
  latestChainExecutionId?: string | null;
}

export interface GovernanceCoverageGap {
  metric: string;
  reason: string;
}

export interface GovernanceScorecardEvent {
  id: string;
  type: string;
  decisionId?: string | null;
  engagementId?: string | null;
  recordedAt?: string | null;
  route?: string | null;
}

export interface GovernanceScorecardSummary {
  windowDays: number;
  verifiedDecisions: number;
  operatorAccepted: number;
  operatorRejected: number;
  acceptanceRate: number | null;
  rejectionRate: number | null;
  reversalCount: number;
  stabilityRate: number | null;
  routedDecisionEvents: number;
  routedDecisionCoverage: number | null;
  triSourceArbitrationDivergenceCount: number;
  triSourceArbitrationDivergenceRate: number | null;
  avgTimeToVerifiedMinutes: number | null;
  medianTimeToVerifiedMinutes: number | null;
  oodaRunEvents: number;
  oodaFallbackEvents: number;
  oodaFailedEvents: number;
  oodaFallbackRate: number | null;
  oodaFailureRate: number | null;
  oodaAverageDurationMs: number | null;
  freshVerifiedFailureCount?: number;
  freshVerifiedLineageFailureCount?: number;
  freshVerifiedFailureRate?: number | null;
  verifiedWithOperatorFeedback?: number;
  verifiedAcceptedOnlyCount?: number;
  verifiedRejectedOnlyCount?: number;
  verifiedReversalCount?: number;
  verifiedUnreviewedCount?: number;
  verifiedAcceptanceRate?: number | null;
  verifiedRejectionRate?: number | null;
  verifiedReversalRate?: number | null;
  verifiedStabilityRate?: number | null;
  rejectionWithOodaDegradationCount?: number;
  rejectionWithOodaDegradationRate?: number | null;
  operatorQualityStatus?: 'green' | 'yellow' | 'red';
  verifiedUnreviewedCriticalCount?: number;
  oldestVerifiedUnreviewedAgeMinutes?: number | null;
  operatorReviewBacklogStatus?: 'green' | 'yellow' | 'red';
  reviewBacklogTop?: GovernanceReviewBacklogItem[];
  medianTimeToFirstOperatorFeedbackMinutes?: number | null;
  medianTimeToFirstReversalMinutes?: number | null;
  groundedEvidenceDepthAvg?: number | null;
  groundedEvidenceCoverage?: number | null;
  verificationPacketCoverage?: number | null;
  rolloutEvidencePacketCoverage?: number | null;
  coverageGaps: GovernanceCoverageGap[];
  recentEvents: GovernanceScorecardEvent[];
}

export interface GovernanceReviewBacklogItem {
  decisionId: string;
  engagementId: string;
  verifiedAt?: string | null;
  ageMinutes: number;
  hasRoute: boolean;
}

export interface GovernanceReviewBacklogSummary {
  queueName: string;
  status: 'green' | 'yellow' | 'red';
  unreviewedCount: number;
  criticalCount: number;
  oldestAgeMinutes: number | null;
  outputCount: number;
}

export interface GovernanceReviewBacklogPayload {
  windowDays: number;
  limit: number;
  queueSummary: GovernanceReviewBacklogSummary;
  items: GovernanceReviewBacklogItem[];
}

export interface LegoFactoryQueueSummaryPayload {
  queueName: string;
  waiting: number;
  active: number;
  blocked: number;
  promotable: number;
  outputCount: number;
}

export interface LegoFactoryGovernedOutputPayload {
  id: string;
  kind: string;
  status: string;
  readBackVerified: boolean;
  gate: {
    blocked: boolean;
    reason: string;
  };
  updatedAt: string;
}

export interface LegoFactoryGovernancePayload {
  queueSummary: LegoFactoryQueueSummaryPayload;
  recentGovernedOutputs: LegoFactoryGovernedOutputPayload[];
}

export interface MemoryGovernanceSummary {
  windowDays: number;
  activeEngagements: number;
  engagementsWithConnection: number;
  memoryConnections: number;
  memoryConnectionCoverage: number | null;
  learningObservations: number;
  acceptedObservations: number;
  rejectedObservations: number;
  acceptanceRate: number | null;
  rejectionRate: number | null;
  coverageGaps: GovernanceCoverageGap[];
}

export interface GovernanceEvalSnapshotPayload {
  contractVersion: 'canvas.downstream.eval.v1';
  generatedAt: string;
  readOnly: true;
  scorecard: GovernanceScorecardSummary;
  legoFactory: LegoFactoryGovernancePayload;
  memory: MemoryGovernanceSummary;
  reviewBacklog: GovernanceReviewBacklogPayload;
  coverageGaps: GovernanceCoverageGap[];
}

export async function fetchLibreChatRuntimeIntelligence(
  payload: LibreChatRuntimeIntelligenceRequest,
): Promise<LibreChatRuntimeIntelligencePayload> {
  const res = await fetch(`${getRlmUrl()}/intelligence/librechat/runtime-intelligence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target_domain: payload.target_domain,
      framework: payload.framework,
      enterprise_grounding: payload.enterprise_grounding ?? false,
      benchmark_outcomes: payload.benchmark_outcomes ?? [],
      loose_ends: payload.loose_ends ?? [],
      backend_consumption_receipts: payload.backend_consumption_receipts ?? [],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`LibreChat runtime intelligence call failed: ${res.status}`);
  }
  const data = await res.json();
  return data as LibreChatRuntimeIntelligencePayload;
}

export async function fetchOrchestratorRoutingSnapshot(): Promise<OrchestratorRoutingSnapshotPayload> {
  const baseUrl = getOrchestratorUrl().replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('VITE_ORCHESTRATOR_URL is not configured');
  }

  const res = await fetch(`${baseUrl}/dashboard/data`, {
    headers: {
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Orchestrator routing fetch failed: ${res.status}`);
  }

  const data = await res.json() as {
    routing?: {
      recentDecisions?: OrchestratorRoutingDecisionPayload[];
      topTrustProfiles?: OrchestratorTrustProfilePayload[];
    };
    chains?: Array<{
      execution_id?: string;
      workflow_envelope?: OrchestratorWorkflowEnvelopePayload;
    }>;
  };

  return {
    recentDecisions: data.routing?.recentDecisions ?? [],
    topTrustProfiles: data.routing?.topTrustProfiles ?? [],
    latestWorkflow: data.chains?.find((chain) => chain.workflow_envelope)?.workflow_envelope ?? null,
    latestChainExecutionId: data.chains?.find((chain) => chain.workflow_envelope)?.execution_id ?? null,
  };
}

export async function fetchGovernanceEvalSnapshot(days = 30, limit = 5): Promise<GovernanceEvalSnapshotPayload> {
  const [scorecardRes, legoFactoryRes, memoryRes, reviewBacklogRes] = await Promise.all([
    fetch(`${getApiUrl()}/api/governance/scorecard?days=${encodeURIComponent(String(days))}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(`${getApiUrl()}/api/governance/legofactory?limit=${encodeURIComponent(String(limit))}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(`${getApiUrl()}/api/governance/memory?days=${encodeURIComponent(String(days))}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(`${getApiUrl()}/api/governance/review-backlog?days=${encodeURIComponent(String(days))}&limit=${encodeURIComponent(String(limit))}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
  ]);

  if (!scorecardRes.ok) {
    throw new Error(`Governance scorecard fetch failed: ${scorecardRes.status}`);
  }
  if (!legoFactoryRes.ok) {
    throw new Error(`Governance LegoFactory fetch failed: ${legoFactoryRes.status}`);
  }
  if (!memoryRes.ok) {
    throw new Error(`Governance memory fetch failed: ${memoryRes.status}`);
  }
  if (!reviewBacklogRes.ok) {
    throw new Error(`Governance review backlog fetch failed: ${reviewBacklogRes.status}`);
  }

  const scorecardData = await scorecardRes.json() as {
    summary?: GovernanceScorecardSummary;
  };
  const legoFactoryData = await legoFactoryRes.json() as {
    queueSummary?: LegoFactoryQueueSummaryPayload;
    recentGovernedOutputs?: LegoFactoryGovernedOutputPayload[];
  };
  const memoryData = await memoryRes.json() as {
    summary?: MemoryGovernanceSummary;
  };
  const reviewBacklogData = await reviewBacklogRes.json() as {
    windowDays?: number;
    limit?: number;
    queueSummary?: GovernanceReviewBacklogSummary;
    items?: GovernanceReviewBacklogItem[];
  };

  const scorecard = scorecardData.summary;
  const memory = memoryData.summary;
  if (!scorecard) {
    throw new Error('Governance scorecard summary missing from response');
  }
  if (!memory) {
    throw new Error('Governance memory summary missing from response');
  }

  const legoFactory: LegoFactoryGovernancePayload = {
    queueSummary: legoFactoryData.queueSummary ?? {
      queueName: 'lego-factory-governance',
      waiting: 0,
      active: 0,
      blocked: 0,
      promotable: 0,
      outputCount: 0,
    },
    recentGovernedOutputs: legoFactoryData.recentGovernedOutputs ?? [],
  };
  const reviewBacklog: GovernanceReviewBacklogPayload = {
    windowDays: reviewBacklogData.windowDays ?? days,
    limit: reviewBacklogData.limit ?? limit,
    queueSummary: reviewBacklogData.queueSummary ?? {
      queueName: 'operator-review-backlog',
      status: 'red',
      unreviewedCount: 0,
      criticalCount: 0,
      oldestAgeMinutes: null,
      outputCount: 0,
    },
    items: reviewBacklogData.items ?? [],
  };

  return {
    contractVersion: 'canvas.downstream.eval.v1',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    scorecard,
    legoFactory,
    memory,
    reviewBacklog,
    coverageGaps: [...(scorecard.coverageGaps ?? []), ...(memory.coverageGaps ?? [])],
  };
}

// Compliance keyword auto-detection for Semantic Arbitrage routing
const COMPLIANCE_KEYWORDS = /\b(gdpr|compliance|regulation|legal|obligation|nis2|ai.act|dora|cra|cyber|privacy|data.protection|retsinformation|eur-lex)\b/i;

export function isComplianceQuery(text: string): boolean {
  return COMPLIANCE_KEYWORDS.test(text);
}

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  group?: string;
}

export async function listMcpTools(): Promise<ToolDefinition[]> {
  const res = await fetch(`${getApiUrl()}/api/mcp/tools`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.tools ?? data ?? []) as ToolDefinition[];
}
