/**
 * Handle orchestrator tool-output folding.
 *
 * When an MCP tool response exceeds the fold-threshold (typically 1.5KB),
 * the orchestrator returns a truncated preview with a `📄 Full output`
 * marker + de-ref URL that resolves to the complete payload.
 *
 * Pattern seen in `/api/tools/*` responses:
 *   {"success":true,"data":{"result":"{...truncated JSON...}\n\n📄 Full output (1.5KB, 1494 chars) — expires in 24h:\nhttps://orchestrator-production-c27e.up.railway.app/api/tool-output/<uuid>","was_folded":true,...}}
 *
 * The de-ref endpoint returns the full content under `data.content` as a
 * JSON string.
 */
export type MaybeFoldedResult<T> =
  | { kind: 'parsed'; value: T }
  | { kind: 'folded'; url: string }
  | { kind: 'unparseable' };

const FOLD_URL_REGEX =
  /📄\s*Full output[^\n]*\n(https:\/\/\S+\/api\/tool-output\/[0-9a-f-]+)/;

/**
 * Try to parse rawResult as JSON. If it fails, look for a fold-marker URL.
 * Returns one of three kinds so the caller can branch.
 */
export function classifyToolOutput<T = unknown>(
  rawResult: unknown,
): MaybeFoldedResult<T> {
  if (rawResult == null) return { kind: 'unparseable' };

  if (typeof rawResult === 'object') {
    return { kind: 'parsed', value: rawResult as T };
  }

  if (typeof rawResult !== 'string') {
    return { kind: 'unparseable' };
  }

  // First pass: try direct JSON parse (small / non-folded responses)
  try {
    return { kind: 'parsed', value: JSON.parse(rawResult) as T };
  } catch {
    // fall through
  }

  // Second pass: look for fold marker + de-ref URL
  const match = rawResult.match(FOLD_URL_REGEX);
  if (match && match[1]) {
    return { kind: 'folded', url: match[1] };
  }

  return { kind: 'unparseable' };
}

/**
 * Fetch a de-ref URL and extract the parsed content.
 * De-ref envelope shape: {success, data: {$id, tool_name, content: <json-string>, size_bytes, ...}}
 */
export async function dereferenceFoldedOutput<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`de-ref fetch HTTP ${res.status}`);
  }
  const envelope = (await res.json()) as {
    success?: boolean;
    data?: { content?: unknown };
  };
  const content = envelope?.data?.content;
  if (content == null) {
    throw new Error('de-ref response missing data.content');
  }
  if (typeof content === 'string') {
    return JSON.parse(content) as T;
  }
  return content as T;
}

/**
 * Convenience helper: parse rawResult, de-ref if folded, return final parsed value.
 * Throws if response is unparseable or de-ref fails.
 */
export async function resolveToolOutput<T = unknown>(
  rawResult: unknown,
  init?: RequestInit,
): Promise<T> {
  const classified = classifyToolOutput<T>(rawResult);
  if (classified.kind === 'parsed') return classified.value;
  if (classified.kind === 'folded') {
    return dereferenceFoldedOutput<T>(classified.url, init);
  }
  throw new Error('tool output is unparseable (neither valid JSON nor fold-marker URL)');
}
