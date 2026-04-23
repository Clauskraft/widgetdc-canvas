// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';
import { resolveCockpitUrl } from './AppShell';
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

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('AppShell', () => {
  beforeEach(() => {
    loadTemplateMock.mockClear();
    resetStore();
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/?legacy=1');
  });

  it('resolves the cockpit URL from env when configured', () => {
    vi.stubEnv('VITE_COCKPIT_URL', 'https://cockpit.example/path/');

    expect(resolveCockpitUrl()).toBe('https://cockpit.example/path');
  });

  it('falls back to the proxied consulting cockpit stats route', () => {
    vi.stubEnv('VITE_COCKPIT_URL', '');

    expect(resolveCockpitUrl()).toBe('/api/consulting-cockpit/stats');
  });

  it('hydrates the knowledge surface from the query string', async () => {
    window.history.replaceState({}, '', '/?legacy=1&view=knowledge');

    const view = render(<AppShell />);

    await flushEffects();

    expect(useCanvasStore.getState().activeSurface).toBe('knowledge');
    expect(useCanvasStore.getState().knowledgeExplorerMode).toBe(true);
    expect(window.location.search).toBe('?legacy=1&view=knowledge');
    expect(loadTemplateMock).not.toHaveBeenCalled();
    expect(view.getByText('Knowledge Surface')).toBeTruthy();
  });

  it('updates the URL when the legacy shell surface changes', async () => {
    render(<AppShell />);

    await act(async () => {
      useCanvasStore.getState().setActiveSurface('journal');
    });

    await flushEffects();

    expect(useCanvasStore.getState().activeSurface).toBe('journal');
    expect(window.location.search).toBe('?legacy=1&view=journal');

    await act(async () => {
      useCanvasStore.getState().setActiveSurface('knowledge');
    });

    await flushEffects();

    expect(useCanvasStore.getState().activeSurface).toBe('knowledge');
    expect(window.location.search).toBe('?legacy=1&view=knowledge');
    expect(useCanvasStore.getState().knowledgeExplorerMode).toBe(true);
  });

  it('renders the legacy canvas shell when explicitly requested', async () => {
    const view = render(<AppShell />);

    await flushEffects();

    expect(view.getByText('WidgeTDC Canvas')).toBeTruthy();
    expect(view.getByText('Canvas Surface')).toBeTruthy();
  });
});

