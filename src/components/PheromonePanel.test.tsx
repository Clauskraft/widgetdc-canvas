import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PheromonePanel } from './PheromonePanel';

const {
  createPheromoneMock,
  inspectPheromoneMock,
  promotePheromoneMock,
} = vi.hoisted(() => ({
  createPheromoneMock: vi.fn(),
  inspectPheromoneMock: vi.fn(),
  promotePheromoneMock: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  createPheromone: createPheromoneMock,
  inspectPheromone: inspectPheromoneMock,
  promotePheromone: promotePheromoneMock,
}));

describe('PheromonePanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('places an operator-anchored pheromone from the active canvas locus', async () => {
    createPheromoneMock.mockResolvedValue({
      pheromone_id: 'pheromone-1',
    });

    render(<PheromonePanel />);

    fireEvent.change(screen.getByPlaceholderText('Why does this locus matter?'), {
      target: { value: 'Operator sees a risky locus.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Place' }));

    await waitFor(() => {
      expect(createPheromoneMock).toHaveBeenCalledWith(expect.objectContaining({
        signal_type: 'risk',
        client_surface: 'canvas',
        created_by: 'canvas-operator',
      }));
    });

    expect(createPheromoneMock.mock.calls[0]?.[0]?.anchor).toEqual(expect.objectContaining({
      anchor_kind: 'web-url',
      resource_uri: window.location.href,
    }));
    expect(await screen.findByText('Placed pheromone-1')).toBeTruthy();
  });
});
