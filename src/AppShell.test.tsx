// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';
import { useCanvasStore } from './store/canvasStore';

vi.mock('./components/Canvas', () => ({
  Canvas: () => <div>Canvas Surface</div>,
}));

vi.mock('./components/CanvasCollaboration', () => ({
  CanvasCollaboration: () => <div>Canvas Collaboration</div>,
}));

vi.mock('./components/Toolbar', () => ({
  Toolbar: () => <div>Toolbar</div>,
}));

vi.mock('./components/AIPanel', () => ({
  AIPanel: () => <div>AI Panel</div>,
}));

vi.mock('./components/ToolPalette', () => ({
  ToolPalette: () => <div>Tool Palette</div>,
}));

vi.mock('./components/StatusBar', () => ({
  StatusBar: () => <div>Status Bar</div>,
}));

vi.mock('./components/NodeInspector', () => ({
  NodeInspector: () => <div>Node Inspector</div>,
}));

vi.mock('./components/CommandPalette', () => ({
  CommandPalette: () => <div>Command Palette</div>,
}));

vi.mock('./components/Journal', () => ({
  Journal: ({ isVisible }: { isVisible: boolean }) => (
    <div>{isVisible ? 'Journal Visible' : 'Journal Hidden'}</div>
  ),
}));

vi.mock('./components/Toast', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('./components/SnoutObserver', () => ({
  SnoutObserver: () => <div>Snout Observer</div>,
}));

vi.mock('./lib/layout', () => ({
  applyDagreLayout: (nodes: unknown[]) => nodes,
}));

vi.mock('./lib/api', () => ({
  graphRead: vi.fn().mockResolvedValue([]),
  graphWrite: vi.fn().mockResolvedValue({ success: true }),
  graphExpand: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
  graphNeighborSearch: vi.fn().mockResolvedValue([]),
  mcpCall: vi.fn().mockResolvedValue({ success: true }),
  fetchArtifactSurface: vi.fn(),
  applyArtifactSurfaceAction: vi.fn(),
  fetchLibreChatRuntimeIntelligence: vi.fn(),
  fetchOrchestratorRoutingSnapshot: vi.fn(),
  reasonCall: vi.fn().mockResolvedValue({
    recommendation: 'Test recommendation',
    thinking_steps: ['Step 1'],
    confidence: 0.85,
    sources: [],
  }),
  isComplianceQuery: vi.fn().mockReturnValue(false),
  getComplianceGaps: vi.fn().mockResolvedValue([]),
}));

const loadTemplateMock = vi.fn().mockResolvedValue(undefined);

function resetStore() {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    undoStack: [],
    redoStack: [],
    selectedNodeId: null,
    isLoading: false,
    aiPanelOpen: false,
    toolPaletteOpen: false,
    activeSurface: 'canvas',
    knowledgeExplorerMode: false,
    gapOverlayMode: false,
    expandStates: new Map(),
    engagementId: null,
    filterState: { relTypes: [], searchText: '' },
    layoutMode: 'freeform',
    canvasId: 'default',
    routingSnapshot: null,
    governanceSnapshot: null,
    loadTemplate: loadTemplateMock,
    _toast: undefined,
  } as any);
}

describe('AppShell', () => {
  beforeEach(() => {
    loadTemplateMock.mockClear();
    resetStore();
    window.history.replaceState({}, '', '/');
  });

  it('hydrates the knowledge surface from the query string', async () => {
    window.history.replaceState({}, '', '/?view=knowledge');

    render(<AppShell />);

    await waitFor(() => {
      expect(useCanvasStore.getState().activeSurface).toBe('knowledge');
    });

    expect(useCanvasStore.getState().knowledgeExplorerMode).toBe(true);
    expect(window.location.search).toBe('?view=knowledge');
    expect(loadTemplateMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Viden' })).toBeTruthy();
  });

  it('updates the URL when the shell switches to journal and back to knowledge', async () => {
    render(<AppShell />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Notesblok' }));
    });

    await waitFor(() => {
      expect(useCanvasStore.getState().activeSurface).toBe('journal');
    });
    expect(window.location.search).toBe('?view=journal');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Viden' }));
    });

    await waitFor(() => {
      expect(useCanvasStore.getState().activeSurface).toBe('knowledge');
    });
    expect(window.location.search).toBe('?view=knowledge');
    expect(useCanvasStore.getState().knowledgeExplorerMode).toBe(true);
  });
});
