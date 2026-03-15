// In dev mode, Vite proxy handles /api → backend (avoids CORS).
// In production, call the backend URL directly; backend CORS explicitly allows Canvas production.
const isDev = import.meta.env.DEV;
const API_URL = isDev ? '' : 'https://backend-production-d3da.up.railway.app';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

export async function mcpCall<T = unknown>(tool: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/mcp/route`, {
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

const RLM_URL = isDev ? '' : (import.meta.env.VITE_RLM_URL ?? '');

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
  const res = await fetch(`${RLM_URL}/reason`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instruction: query,
      context: context ?? {},
      enriched_prompt: query.length > 200 ? query : undefined,
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
    headers: { 'Authorization': `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.tools ?? data ?? []) as ToolDefinition[];
}
