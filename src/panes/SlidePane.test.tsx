// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SlidePane } from './SlidePane';
import { useCanvasSession } from '../state/canvasSession';
import type { SlideItem } from '../types/session';

function resetSessionStore() {
  useCanvasSession.setState(useCanvasSession.getInitialState(), true);
}

function seedSlides(slides: SlideItem[]) {
  const doc = useCanvasSession.getState().panes.slides.crdtDoc;
  doc.transact(() => {
    const arr = doc.getArray<SlideItem>('slides');
    arr.delete(0, arr.length);
    arr.insert(0, slides);
  }, 'test-seed');
}

describe('SlidePane', () => {
  beforeEach(() => {
    resetSessionStore();
  });

  it('renders the default empty state without seeded slides', () => {
    useCanvasSession.setState({
      canvasSessionId: 'session-default',
      track: 'slide_flow',
    });

    render(<SlidePane />);

    expect(screen.getByText('Slides · SlidePane')).toBeTruthy();
    expect(screen.getByText(/No content seeded yet/i)).toBeTruthy();
    expect(screen.getByText(/session session-.*arrow-key nav/i)).toBeTruthy();
  });

  it('renders and navigates hydrated slides from the CRDT document', async () => {
    useCanvasSession.setState({
      canvasSessionId: 'session-slidepane',
      track: 'slide_flow',
    });

    seedSlides([
      {
        id: 'slide-01',
        title: 'Follow the Money',
        body: 'Trace the flow from source to sink.',
        notes: 'Watch procurement relationships.',
      },
      {
        id: 'slide-02',
        title: 'WorkRun Projection',
        body: 'Show WorkSpec, WorkItems, and Artifacts together.',
        notes: '',
      },
    ]);

    render(<SlidePane />);

    expect(screen.getByRole('region', { name: /Slide 1 of 2: Follow the Money/i })).toBeTruthy();
    expect(screen.getByText('Trace the flow from source to sink.')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    });

    expect(screen.getByRole('region', { name: /Slide 2 of 2: WorkRun Projection/i })).toBeTruthy();
    expect(screen.getByText('Show WorkSpec, WorkItems, and Artifacts together.')).toBeTruthy();

    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText(/Slide pane/i), { key: 'ArrowLeft' });
    });

    expect(screen.getByRole('region', { name: /Slide 1 of 2: Follow the Money/i })).toBeTruthy();
  });
});
