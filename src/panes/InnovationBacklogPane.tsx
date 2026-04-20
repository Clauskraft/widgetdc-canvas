import { useCallback, useEffect, useMemo, useState } from 'react';

type TicketStatus = 'candidate' | 'approved' | 'rejected';
type TicketSeverity = 'high' | 'medium' | 'low';

interface InnovationTicketItem {
  id: string;
  title: string;
  status: TicketStatus;
  divergence_score: number;
  severity: TicketSeverity;
  rationale: string[];
  lifecycle: string;
  updated_at: string | null;
  component_id: string | null;
  blueprint_id: string | null;
  pattern_id: string | null;
  arbitration_decision: string | null;
  arbitration_rationale: string | null;
}

interface InnovationTicketListResponse {
  success: boolean;
  total: number;
  items: InnovationTicketItem[];
  fetched_at: string;
}

interface InnovationTicketMutationResponse {
  success: boolean;
  id: string;
  status: TicketStatus;
  adopted_pattern_id?: string;
  reason?: string;
  updated_at: string;
}

const STATUS_FILTERS: TicketStatus[] = ['candidate', 'approved', 'rejected'];
const BACKEND_FALLBACK = 'https://backend-production-d3da.up.railway.app';

function resolveBackendBase(): string {
  const configured = String(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  return configured || BACKEND_FALLBACK;
}

function resolveApiKey(): string {
  return String(import.meta.env.VITE_API_KEY ?? 'Line&010310').trim();
}

async function fetchTickets(
  backendBase: string,
  apiKey: string,
  status: TicketStatus,
): Promise<InnovationTicketItem[]> {
  const params = new URLSearchParams({
    status,
    limit: '50',
  });
  const response = await fetch(`${backendBase}/api/mrp/innovation-tickets?${params.toString()}`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Innovation ticket fetch failed: ${response.status}`);
  }

  const payload = await response.json() as InnovationTicketListResponse;
  return Array.isArray(payload.items) ? payload.items : [];
}

async function approveTicket(
  backendBase: string,
  apiKey: string,
  id: string,
): Promise<InnovationTicketMutationResponse> {
  const response = await fetch(`${backendBase}/api/mrp/innovation-tickets/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Innovation ticket approve failed: ${response.status}`);
  }

  return response.json() as Promise<InnovationTicketMutationResponse>;
}

async function rejectTicket(
  backendBase: string,
  apiKey: string,
  id: string,
  reason: string,
): Promise<InnovationTicketMutationResponse> {
  const response = await fetch(`${backendBase}/api/mrp/innovation-tickets/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error(`Innovation ticket reject failed: ${response.status}`);
  }

  return response.json() as Promise<InnovationTicketMutationResponse>;
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function InnovationBacklogPane() {
  const [status, setStatus] = useState<TicketStatus>('candidate');
  const [tickets, setTickets] = useState<InnovationTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const backendBase = useMemo(resolveBackendBase, []);
  const apiKey = useMemo(resolveApiKey, []);

  const loadTickets = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTickets(backendBase, apiKey, status)
      .then((items) => {
        setTickets(items);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load innovation backlog');
        setTickets([]);
        setLoading(false);
      });
  }, [apiKey, backendBase, status]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const mutate = useCallback(async (id: string, action: 'approve' | 'reject') => {
    setMutatingId(id);
    setError(null);
    try {
      const result = action === 'approve'
        ? await approveTicket(backendBase, apiKey, id)
        : await rejectTicket(backendBase, apiKey, id, 'rejected-by-canvas-operator');

      setTickets((current) => current.map((ticket) => (
        ticket.id === id
          ? {
              ...ticket,
              status: result.status,
              updated_at: result.updated_at,
            }
          : ticket
      )));

      if (result.status !== status) {
        setTickets((current) => current.filter((ticket) => ticket.id !== id));
      }
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Mutation failed');
    } finally {
      setMutatingId(null);
    }
  }, [apiKey, backendBase, status]);

  return (
    <div
      className="sc-root innovation-backlog-pane"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 'var(--sc-pane-pad)',
        background: 'var(--sc-surface-bg)',
        overflowY: 'auto',
      }}
    >
      <div className="sc-pane-head" style={{ marginBottom: '18px' }}>
        <span className="sc-pane-label" style={{ color: 'var(--sc-track-code)' }}>
          Innovation Backlog
        </span>
        <span className="sc-pane-meta">graph-native ticket triage · approve / reject</span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '16px',
          alignItems: 'center',
        }}
      >
        {STATUS_FILTERS.map((filter) => {
          const active = filter === status;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setStatus(filter)}
              aria-pressed={active}
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: 'var(--sc-tracking-label)',
                textTransform: 'uppercase',
                color: active ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-fog)',
                background: active ? 'var(--sc-paper-deep)' : 'transparent',
                border: '0.5px solid',
                borderColor: active ? 'var(--sc-ink-graphite)' : 'var(--sc-paper-whisper)',
                borderRadius: 'var(--sc-radius-sm)',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              {filter}
            </button>
          );
        })}

        <button
          type="button"
          onClick={loadTickets}
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: 'var(--sc-tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-stone)',
            background: 'transparent',
            border: '0.5px solid var(--sc-paper-whisper)',
            borderRadius: 'var(--sc-radius-sm)',
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          refresh
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: '14px',
            padding: '10px 12px',
            borderRadius: 'var(--sc-radius-sm)',
            border: '0.5px solid #d6b59b',
            background: '#fff5eb',
            color: '#8a4b22',
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '10px',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            color: 'var(--sc-ink-fog)',
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '10px',
          }}
        >
          loading innovation backlog…
        </div>
      ) : tickets.length === 0 ? (
        <div
          style={{
            color: 'var(--sc-ink-fog)',
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '10px',
            border: '0.5px dashed var(--sc-paper-whisper)',
            borderRadius: 'var(--sc-radius-md)',
            padding: '18px',
          }}
        >
          No {status} innovation tickets.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {tickets.map((ticket) => {
            const disabled = mutatingId === ticket.id;
            return (
              <article
                key={ticket.id}
                style={{
                  border: '0.5px solid var(--sc-paper-whisper)',
                  borderRadius: 'var(--sc-radius-md)',
                  background: 'var(--sc-surface-elevated)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--sc-font-mono)',
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'var(--sc-ink-fog)',
                        marginBottom: '4px',
                      }}
                    >
                      {ticket.id}
                    </div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '15px',
                        fontWeight: 500,
                        color: 'var(--sc-ink-graphite)',
                      }}
                    >
                      {ticket.title}
                    </h3>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={badgeStyle(ticket.severity === 'high' ? '#7a3220' : ticket.severity === 'medium' ? '#7a5a20' : '#355f3b', ticket.severity)}>
                      {ticket.severity}
                    </span>
                    <span style={badgeStyle('var(--sc-ink-fog)', ticket.status)}>
                      {ticket.status}
                    </span>
                    <span style={badgeStyle('var(--sc-track-code)', `${Math.round(ticket.divergence_score * 100)} divergence`)}>
                      {Math.round(ticket.divergence_score * 100)} divergence
                    </span>
                  </div>
                </div>

                {ticket.rationale.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--sc-ink-stone)', fontSize: '13px' }}>
                    {ticket.rationale.slice(0, 3).map((item, index) => (
                      <li key={`${ticket.id}-rationale-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}

                <div
                  title={ticket.arbitration_rationale ?? undefined}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '8px 14px',
                    fontFamily: 'var(--sc-font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.05em',
                    color: 'var(--sc-ink-fog)',
                  }}
                >
                  <div>component: {ticket.component_id ?? 'n/a'}</div>
                  <div>blueprint: {ticket.blueprint_id ?? 'n/a'}</div>
                  <div>pattern: {ticket.pattern_id ?? 'n/a'}</div>
                  <div>arbitration: {ticket.arbitration_decision ?? 'n/a'}</div>
                  <div>lifecycle: {ticket.lifecycle}</div>
                  <div>updated: {formatUpdatedAt(ticket.updated_at)}</div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={disabled || ticket.status === 'approved'}
                    onClick={() => { void mutate(ticket.id, 'approve'); }}
                    style={actionButtonStyle(disabled || ticket.status === 'approved')}
                  >
                    approve
                  </button>
                  <button
                    type="button"
                    disabled={disabled || ticket.status === 'rejected'}
                    onClick={() => { void mutate(ticket.id, 'reject'); }}
                    style={actionButtonStyle(disabled || ticket.status === 'rejected')}
                  >
                    reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function badgeStyle(color: string, label: string) {
  return {
    fontFamily: 'var(--sc-font-mono)',
    fontSize: '8px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color,
    border: `0.5px solid ${color}`,
    borderRadius: '999px',
    padding: '3px 8px',
    whiteSpace: 'nowrap' as const,
  };
}

function actionButtonStyle(disabled: boolean) {
  return {
    fontFamily: 'var(--sc-font-mono)',
    fontSize: '9px',
    letterSpacing: 'var(--sc-tracking-label)',
    textTransform: 'uppercase' as const,
    color: disabled ? 'var(--sc-paper-whisper)' : 'var(--sc-ink-stone)',
    background: 'transparent',
    border: '0.5px solid var(--sc-paper-whisper)',
    borderRadius: 'var(--sc-radius-sm)',
    padding: '5px 10px',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
