import { useMemo, useState } from 'react';
import {
  fetchPatternPalette,
  graphNeighborSearch,
  graphSearch,
  graphTextSearch,
  mcpCall,
} from '../lib/api';

type ResearchChannel = 'adaptive_rag' | 'srag' | 'kg_rag' | 'graph_search' | 'pattern_palette';

interface ResearchResult {
  id: string;
  scope: string;
  name: string;
  description: string;
  score: number | null;
  source: string;
  evidenceKey: string;
}

function normalizeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return String(
      record.name ??
        record.label ??
        record.title ??
        record.summary ??
        record.description ??
        record.id ??
        '[object]',
    );
  }
  return '';
}

function parseMcpResults(channel: string, payload: unknown): ResearchResult[] {
  if (Array.isArray(payload)) {
    return payload.map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const name = normalizeText(row.name ?? row.label ?? row.title ?? row.id);
      return {
        id: `${channel}:${index}:${name}`,
        scope: channel,
        name,
        description: normalizeText(row.summary ?? row.description ?? row.source ?? row.evidence ?? ''),
        score: typeof row.score === 'number' ? row.score : typeof row.relevance === 'number' ? row.relevance : null,
        source: normalizeText(row.source ?? row.type ?? channel),
        evidenceKey: name,
      };
    });
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const nested = record.results ?? record.items ?? record.rows ?? record.data;
    if (Array.isArray(nested)) {
      return parseMcpResults(channel, nested);
    }
    return [
      {
        id: `${channel}:singleton`,
        scope: channel,
        name: normalizeText(record.name ?? record.label ?? record.title ?? channel),
        description: normalizeText(record.summary ?? record.description ?? record.result ?? ''),
        score: typeof record.score === 'number' ? record.score : null,
        source: normalizeText(record.source ?? channel),
        evidenceKey: normalizeText(record.name ?? record.label ?? record.title ?? channel),
      },
    ];
  }

  if (typeof payload === 'string' && payload.trim()) {
    return [
      {
        id: `${channel}:text`,
        scope: channel,
        name: channel,
        description: payload.trim(),
        score: null,
        source: channel,
        evidenceKey: channel,
      },
    ];
  }

  return [];
}

async function runChannel(
  channel: ResearchChannel,
  query: string,
): Promise<ResearchResult[]> {
  switch (channel) {
    case 'graph_search': {
      const results = await graphSearch(query, { limit: 8 });
      return results.map((item) => ({
        id: `${channel}:${item.id}`,
        scope: 'graph',
        name: item.label,
        description: `${item.type} · score ${item.score.toFixed(2)}`,
        score: item.score,
        source: item.type,
        evidenceKey: item.label,
      }));
    }
    case 'pattern_palette': {
      const rows = await fetchPatternPalette(200);
      return rows
        .filter((row) =>
          `${row.name} ${row.semantic_summary ?? ''}`.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 8)
        .map((row) => ({
          id: `${channel}:${row.id}`,
          scope: 'pattern',
          name: row.name,
          description: row.semantic_summary ?? 'Pattern palette match',
          score: null,
          source: 'Pattern',
          evidenceKey: row.name,
        }));
    }
    case 'adaptive_rag':
      return parseMcpResults(
        channel,
        await mcpCall('adaptive_rag_query', { query, max_results: 8 }),
      );
    case 'srag':
      return parseMcpResults(channel, await mcpCall('srag.query', { query, max_results: 8 }));
    case 'kg_rag':
      return parseMcpResults(channel, await mcpCall('kg_rag.query', { query, max_results: 8 }));
    default:
      return [];
  }
}

const CHANNELS: Array<{ id: ResearchChannel; label: string }> = [
  { id: 'adaptive_rag', label: 'adaptive_rag' },
  { id: 'srag', label: 'srag' },
  { id: 'kg_rag', label: 'kg_rag' },
  { id: 'graph_search', label: 'graph.search' },
  { id: 'pattern_palette', label: 'pattern palette' },
];

