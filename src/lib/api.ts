import type { ArtifactSurfacePayload, LibreChatRuntimeIntelligencePayload } from './artifactSurface';

function resolveBaseUrl(value?: string): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

function getApiUrl(): string {
  return resolveBaseUrl(import.meta.env.VITE_API_URL);
}

function getApiKey(): string {
  return String(import.meta.env.VITE_API_KEY ?? '').trim();
}

function getOrchestratorUrl(): string {
  return import.meta.env.VITE_ORCHESTRATOR_URL ?? '';
}

export async function mcpCall<T = unknown>(tool: string, payload: Record<string, unknown> = {}): Promise<T> {
  const apiKey = getApiKey();
  const res = await fetch(`${getApiUrl()}/api/mcp/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey
        ? {
            'Authorization': `Bearer ${apiKey}`,
            'X-API-Key': apiKey,
          }
        : {}),
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

export interface AgentPhonebookEntry {
  id: string;
  alias?: string;
  trustLevel?: string;
  processDna: string[];
  governedBy: string[];
  adoptionProtocol?: string;
  role?: string;
  className?: string;
}

interface AgentGenesisEvidenceAgent {
  id?: string;
  alias?: string | null;
  role?: string | null;
  class?: string | null;
  trust_level?: string | null;
  outgoing?: Array<{ rel?: string | null; target?: string | null }>;
}

interface AgentGenesisEvidenceCanonical {
  agents?: AgentGenesisEvidenceAgent[];
  process_dna?: string[];
}

function parseCanonicalJson<T>(value: unknown): T | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function mergeAgentPhonebookEntry(
  base: AgentPhonebookEntry | undefined,
  next: Partial<AgentPhonebookEntry>,
): AgentPhonebookEntry {
  return {
    id: next.id ?? base?.id ?? 'unknown',
    alias: next.alias ?? base?.alias,
    trustLevel: next.trustLevel ?? base?.trustLevel,
    processDna: next.processDna && next.processDna.length > 0 ? next.processDna : (base?.processDna ?? []),
    governedBy: next.governedBy && next.governedBy.length > 0 ? next.governedBy : (base?.governedBy ?? []),
    adoptionProtocol: next.adoptionProtocol ?? base?.adoptionProtocol,
    role: next.role ?? base?.role,
    className: next.className ?? base?.className,
  };
}

function normalizeAgentPhonebookEntry(
  directRows: unknown[],
  evidenceRows: unknown[],
): AgentPhonebookEntry[] {
  const merged = new Map<string, AgentPhonebookEntry>();

  const directAgents = (Array.isArray(directRows) ? directRows : []) as Array<Record<string, unknown>>;
  directAgents.forEach((row) => {
    const id = typeof row.id === 'string' ? row.id : undefined;
    if (!id) {
      return;
    }
    merged.set(id, mergeAgentPhonebookEntry(merged.get(id), {
      id,
      alias: typeof row.alias === 'string' ? row.alias : undefined,
      trustLevel: typeof row.trust_level === 'string' ? row.trust_level : undefined,
      processDna: toStringArray(row.process_dna),
      governedBy: toStringArray(row.governed_by),
    }));
  });

  const evidenceRow = ((Array.isArray(evidenceRows) ? evidenceRows : []) as Array<Record<string, unknown>>)[0];
  const evidence = parseCanonicalJson<AgentGenesisEvidenceCanonical>(evidenceRow?.evidence_canonical);
  const globalProcessDna = toStringArray(evidenceRow?.process_dna).length > 0
    ? toStringArray(evidenceRow?.process_dna)
    : toStringArray(evidence?.process_dna);

  (evidence?.agents ?? []).forEach((agent) => {
    if (typeof agent.id !== 'string' || agent.id.length === 0) {
      return;
    }
    const governedBy = (agent.outgoing ?? [])
      .filter((edge) => edge?.rel === 'GOVERNED_BY' || edge?.rel === 'GOVERNED_BY_POLICY')
      .map((edge) => edge?.target)
      .filter((target): target is string => typeof target === 'string' && target.length > 0);
    const adoptionProtocol = governedBy.find((target) => target === 'rules:adoption_protocol');

    merged.set(agent.id, mergeAgentPhonebookEntry(merged.get(agent.id), {
      id: agent.id,
      alias: typeof agent.alias === 'string' ? agent.alias : undefined,
      trustLevel: typeof agent.trust_level === 'string' ? agent.trust_level : undefined,
      processDna: globalProcessDna,
      governedBy,
      adoptionProtocol,
      role: typeof agent.role === 'string' ? agent.role : undefined,
      className: typeof agent.class === 'string' ? agent.class : undefined,
    }));
  });

  return Array.from(merged.values()).sort((left, right) => {
    const leftKey = left.alias ?? left.id;
    const rightKey = right.alias ?? right.id;
    return leftKey.localeCompare(rightKey);
  });
}

export async function fetchAgentRouterPhonebook(): Promise<AgentPhonebookEntry[]> {
  const [directRows, evidenceRows] = await Promise.all([
    graphRead(
      `
        MATCH (a:Agent)
        WHERE a.alias IS NOT NULL
        RETURN a.id AS id, a.alias AS alias, a.trust_level AS trust_level
        ORDER BY a.alias
      `,
    ),
    graphRead(
      `
        MATCH (a:WorkArtifact {id:$id})
        RETURN a.process_dna AS process_dna, a.evidence_canonical AS evidence_canonical
      `,
      { id: 'artifact:agent-genesis:v3:20260424T1250Z' },
    ),
  ]);

  return normalizeAgentPhonebookEntry(directRows, evidenceRows);
}

export function resolveAgentPhonebookEntry(
  phonebook: AgentPhonebookEntry[],
  agentId?: string | null,
): AgentPhonebookEntry | undefined {
  if (!agentId) {
    return undefined;
  }
  return phonebook.find((entry) => entry.id === agentId);
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
  const apiKey = getApiKey();
  const res = await fetch(`${getApiUrl()}/api/artifacts/surfaces/${encodeURIComponent(artifactId)}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
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
  const apiKey = getApiKey();
  const res = await fetch(`${getApiUrl()}/api/artifacts/surfaces/${encodeURIComponent(artifactId)}/actions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
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

export interface WorkRunCanvasProjectionItem {
  id: string;
  title: string | null;
  status: string | null;
  kind: string | null;
  order_index: number | null;
}

export interface WorkRunCanvasProjectionArtifact {
  id: string;
  title: string | null;
  artifact_type: string | null;
  status: string | null;
  trust_scope: string | null;
  signing_pubkey: string | null;
  verified_at: string | null;
  control_hubs: string[];
}

export interface WorkRunCanvasProjection {
  id: string;
  status: string | null;
  brief: string | null;
  canonical_pattern: string | null;
  profile_id: string | null;
  source_phantom_run_id: string | null;
  workspec_id: string | null;
  workspec_name: string | null;
  domain_profile_id: string | null;
  domain_profile_name: string | null;
  all_moves_canonical: boolean | null;
  completed_at: string | null;
  workitems: WorkRunCanvasProjectionItem[];
  artifacts: WorkRunCanvasProjectionArtifact[];
}

export async function fetchWorkRunCockpit(workrunId: string): Promise<WorkRunCanvasProjection> {
  const data = await backendRequest<{ success: boolean; workrun: WorkRunCanvasProjection }>(
    `/api/workcore/canvas/workrun/${encodeURIComponent(workrunId)}`,
    { method: 'GET' },
  );
  return data.workrun;
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

export interface LegoFactoryFailureClassSummary {
  sourceName: string;
  totalFailures: number;
  uniqueErrorTypes: number;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  isRecurring: boolean;
  lastFailureAt: string | null;
  recommendedAction: string | null;
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
  failureMemoryClassCount?: number;
  recurringFailureClassCount?: number;
  failureMemoryBacklogStatus?: 'green' | 'yellow' | 'red';
  failureMemoryBacklogTop?: LegoFactoryFailureClassSummary[];
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
  const [scorecardRes, legoFactoryRes, memoryRes, reviewBacklogRes, arbitrationBacklogRes] = await Promise.all([
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
    fetch(`${getApiUrl()}/api/governance/arbitration-backlog?days=${encodeURIComponent(String(days))}&limit=${encodeURIComponent(String(limit))}`, {
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
  const apiKey = getApiKey();
  const res = await fetch(`${getApiUrl()}/api/mcp/tools`, {
    headers: {
      ...(apiKey
        ? {
            'Authorization': `Bearer ${apiKey}`,
            'X-API-Key': apiKey,
          }
        : {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.data?.definitions ?? data?.definitions ?? data?.tools ?? data ?? []) as ToolDefinition[];
}

async function backendRequest<T>(pathname: string, init: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey
      ? {
          'Authorization': `Bearer ${apiKey}`,
          'X-API-Key': apiKey,
        }
      : {}),
    ...(init.headers ?? {}),
  };

  const res = await fetch(`${getApiUrl()}${pathname}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(30_000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const body = (data ?? {}) as Record<string, unknown>;
    throw new Error(String(body.error ?? body.message ?? `HTTP ${res.status}`));
  }

  return data as T;
}

export type PheromoneSignalType =
  | 'risk'
  | 'novelty'
  | 'question'
  | 'claim'
  | 'contradiction'
  | 'breaking_change'
  | 'opportunity'
  | 'attention';

export interface ResourceAnchorInput {
  anchor_kind:
    | 'docx-page'
    | 'docx-paragraph'
    | 'xlsx-cell'
    | 'xlsx-range'
    | 'file'
    | 'folder'
    | 'pdf-page'
    | 'web-url'
    | 'web-selection'
    | 'code-span';
  resource_uri: string;
  resource_label?: string;
  locator_json: Record<string, unknown>;
  anchor_text?: string;
  content_fingerprint?: string;
}

export interface CreatePheromoneRequest {
  anchor: ResourceAnchorInput;
  signal_type: PheromoneSignalType;
  rationale?: string;
  strength?: number;
  created_by?: string;
  client_surface: 'canvas' | 'word_addin' | 'excel_addin' | 'web_overlay' | 'filesystem_shell';
  client_session_id?: string;
  consent_grant_id?: string;
}

export interface CreatePheromoneResponse {
  success: boolean;
  status: 'accepted';
  pheromone_id: string;
  anchor_id: string;
  inspection_enqueued: boolean;
  accepted_at: string;
  directive_run_id: string;
}

export interface InspectPheromoneResponse {
  success: boolean;
  status: 'completed';
  pheromone_id: string;
  inspection_id: string;
  verdict: string;
  candidate_actions: string[];
}

export interface PromotePheromoneResponse {
  success: boolean;
  status: 'accepted';
  pheromone_id: string;
  target_kind: string;
  target_id: string;
}

export interface PheromoneDetailResponse {
  success: boolean;
  pheromone_id: string;
  status: string;
  signal_type: string;
  rationale: string | null;
  anchor: {
    anchor_id: string;
    anchor_kind: string;
    resource_uri: string;
    resource_label: string | null;
    locator_json: Record<string, unknown>;
    anchor_text: string | null;
  };
  latest_inspection: {
    inspection_id: string;
    verdict: string;
    candidate_actions: string[];
    created_at: string | null;
  } | null;
  related_entities: Array<{
    id: string;
    label: string;
    type: string;
    relation: string;
  }>;
}

export interface ResolveAnchorResponse {
  success: boolean;
  anchor_id: string;
  resolved: boolean;
  confidence: number;
  current_locator_json: Record<string, unknown>;
  current_snippet: string | null;
  drift_detected: boolean;
}

export async function createPheromone(payload: CreatePheromoneRequest): Promise<CreatePheromoneResponse> {
  return backendRequest<CreatePheromoneResponse>('/api/pheromones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPheromone(id: string): Promise<PheromoneDetailResponse> {
  return backendRequest<PheromoneDetailResponse>(`/api/pheromones/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export async function inspectPheromone(id: string): Promise<InspectPheromoneResponse> {
  return backendRequest<InspectPheromoneResponse>(`/api/pheromones/${encodeURIComponent(id)}/inspect`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function promotePheromone(
  id: string,
  targetKind: 'innovation_ticket' | 'training_proposal' | 'contradiction_review',
): Promise<PromotePheromoneResponse> {
  return backendRequest<PromotePheromoneResponse>(`/api/pheromones/${encodeURIComponent(id)}/promote`, {
    method: 'POST',
    body: JSON.stringify({ target_kind: targetKind }),
  });
}

export async function resolveAnchor(anchorId: string): Promise<ResolveAnchorResponse> {
  return backendRequest<ResolveAnchorResponse>(`/api/anchors/resolve?anchor_id=${encodeURIComponent(anchorId)}`, {
    method: 'GET',
  });
}
