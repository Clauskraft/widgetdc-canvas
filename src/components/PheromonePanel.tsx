import { useMemo, useState } from 'react';
import {
  createPheromone,
  inspectPheromone,
  promotePheromone,
  type PheromoneSignalType,
} from '../lib/api';

const SIGNAL_TYPES: PheromoneSignalType[] = [
  'risk',
  'novelty',
  'question',
  'claim',
  'contradiction',
  'breaking_change',
  'opportunity',
  'attention',
];

export function PheromonePanel() {
  const [signalType, setSignalType] = useState<PheromoneSignalType>('risk');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('Ready');
  const [pheromoneId, setPheromoneId] = useState<string | null>(null);

  const anchor = useMemo(() => ({
    anchor_kind: 'web-url' as const,
    resource_uri: window.location.href,
    resource_label: 'widgetdc-canvas',
    locator_json: {
      pathname: window.location.pathname,
      search: window.location.search,
      surface: 'canvas',
    },
    anchor_text: note.trim() || undefined,
  }), [note]);

  async function placePheromone(): Promise<void> {
    setBusy(true);
    setStatus('Placing...');
    try {
      const result = await createPheromone({
        anchor,
        signal_type: signalType,
        rationale: note.trim() || undefined,
        created_by: 'canvas-operator',
        client_surface: 'canvas',
        strength: 0.72,
      });
      setPheromoneId(result.pheromone_id);
      setStatus(`Placed ${result.pheromone_id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to place pheromone');
    } finally {
      setBusy(false);
    }
  }

  async function inspectLatest(): Promise<void> {
    if (!pheromoneId) return;
    setBusy(true);
    setStatus('Inspecting...');
    try {
      const result = await inspectPheromone(pheromoneId);
      setStatus(`Verdict: ${result.verdict}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to inspect pheromone');
    } finally {
      setBusy(false);
    }
  }

  async function promoteLatest(): Promise<void> {
    if (!pheromoneId) return;
    setBusy(true);
    setStatus('Promoting...');
    try {
      const result = await promotePheromone(pheromoneId, 'innovation_ticket');
      setStatus(`Promoted ${result.target_id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to promote pheromone');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: 280,
        padding: 12,
        borderRadius: 10,
        background: 'rgba(247, 244, 236, 0.96)',
        border: '1px solid rgba(22, 32, 36, 0.15)',
        boxShadow: '0 12px 32px rgba(22, 32, 36, 0.16)',
        backdropFilter: 'blur(8px)',
        zIndex: 20,
      }}
    >
      <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>
        Operator pheromone
      </div>
      <select
        value={signalType}
        onChange={(event) => setSignalType(event.target.value as PheromoneSignalType)}
        style={{ width: '100%', marginBottom: 8, padding: '8px 10px' }}
      >
        {SIGNAL_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Why does this locus matter?"
        rows={3}
        style={{ width: '100%', resize: 'vertical', marginBottom: 8, padding: '8px 10px' }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void placePheromone()} disabled={busy}>
          Place
        </button>
        <button type="button" onClick={() => void inspectLatest()} disabled={busy || !pheromoneId}>
          Inspect
        </button>
        <button type="button" onClick={() => void promoteLatest()} disabled={busy || !pheromoneId}>
          Promote
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--sc-ink-fog)' }}>{status}</div>
    </div>
  );
}
