// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from './AppShell';
import { WorkRunCockpitStrip, naturalPaneForTrack, resolveCockpitUrl, seedWorkRunProjection } from './AppShell';
import { useCanvasStore } from './store/canvasStore';
import { useCanvasSession } from './state/canvasSession';

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
  fetchWorkRunCockpit: vi.fn(),
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

function resetSessionStore() {
  useCanvasSession.setState(useCanvasSession.getInitialState(), true);
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
    resetSessionStore();
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', '/');
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
    window.history.replaceState({}, '', '/?view=knowledge');

    const view = render(<AppShell />);

    await flushEffects();

    expect(useCanvasStore.getState().activeSurface).toBe('knowledge');
    expect(useCanvasStore.getState().knowledgeExplorerMode).toBe(true);
    expect(window.location.search).toBe('?view=knowledge');
    expect(loadTemplateMock).not.toHaveBeenCalled();
    expect(view.getByText('Knowledge Surface')).toBeTruthy();
  });

  it('updates the URL when the shell switches to journal and back to knowledge', async () => {
    render(<AppShell />);

    await act(async () => {
      useCanvasStore.getState().setActiveSurface('journal');
    });

    await flushEffects();

    expect(useCanvasStore.getState().activeSurface).toBe('journal');
    expect(window.location.search).toBe('?view=journal');

    await act(async () => {
      useCanvasStore.getState().setActiveSurface('knowledge');
    });

    await flushEffects();

    expect(useCanvasStore.getState().activeSurface).toBe('knowledge');
    expect(window.location.search).toBe('?view=knowledge');
    expect(useCanvasStore.getState().knowledgeExplorerMode).toBe(true);
  });

  it('renders the legacy command badge in canvas mode', async () => {
    const view = render(<AppShell />);

    await flushEffects();

    expect(view.getByText('Ctrl+K Commands')).toBeTruthy();
  });

  it('renders a frame-aware UC5 shell when additive ProductFrame metadata is present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        track: 'architecture',
        initial_pane: 'canvas',
        canvas_session_id: 'session-12345678',
        embed_url: 'https://canvas.example?session=session-12345678&track=architecture',
        rationale: ['✓ arch-intent: Architecture keywords'],
        bom_version: '2.0',
        resolved_at: '2026-04-23T12:00:00.000Z',
        product_frame_id: 'architecture.system-design',
        domain_profile_id: 'event-driven-platform',
        starter_template_ids: ['pit:architecture:brief-v1'],
        allowed_modes: ['graph', 'diagram', 'document', 'split'],
        required_capability_ids: ['cap:architecture.resolve'],
        required_evaluation_hook_ids: ['eval:architecture.coherence'],
      }),
    }) as any);

    window.history.replaceState({}, '', '/?session=session-12345678&track=architecture&pane=canvas');

    const view = render(<AppShell />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.getByText('WidgeTDC · Unified Canvas · Substrate Cartography')).toBeTruthy();
    expect(view.getByText('Frame · Architecture System Design')).toBeTruthy();
    expect(view.getByText('Domain · event-driven-platform')).toBeTruthy();
    expect(view.getByText('Modes · frame-native')).toBeTruthy();
    expect(view.getByText('1 starter templates')).toBeTruthy();
    expect(view.getByText('1 required capabilities')).toBeTruthy();
    expect(view.getByText('1 evaluation hooks')).toBeTruthy();
  });

  it('uses a canonical track-to-pane unfold map for F4 defaults', () => {
    expect(naturalPaneForTrack('textual')).toBe('markdown');
    expect(naturalPaneForTrack('slide_flow')).toBe('slides');
    expect(naturalPaneForTrack('diagram')).toBe('drawio');
    expect(naturalPaneForTrack('architecture')).toBe('split');
    expect(naturalPaneForTrack('graphical')).toBe('canvas');
    expect(naturalPaneForTrack('code')).toBe('markdown');
    expect(naturalPaneForTrack('experiment')).toBe('split');
  });

  it('renders a live WorkRun cockpit strip when projection data is present', () => {
    const projection = {
      id: 'workrun:follow-the-money:1',
      status: 'COMPLETED',
      brief: 'Follow the money',
      canonical_pattern: 'phantom-core.follow-the-money',
      profile_id: 'profile:finance',
      source_phantom_run_id: 'phantom:follow-the-money:1',
      workspec_id: 'workspec:follow-the-money:1',
      workspec_name: 'Follow the Money spec',
      domain_profile_id: 'domain:finance',
      domain_profile_name: 'Finance Domain',
      all_moves_canonical: true,
      completed_at: '2026-04-24T13:20:03Z',
      workitems: [
        { id: 'workitem:1', title: 'Trace funding paths', status: 'in_progress', kind: 'analysis', order_index: 1 },
      ],
      artifacts: [
        {
          id: 'artifact:1',
          title: 'Centrality map',
          artifact_type: 'diagram',
          status: null,
          trust_scope: 'canonical',
          signing_pubkey: 'WTah4sgubyb32T+9obIRR/ifw9NaNhlWfWuVPul+c3E=',
          verified_at: '2026-04-24T13:20:03Z',
          control_hubs: ['99999901 SMOKE Holding ApS · betweenness=1.0'],
        },
      ],
    };

    const view = render(<WorkRunCockpitStrip projection={projection} />);

    expect(view.getByText('Live WorkRun · workrun:follow-the-money:1')).toBeTruthy();
    expect(view.getByText('Follow the money')).toBeTruthy();
    expect(view.getByText((content) => content.includes('Follow the Money spec'))).toBeTruthy();
    expect(view.getByText(/All moves canonical/i)).toBeTruthy();
    expect(view.getByText(/99999901 SMOKE Holding ApS/i)).toBeTruthy();
    expect(view.getByText(/CANONICAL · WTah4sgu/i)).toBeTruthy();
  });

  it('seeds WorkRun projection context into the canvas store with canonical node types', () => {
    seedWorkRunProjection({
      id: 'workrun:follow-the-money:1',
      status: 'in_progress',
      brief: 'Follow the money',
      canonical_pattern: 'phantom-core.follow-the-money',
      profile_id: 'profile:finance',
      source_phantom_run_id: 'phantom:follow-the-money:1',
      workspec_id: 'workspec:follow-the-money:1',
      workspec_name: 'Follow the Money spec',
      domain_profile_id: 'domain:finance',
      domain_profile_name: 'Finance Domain',
      all_moves_canonical: true,
      completed_at: '2026-04-24T13:20:03Z',
      workitems: [
        { id: 'workitem:1', title: 'Trace funding paths', status: 'in_progress', kind: 'analysis', order_index: 1 },
      ],
      artifacts: [
        {
          id: 'artifact:1',
          title: 'Flow map',
          artifact_type: 'diagram',
          status: null,
          trust_scope: 'canonical',
          signing_pubkey: 'WTah4sgubyb32T+9obIRR/ifw9NaNhlWfWuVPul+c3E=',
          verified_at: '2026-04-24T13:20:03Z',
          control_hubs: ['99999901 SMOKE Holding ApS · betweenness=1.0'],
        },
      ],
    });

    const nodes = useCanvasStore.getState().nodes;
    expect(nodes.some((node) => node.type === 'Track')).toBe(true);
    expect(nodes.some((node) => node.type === 'Decision')).toBe(true);
    expect(nodes.some((node) => node.type === 'Artifact')).toBe(true);
    expect(nodes.some((node) => {
      const metadata = node.data.metadata as Record<string, unknown> | undefined;
      return metadata?.workrunProjectionId === 'workrun:follow-the-money:1';
    })).toBe(true);
    expect(nodes.some((node) => {
      const metadata = node.data.metadata as Record<string, unknown> | undefined;
      return metadata?.trustScope === 'canonical';
    })).toBe(true);
  });
});