export function ResearchPane() {
  const [query, setQuery] = useState('tri-source arbitration moraine failure memory');
  const [enabled, setEnabled] = useState<Record<ResearchChannel, boolean>>({
    adaptive_rag: true,
    srag: true,
    kg_rag: true,
    graph_search: true,
    pattern_palette: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [selected, setSelected] = useState<ResearchResult | null>(null);
  const [evidenceRows, setEvidenceRows] = useState<unknown[]>([]);

  const activeChannels = useMemo(
    () => CHANNELS.filter((channel) => enabled[channel.id]),
    [enabled],
  );

  async function runResearch(): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed || activeChannels.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const settled = await Promise.allSettled(
        activeChannels.map((channel) => runChannel(channel.id, trimmed)),
      );
      const merged = settled.flatMap((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        return [
          {
            id: `error:${activeChannels[index]?.id ?? index}`,
            scope: activeChannels[index]?.label ?? 'channel',
            name: activeChannels[index]?.label ?? 'channel',
            description:
              result.reason instanceof Error ? result.reason.message : String(result.reason),
            score: null,
            source: 'error',
            evidenceKey: '',
          },
        ];
      });
      setResults(merged);
      setSelected(merged[0] ?? null);
      if (merged[0]?.evidenceKey) {
        const neighbors = await graphNeighborSearch(merged[0].evidenceKey, undefined, 12).catch(() =>
          graphTextSearch(merged[0].evidenceKey, 12),
        );
        setEvidenceRows(neighbors);
      } else {
        setEvidenceRows([]);
      }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'research failed');
      setResults([]);
      setSelected(null);
      setEvidenceRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvidence(item: ResearchResult): Promise<void> {
    setSelected(item);
    if (!item.evidenceKey) {
      setEvidenceRows([]);
      return;
    }
    const neighbors = await graphNeighborSearch(item.evidenceKey, undefined, 12).catch(() =>
      graphTextSearch(item.evidenceKey, 12),
    );
    setEvidenceRows(neighbors);
  }

  return (
    <div
      className="sc-root"
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        height: '100%',
        minHeight: 0,
        background: '#0c0c0c',
        color: '#e6e6e6',
      }}
    >
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #333333' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7a7a7a', marginBottom: '10px' }}>
          Research pane
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                void runResearch();
              }
            }}
            placeholder="query · ⌘↵ execute"
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid #333333',
              color: '#e6e6e6',
              fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
              fontSize: '13px',
              padding: '8px 10px',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void runResearch()}
            style={{
              border: '1px solid #333333',
              background: '#1e1e1e',
              color: '#e6e6e6',
              fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
              fontSize: '11px',
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            run
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', minHeight: 0 }}>
        <div style={{ borderRight: '1px solid #333333', padding: '12px', overflowY: 'auto' }}>
          {CHANNELS.map((channel) => (
            <label
              key={channel.id}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
                fontSize: '12px',
                lineHeight: 1.4,
                marginBottom: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={enabled[channel.id]}
                onChange={() =>
                  setEnabled((current) => ({ ...current, [channel.id]: !current[channel.id] }))
                }
              />
              {channel.label}
            </label>
          ))}
          {error && (
            <div style={{ marginTop: '12px', color: '#d4a44a', fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px' }}>
              {error}
            </div>
          )}
          {loading && (
            <div style={{ marginTop: '12px', color: '#7a7a7a', fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px' }}>
              running…
            </div>
          )}
        </div>

        <div style={{ borderRight: '1px solid #333333', overflowY: 'auto' }}>
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void loadEvidence(item)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderBottom: '1px solid #333333',
                background: selected?.id === item.id ? '#1e1e1e' : 'transparent',
                color: '#e6e6e6',
                padding: '10px 12px',
                cursor: 'pointer',
                fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
              }}
            >
              <div style={{ fontSize: '11px', color: '#7db4ff', marginBottom: '4px' }}>
                [{item.scope}]
              </div>
              <div style={{ fontSize: '13px', marginBottom: '4px' }}>{item.name}</div>
              <div style={{ fontSize: '11px', color: '#7a7a7a' }}>{item.description}</div>
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', padding: '12px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: '10px' }}>
            Evidence trail
          </div>
          {selected && (
            <div style={{ marginBottom: '12px', fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace' }}>
              <div style={{ fontSize: '13px', marginBottom: '4px' }}>{selected.name}</div>
              <div style={{ fontSize: '11px', color: '#7a7a7a' }}>{selected.source}</div>
            </div>
          )}
          {evidenceRows.length === 0 ? (
            <div style={{ fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace', fontSize: '11px', color: '#7a7a7a' }}>
              no evidence loaded
            </div>
          ) : (
            evidenceRows.slice(0, 12).map((row, index) => (
              <pre
                key={`${selected?.id ?? 'evidence'}:${index}`}
                style={{
                  margin: 0,
                  marginBottom: '8px',
                  padding: '8px',
                  border: '1px solid #333333',
                  background: '#111111',
                  color: '#e6e6e6',
                  fontFamily: 'IBM Plex Mono, JetBrains Mono, monospace',
                  fontSize: '11px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(row, null, 2)}
              </pre>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
