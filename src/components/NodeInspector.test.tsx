// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NodeInspector } from './NodeInspector';
import { useCanvasStore } from '../store/canvasStore';

vi.mock('../lib/layout', () => ({
  applyDagreLayout: (nodes: unknown[]) => nodes,
}));

vi.mock('../lib/api', () => ({
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

function resetStore() {
  useCanvasStore.setState({
    nodes: [
      {
        id: 'node-1',
        type: 'entity',
        position: { x: 0, y: 0 },
        data: {
          label: 'Selected Node',
          subtitle: 'Hook-stable details',
          nodeType: 'entity',
          provenance: {
            createdBy: 'manual',
            createdAt: '2026-03-17T00:00:00.000Z',
            source: 'test',
          },
        },
      },
    ],
    edges: [],
    selectedNodeId: null,
    undoStack: [],
    redoStack: [],
    isLoading: false,
    aiPanelOpen: false,
    toolPaletteOpen: false,
    knowledgeExplorerMode: false,
    gapOverlayMode: false,
    expandStates: new Map(),
    engagementId: null,
    filterState: { relTypes: [], searchText: '' },
    layoutMode: 'freeform',
    canvasId: 'default',
    routingSnapshot: null,
    selectNode: vi.fn(),
    expandNode: vi.fn().mockResolvedValue(undefined),
    matchTenders: vi.fn().mockResolvedValue(undefined),
    removeSelected: vi.fn(),
    crossReference: vi.fn().mockResolvedValue(undefined),
    exportAuditTrail: vi.fn().mockResolvedValue(''),
    recommendNextActions: vi.fn().mockResolvedValue([]),
    syncArtifactNode: vi.fn().mockResolvedValue(undefined),
    applyArtifactAction: vi.fn().mockResolvedValue(undefined),
  } as any);
}

describe('NodeInspector', () => {
  beforeEach(() => {
    resetStore();
  });

  it('remains hook-stable when selection changes from null to a node', async () => {
    const view = render(<NodeInspector />);
    expect(view.queryByText('Selected Node')).toBeNull();

    await act(async () => {
      useCanvasStore.setState({ selectedNodeId: 'node-1' });
    });

    expect(view.getByText('Selected Node')).toBeTruthy();
    expect(view.getByText('Hook-stable details')).toBeTruthy();
  });
});
