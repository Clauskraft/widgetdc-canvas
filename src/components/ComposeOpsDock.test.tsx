// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = {
  composeBomrunId: 'bomrun-123',
  composeAcceptedAt: '2026-04-20T15:00:00.000Z',
  composeSseConnected: true,
  composeOperatorStatus: {
    CT: 'done',
    tensorAB: 'done',
    projectConstraint: 'running',
    assemble: 'idle',
    materialize: 'idle',
  },
  composeEvents: [] as Array<{ topic: string; payload: Record<string, unknown>; receivedAt: string }>,
  patternPalette: [],
  selectedPatternIds: [],
  preSeededNodes: [],
  lineageEdges: [],
  lineageLoading: false,
  fetchPatternPalette: vi.fn().mockResolvedValue(undefined),
  togglePatternSelection: vi.fn(),
  fetchProvenanceForCurrentRun: vi.fn().mockResolvedValue(undefined),
  innovationTickets: [],
  innovationLoading: false,
  innovationActionPendingId: null,
  refreshInnovationBacklog: vi.fn().mockResolvedValue(undefined),
  approveInnovationBacklogItem: vi.fn().mockResolvedValue(undefined),
  rejectInnovationBacklogItem: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../state/canvasSession', () => ({
  useCanvasSession: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

import { ComposeOpsDock } from './ComposeOpsDock';

describe('ComposeOpsDock', () => {
  beforeEach(() => {
    mockState.composeEvents = [];
    mockState.composeOperatorStatus = {
      CT: 'done',
      tensorAB: 'done',
      projectConstraint: 'running',
      assemble: 'idle',
      materialize: 'idle',
    };
  });

  it('renders an arbitration badge when an arbitration event is present', () => {
    mockState.composeEvents = [
      {
        topic: 'composition.arbitration_triggered',
        payload: {
          arbitration_mode: 'strict',
          divergence_index: 0.72,
          rationale: 'Operator signal diverged from graph evidence.',
        },
        receivedAt: '2026-04-20T15:00:01.000Z',
      },
    ];

    render(<ComposeOpsDock />);

    expect(screen.getByText('arbitration triggered')).toBeTruthy();
    expect(screen.getByText('strict · 72%')).toBeTruthy();
  });

  it('does not render an arbitration badge without an arbitration event', () => {
    render(<ComposeOpsDock />);

    expect(screen.queryByText('arbitration triggered')).toBeNull();
  });
});
