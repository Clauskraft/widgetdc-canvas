// In dev mode, Vite proxy handles /api → backend (avoids CORS)
// In production, use the full URL
const isDev = import.meta.env.DEV;
const API_URL = isDev ? '' : (import.meta.env.VITE_API_URL ?? 'https://backend-production-d3da.up.railway.app');
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
