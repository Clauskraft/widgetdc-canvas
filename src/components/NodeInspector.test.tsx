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
        type: 'Entity',
        position: { x: 0, y: 0 },
        data: {
          label: 'Selected Node',
          subtitle: 'Hook-stable details',
          nodeType: 'Entity',
          provenance: {
            createdBy: 'manual',
            createdAt: '2026-03-17T00:00:00.000Z',
            source: 'test',
          },
        },
      },
      {
        id: 'artifact-1',
        type: 'Artifact',
        position: { x: 80, y: 40 },
        data: {
          label: 'Decision Pack',
          nodeType: 'Artifact',
          artifactId: 'artifact-1',
          reviewState: 'export_ready',
          renderPackageId: 'renderpkg-1',
          renderContract: 'foundry.render.sections.v1',
          sourceGraphNodeId: 'assembly-1',
          sourceGraphLabels: ['AssemblyCandidate'],
          provenance: {
            createdBy: 'ai',
            createdAt: '2026-03-17T10:00:00.000Z',
            source: 'canvas',
            tool: 'graph.search',
            confidence: 0.91,
          },
          metadata: {
            verificationStatus: 'verified',
            surfaceOrigin: 'graph.search',
            routeToContract: 'canvas -> foundry.render.sections.v1',
          },
        },
      },
      {
        id: 'governance-1',
        type: 'Track',
        position: { x: 120, y: 80 },
        data: {
          label: 'Downstream Evaluation',
          nodeType: 'Track',
          governanceScorecard: {
            verifiedDecisions: 12,
            acceptanceRate: 0.8,
            routedDecisionCoverage: 0.95,
            oodaRunEvents: 5,
            oodaFallbackRate: 0,
            oodaAverageDurationMs: 1765,
          },
          legoFactorySummary: {
            blocked: 1,
            promotable: 3,
            waiting: 2,
            outputCount: 4,
          },
          memoryGovernance: {
            memoryConnectionCoverage: 0.87,
            memoryConnections: 42,
            learningObservations: 7,
          },
          reviewBacklog: {
            queueSummary: {
              status: 'yellow',
              unreviewedCount: 2,
              criticalCount: 0,
              oldestAgeMinutes: 12.4,
            },
            items: [
              {
                decisionId: 'ra-review-1',
                ageMinutes: 12.4,
              },
            ],
          },
          arbitrationBacklog: {
            queueSummary: {
              status: 'green',
              divergentCount: 0,
              unreviewedCount: 0,
              reversedCount: 0,
            },
            items: [],
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

  it('renders provenance and route-to-contract lineage for artifact nodes', async () => {
    const view = render(<NodeInspector />);

    await act(async () => {
      useCanvasStore.setState({ selectedNodeId: 'artifact-1' });
    });

    expect(view.getByText('Artifact Binding')).toBeTruthy();
    expect(view.getByText((_content: string, element: Element | null) => element?.textContent === 'Verification: verified')).toBeTruthy();
    expect(
      view.getByText(
        (_content: string, element: Element | null) => element?.textContent === 'Route: canvas -> foundry.render.sections.v1',
      ),
    ).toBeTruthy();
    expect(view.getAllByText('graph.search')).toHaveLength(2);
    expect(view.getByText('91%')).toBeTruthy();
  });

  it('renders review and arbitration backlog summaries for governance nodes', async () => {
    const view = render(<NodeInspector />);

    await act(async () => {
      useCanvasStore.setState({ selectedNodeId: 'governance-1' });
    });

    expect(view.getByText('Governance Eval')).toBeTruthy();
    expect(view.getByText('Review backlog')).toBeTruthy();
    expect(view.getByText('Arbitration backlog')).toBeTruthy();
    expect(view.getByText((_content: string, element: Element | null) => element?.textContent === 'Divergent: 0')).toBeTruthy();
    expect(view.getByText((_content: string, element: Element | null) => element?.textContent === 'Unreviewed: 2')).toBeTruthy();
  });
});
