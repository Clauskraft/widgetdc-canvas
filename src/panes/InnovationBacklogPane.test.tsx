import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InnovationBacklogPane } from './InnovationBacklogPane';

const originalFetch = global.fetch;

describe('InnovationBacklogPane', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'https://backend.example');
    vi.stubEnv('VITE_API_KEY', 'Line&010310');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.fetch = originalFetch;
  });

  it('loads and renders candidate innovation tickets', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        total: 1,
        items: [
          {
            id: 'innovation:tactical:moraine',
            title: 'Moraine failure memory upgrade',
            status: 'candidate',
            divergence_score: 0.89,
            severity: 'high',
            rationale: ['Trace database recall improves arbitration fidelity.'],
            lifecycle: 'ingested',
            updated_at: '2026-04-20T15:00:00Z',
            component_id: 'phcomp:repo:microsoft-autogen',
            blueprint_id: 'blueprint:tactical:eric-tramel-moraine',
            pattern_id: 'pattern:tactical:moraine',
            arbitration_decision: 'escalate',
            arbitration_rationale: 'High divergence and strong external precedent.',
          },
        ],
        fetched_at: '2026-04-20T15:01:00Z',
      }),
    }) as typeof fetch;

    render(<InnovationBacklogPane />);

    expect(await screen.findByText('Moraine failure memory upgrade')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('89 divergence')).toBeInTheDocument();
  });

  it('approves a ticket and removes it from the candidate list', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          total: 1,
          items: [
            {
              id: 'innovation:tactical:moraine',
              title: 'Moraine failure memory upgrade',
              status: 'candidate',
              divergence_score: 0.89,
              severity: 'high',
              rationale: ['Trace database recall improves arbitration fidelity.'],
              lifecycle: 'ingested',
              updated_at: '2026-04-20T15:00:00Z',
              component_id: null,
              blueprint_id: null,
              pattern_id: null,
              arbitration_decision: null,
              arbitration_rationale: null,
            },
          ],
          fetched_at: '2026-04-20T15:01:00Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          id: 'innovation:tactical:moraine',
          status: 'approved',
          adopted_pattern_id: 'adopted:innovation:tactical:moraine',
          updated_at: '2026-04-20T15:02:00Z',
        }),
      }) as typeof fetch;

    render(<InnovationBacklogPane />);

    fireEvent.click(await screen.findByRole('button', { name: 'approve' }));

    await waitFor(() => {
      expect(screen.getByText('No candidate innovation tickets.')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
