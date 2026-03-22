// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Journal } from './Journal';

const addNodeWithDataMock = vi.fn();
const toastMock = vi.fn();
const setBoldMock = vi.fn();

let selectedText = '';

vi.mock('@tiptap/react', () => ({
  useEditor: () => ({
    state: {
      selection: { from: selectedText ? 1 : 0, to: selectedText ? 2 : 0 },
      doc: {
        textBetween: () => selectedText,
      },
    },
    commands: {
      setBold: setBoldMock,
      insertContent: vi.fn(),
    },
  }),
  EditorContent: () => <div>Editor Content</div>,
}));

vi.mock('../store/canvasStore', () => ({
  useCanvasStore: () => ({
    addNodeWithData: addNodeWithDataMock,
    _toast: toastMock,
  }),
}));

vi.mock('../lib/connectors', () => ({
  syncRemarkableNotes: vi.fn().mockResolvedValue([]),
}));

describe('Journal', () => {
  beforeEach(() => {
    selectedText = '';
    addNodeWithDataMock.mockReset();
    toastMock.mockReset();
    setBoldMock.mockReset();
  });

  it('explains that Send to Canvas requires a selection', () => {
    const view = render(<Journal isVisible={true} onFlip={vi.fn()} />);

    expect(view.getByText(/Select text to send it to Canvas/i)).toBeTruthy();
  });

  it('shows an info toast instead of silently no-oping when nothing is selected', async () => {
    const onFlip = vi.fn();
    const view = render(<Journal isVisible={true} onFlip={onFlip} />);

    view.getByRole('button', { name: /Send to Canvas/i }).click();

    expect(addNodeWithDataMock).not.toHaveBeenCalled();
    expect(onFlip).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith('info', 'Select text in the journal before sending it to Canvas.');
  });

  it('creates an insight node and flips back to canvas when text is selected', async () => {
    selectedText = 'Selected journal excerpt for canvas';
    const onFlip = vi.fn();
    const view = render(<Journal isVisible={true} onFlip={onFlip} />);

    view.getByRole('button', { name: /Send to Canvas/i }).click();

    expect(addNodeWithDataMock).toHaveBeenCalledTimes(1);
    expect(addNodeWithDataMock).toHaveBeenCalledWith(
      'insight',
      expect.objectContaining({
        label: 'Selected journal excerpt for canvas',
        subtitle: 'Selected journal excerpt for canvas',
        nodeType: 'Insight',
      }),
    );
    expect(setBoldMock).toHaveBeenCalled();
    expect(onFlip).toHaveBeenCalled();
  });
});
