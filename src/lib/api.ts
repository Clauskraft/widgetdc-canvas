import type { ArtifactSurfacePayload, LibreChatRuntimeIntelligencePayload } from './artifactSurface';

// Both dev (Vite proxy) and prod (Caddy reverse_proxy) handle /api → backend.
// Always use relative URLs — no CORS issues, same-origin requests.
const API_URL = '';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function getOrchestratorUrl(): string {
  return import.meta.env.VITE_ORCHESTRATOR_URL ?? '';
}

export async function mcpCall<T = unknown>(tool: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/mcp/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ tool, payload }),
    signal: AbortSignal.timeout(30_000),
  });

  let data: unknown = null;
  let rawText = '';

  try {
    rawText = await res.text();
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText || null;
  }

  if (!res.ok) {
    const body = data as {
      error?: string | { message?: string };
      message?: string;
      legalVeto?: { reason?: string; constraintName?: string; lawName?: string };
    } | null;
    const backendMessage =
      typeof body?.error === 'string' ? body.error
      : typeof body?.error?.message === 'string' ? body.error.message
      : typeof body?.message === 'string' ? body.message
      : body?.legalVeto?.reason
      ?? rawText
      ?? res.statusText;
    const extra =
      body?.legalVeto
        ? ` [${body.legalVeto.constraintName ?? 'Legal gate'}${body.legalVeto.lawName ? ` / ${body.legalVeto.lawName}` : ''}]`
        : '';
    throw new Error(`MCP ${tool} failed: ${res.status} ${backendMessage}${extra}`);
  }

  const typed = data as { error?: string | { message?: string } } | null;
  if (typed?.error) {
    throw new Error(
      typeof typed.error === 'string'
        ? `MCP ${tool} failed: ${typed.error}`
        : `MCP ${tool} failed: ${typed.error.message ?? 'Unknown MCP error'}`
    );
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

export interface GraphWindowResponse {
  nodes: unknown[];
  edges: unknown[];
  totalCount: number;
  lodLevel: string;
}

export async function graphWindow(
  lod: 'overview' | 'region' | 'detail' | 'full',
  options?: {
    centerNodeId?: string;
    limit?: number;
  },
): Promise<GraphWindowResponse> {
  const result = await mcpCall<{
    success?: boolean;
    result?: {
      nodes?: unknown[];
      edges?: unknown[];
      total_count?: number;
      lod_level?: string;
    };
    nodes?: unknown[];
    edges?: unknown[];
    total_count?: number;
    lod_level?: string;
  }>('graph.window', {
    lod,
    center_node_id: options?.centerNodeId,
    limit: options?.limit,
  });

  const inner = result?.result ?? result;
  return {
    nodes: (inner?.nodes as unknown[]) ?? [],
    edges: (inner?.edges as unknown[]) ?? [],
    totalCount: Number(inner?.total_count ?? 0),
    lodLevel: String(inner?.lod_level ?? lod),
  };
}

export interface GraphSearchResult {
  id: string;
  label: string;
  type: string;
  score: number;
}

export async function graphSearch(
  query: string,
  options?: { nodeTypes?: string[]; limit?: number },
): Promise<GraphSearchResult[]> {
  const result = await mcpCall<{
    success?: boolean;
    result?: {
      results?: GraphSearchResult[];
    };
    results?: GraphSearchResult[];
  }>('graph.search', {
    query,
    node_types: options?.nodeTypes,
    limit: options?.limit,
  });

  const inner = result?.result ?? result;
  return Array.isArray(inner?.results) ? inner.results : [];
}

function graphWindowToNeighborRecords(
  sourceLabel: string,
  windowNodes: unknown[],
  windowEdges: unknown[],
  relTypes?: string[],
): unknown[] {
  const edgeRows = (Array.isArray(windowEdges) ? windowEdges : []) as Array<Record<string, unknown>>;
  const nodeRows = (Array.isArray(windowNodes) ? windowNodes : []) as Array<Record<string, unknown>>;
  const sourceNode = nodeRows.find((node) => {
    const candidateLabel = String(node?.label ?? node?.id ?? '');
    return candidateLabel.toLowerCase() === sourceLabel.toLowerCase();
  });

  const sourceId = String(sourceNode?.id ?? sourceLabel);
  const allowedRelTypes = relTypes?.length ? new Set(relTypes) : null;
  const nodeById = new Map(nodeRows.map((node) => [String(node?.id ?? ''), node]));

  return edgeRows
    .filter((edge) => {
      const edgeType = String(edge?.type ?? 'RELATED');
      return (!allowedRelTypes || allowedRelTypes.has(edgeType))
        && (String(edge?.source ?? '') === sourceId || String(edge?.target ?? '') === sourceId);
    })
    .map((edge) => {
      const source = String(edge?.source ?? '');
      const target = String(edge?.target ?? '');
      const otherId = source === sourceId ? target : source;
      const otherNode = nodeById.get(otherId);
      return {
        m: {
          properties: {
            id: otherNode?.id ?? otherId,
            name: otherNode?.label ?? otherId,
            ...(otherNode?.properties as Record<string, unknown> | undefined),
          },
        },
        relType: String(edge?.type ?? 'RELATED'),
        nodeLabel: String(otherNode?.type ?? 'unknown'),
      };
    });
}

export async function graphNeighborSearch(name: string, relTypes?: string[], limit = 20): Promise<unknown[]> {
  try {
    const result = await graphWindow('full', { centerNodeId: name, limit });
    const records = graphWindowToNeighborRecords(name, result.nodes, result.edges, relTypes);
    if (records.length > 0) {
      return records.slice(0, limit);
    }
  } catch {
    // Fall through to direct graph.read_cypher for environments where graph.window is unavailable.
  }

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
  try {
    const results = await graphSearch(text, { limit });
    if (results.length > 0) {
      return results;
    }
  } catch {
    // Fall through to direct graph.read_cypher for environments where graph.search is unavailable.
  }

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

const RLM_URL = '';

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
  const res = await fetch(`${RLM_URL}/reason`, {
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
  const url = new URL(`${RLM_URL}/intelligence/compliance-gaps`);
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
  const res = await fetch(`${API_URL}/api/artifacts/surfaces/${encodeURIComponent(artifactId)}`, {
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
  const res = await fetch(`${API_URL}/api/artifacts/surfaces/${encodeURIComponent(artifactId)}/actions`, {
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

export interface GovernanceArbitrationBacklogItem {
  decisionId: string;
  engagementId: string;
  latestRouteAt?: string | null;
  ageMinutes: number;
  routeCount: number;
  reviewState: 'unreviewed' | 'reversed' | 'accepted';
}

export interface GovernanceArbitrationBacklogSummary {
  queueName: string;
  status: 'green' | 'yellow' | 'red';
  divergentCount: number;
  unreviewedCount: number;
  reversedCount: number;
  oldestAgeMinutes: number | null;
  outputCount: number;
}

export interface GovernanceArbitrationBacklogPayload {
  windowDays: number;
  limit: number;
  queueSummary: GovernanceArbitrationBacklogSummary;
  items: GovernanceArbitrationBacklogItem[];
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
  arbitrationBacklog: GovernanceArbitrationBacklogPayload;
  coverageGaps: GovernanceCoverageGap[];
}

export async function fetchLibreChatRuntimeIntelligence(
  payload: LibreChatRuntimeIntelligenceRequest,
): Promise<LibreChatRuntimeIntelligencePayload> {
  const res = await fetch(`${RLM_URL}/intelligence/librechat/runtime-intelligence`, {
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
  const [scorecardRes, legoFactoryRes, memoryRes, reviewBacklogRes, arbitrationBacklogRes] = await Promise.all([
    fetch(`${API_URL}/api/governance/scorecard?days=${encodeURIComponent(String(days))}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(`${API_URL}/api/governance/legofactory?limit=${encodeURIComponent(String(limit))}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(`${API_URL}/api/governance/memory?days=${encodeURIComponent(String(days))}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(`${API_URL}/api/governance/review-backlog?days=${encodeURIComponent(String(days))}&limit=${encodeURIComponent(String(limit))}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20_000),
    }),
    fetch(`${API_URL}/api/governance/arbitration-backlog?days=${encodeURIComponent(String(days))}&limit=${encodeURIComponent(String(limit))}`, {
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
  if (!arbitrationBacklogRes.ok) {
    throw new Error(`Governance arbitration backlog fetch failed: ${arbitrationBacklogRes.status}`);
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
  const arbitrationBacklogData = await arbitrationBacklogRes.json() as {
    windowDays?: number;
    limit?: number;
    queueSummary?: GovernanceArbitrationBacklogSummary;
    items?: GovernanceArbitrationBacklogItem[];
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
  const arbitrationBacklog: GovernanceArbitrationBacklogPayload = {
    windowDays: arbitrationBacklogData.windowDays ?? days,
    limit: arbitrationBacklogData.limit ?? limit,
    queueSummary: arbitrationBacklogData.queueSummary ?? {
      queueName: 'tri-source-arbitration-backlog',
      status: 'green',
      divergentCount: 0,
      unreviewedCount: 0,
      reversedCount: 0,
      oldestAgeMinutes: null,
      outputCount: 0,
    },
    items: arbitrationBacklogData.items ?? [],
  };

  return {
    contractVersion: 'canvas.downstream.eval.v1',
    generatedAt: new Date().toISOString(),
    readOnly: true,
    scorecard,
    legoFactory,
    memory,
    reviewBacklog,
    arbitrationBacklog,
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
  const res = await fetch(`${API_URL}/api/mcp/tools`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'X-API-Key': API_KEY,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.data?.definitions ?? data?.definitions ?? data?.tools ?? data ?? []) as ToolDefinition[];
}
