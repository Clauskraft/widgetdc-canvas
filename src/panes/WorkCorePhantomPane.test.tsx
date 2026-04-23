import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkCorePhantomPane } from './WorkCorePhantomPane';

describe('WorkCorePhantomPane', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders WorkCore as a dedicated lane cockpit instead of a freeform node demo', () => {
    render(<WorkCorePhantomPane />);

    expect(screen.getByText('WorkCore Phantom')).toBeInTheDocument();
    expect(screen.getByText('Scalable ontology cockpit for any value factory')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'WorkCore lane board' })).toBeInTheDocument();
    expect(screen.getByText('1. Phantom')).toBeInTheDocument();
    expect(screen.getByText('7. Closure')).toBeInTheDocument();
  });

  it('keeps user intent as a proposal until backend read-back hydrates the snapshot', async () => {
    vi.useFakeTimers();
    render(<WorkCorePhantomPane />);

    fireEvent.change(screen.getByPlaceholderText(/Compile intent/i), {
      target: { value: 'tilføj dependency audit item' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Compile intent/i).closest('form')!);

    expect(screen.queryByText('dependency audit item')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.getAllByText('dependency audit item').length).toBeGreaterThan(0);
    expect(screen.getByText('operator-proposed')).toBeInTheDocument();
    expect(screen.getByText('decompose_work_spec')).toBeInTheDocument();
    expect(screen.getByText('accepted')).toBeInTheDocument();
  });
});
