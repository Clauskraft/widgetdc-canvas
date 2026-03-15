import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { useCanvasStore, type ActionRecommendation } from './canvasStore';

// ---- Mocks ----
// Mock the layout module so dagre is not required in tests
vi.mock('../lib/layout', () => ({
  applyDagreLayout: (nodes: unknown[]) => nodes,
}));

// Mock the api module to intercept all backend calls
vi.mock('../lib/api', () => ({
  graphRead: vi.fn().mockResolvedValue([]),
  graphWrite: vi.fn().mockResolvedValue({ success: true }),
  graphExpand: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
  graphNeighborSearch: vi.fn().mockResolvedValue([]),
  mcpCall: vi.fn().mockResolvedValue({ success: true }),
  fetchArtifactSurface: vi.fn(),
  applyArtifactSurfaceAction: vi.fn(),
  reasonCall: vi.fn().mockResolvedValue({
    recommendation: 'Test recommendation',
    thinking_steps: ['Step 1', 'Step 2'],
    confidence: 0.85,
    sources: [],
  }),
  isComplianceQuery: vi.fn().mockReturnValue(false),
  getComplianceGaps: vi.fn().mockResolvedValue([]),
}));

// Import mocks after vi.mock declarations
import { graphRead, graphWrite, graphNeighborSearch, mcpCall, reasonCall, fetchArtifactSurface, applyArtifactSurfaceAction } from '../lib/api';
import { artifactSurfaceToCanvasNode } from '../lib/artifactSurface';

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
    knowledgeExplorerMode: false,
    gapOverlayMode: false,
    expandStates: new Map(),
    engagementId: null,
    filterState: { relTypes: [], searchText: '' },
    layoutMode: 'freeform',
    canvasId: 'default',
    _toast: undefined,
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

// =======================================================================
// 1. Core Operations
// =======================================================================
describe('Core Operations', () => {
  it('addNode creates a node with correct type and label', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'TestEntity');
    const nodes = useCanvasStore.getState().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('entity');
    expect(nodes[0].data.label).toBe('TestEntity');
    expect(nodes[0].data.nodeType).toBe('entity');
  });

  it('addNode accepts optional subtitle and position', () => {
    const store = useCanvasStore.getState();
    store.addNode('tool', 'MyTool', 'A subtitle', { x: 42, y: 99 });
    const node = useCanvasStore.getState().nodes[0];
    expect(node.data.subtitle).toBe('A subtitle');
    expect(node.position).toEqual({ x: 42, y: 99 });
  });

  it('addNodeWithData creates a node with arbitrary data and returns its id', () => {
    const store = useCanvasStore.getState();
    const id = store.addNodeWithData('insight', {
      label: 'InsightLabel',
      subtitle: 'Details',
    });
    expect(typeof id).toBe('string');
    const node = useCanvasStore.getState().nodes.find(n => n.id === id);
    expect(node).toBeDefined();
    expect(node!.data.label).toBe('InsightLabel');
    expect(node!.data.subtitle).toBe('Details');
  });

  it('addNodeWithData positions node at provided position', () => {
    const store = useCanvasStore.getState();
    store.addNodeWithData('server', { label: 'Srv' }, { x: 10, y: 20 });
    expect(useCanvasStore.getState().nodes[0].position).toEqual({ x: 10, y: 20 });
  });

  it('importArtifactSurface maps canonical artifact payload to bound canvas node', () => {
    const store = useCanvasStore.getState();
    const id = store.importArtifactSurface({
      contract_version: 'architecture.artifact.surface.v1',
      surface: 'canvas',
      artifact: {
        artifact_id: 'artifact-123',
        artifact_type: 'architecture_decision_pack',
        title: 'Decision Pack',
        summary: 'Bound to verified artifact',
        confidence: 0.92,
        quality_gate: 'pass',
        updated_at: '2026-03-15T23:05:00Z',
      },
      lineage: {
        artifact_id: 'artifact-123',
        source_graph_node_id: 'Decision:wallet-target-state',
        source_graph_labels: ['ArchitectureDecision'],
        verification_status: 'verified',
        render_package_id: 'renderpkg-1',
        render_contract: 'foundry.render.sections.v1',
        source_asset_ids: ['sg-executive-summary-v1'],
      },
      review: {
        state: 'review_requested',
        quality_gate: 'pass',
        available_actions: ['approve', 'reject'],
      },
      render: {
        render_package_id: 'renderpkg-1',
        contract: 'foundry.render.sections.v1',
        document_type: 'pptx',
        section_count: 2,
        used_assets: ['sg-executive-summary-v1'],
      },
    });

    const node = useCanvasStore.getState().nodes.find(n => n.id === id);
    expect(node).toBeDefined();
    expect(node!.data.artifactId).toBe('artifact-123');
    expect(node!.data.renderPackageId).toBe('renderpkg-1');
    expect(node!.data.reviewState).toBe('review_requested');
    expect(node!.data.sourceGraphNodeId).toBe('Decision:wallet-target-state');
  });

  it('artifactSurfaceToCanvasNode rejects payloads without durable artifact identity', () => {
    expect(() =>
      artifactSurfaceToCanvasNode({
        contract_version: 'architecture.artifact.surface.v1',
        surface: 'canvas',
        artifact: {
          artifact_id: '',
          artifact_type: 'architecture_decision_pack',
          title: 'Broken',
        },
        lineage: {
          artifact_id: '',
          render_package_id: 'renderpkg-1',
          render_contract: 'foundry.render.sections.v1',
        },
        review: { state: 'draft' },
        render: {
          render_package_id: 'renderpkg-1',
          contract: 'foundry.render.sections.v1',
        },
      } as any)
    ).toThrow(/artifact_id/i);
  });

  it('syncArtifactNode refreshes local node state from backend truth', async () => {
    const store = useCanvasStore.getState();
    const id = store.importArtifactSurface({
      contract_version: 'architecture.artifact.surface.v1',
      surface: 'canvas',
      artifact: {
        artifact_id: 'artifact-123',
        artifact_type: 'architecture_decision_pack',
        title: 'Decision Pack',
        summary: 'Local draft',
        confidence: 0.92,
        quality_gate: 'pass',
        updated_at: '2026-03-15T23:05:00Z',
      },
      lineage: {
        artifact_id: 'artifact-123',
        source_graph_node_id: 'Decision:wallet-target-state',
        source_graph_labels: ['ArchitectureDecision'],
        verification_status: 'verified',
        render_package_id: 'renderpkg-1',
        render_contract: 'foundry.render.sections.v1',
        source_asset_ids: ['sg-executive-summary-v1'],
      },
      review: {
        state: 'review_requested',
        quality_gate: 'pass',
        available_actions: ['start_review'],
      },
      render: {
        render_package_id: 'renderpkg-1',
        contract: 'foundry.render.sections.v1',
        document_type: 'pptx',
        section_count: 2,
        used_assets: ['sg-executive-summary-v1'],
      },
    });

    (fetchArtifactSurface as Mock).mockResolvedValueOnce({
      contract_version: 'architecture.artifact.surface.v1',
      surface: 'canvas',
      artifact: {
        artifact_id: 'artifact-123',
        artifact_type: 'architecture_decision_pack',
        title: 'Decision Pack',
        summary: 'Backend truth',
        confidence: 0.92,
        quality_gate: 'pass',
        updated_at: '2026-03-16T00:00:00Z',
      },
      lineage: {
        artifact_id: 'artifact-123',
        source_graph_node_id: 'Decision:wallet-target-state',
        source_graph_labels: ['ArchitectureDecision'],
        verification_status: 'verified',
        render_package_id: 'renderpkg-1',
        render_contract: 'foundry.render.sections.v1',
        source_asset_ids: ['sg-executive-summary-v1'],
      },
      review: {
        state: 'in_review',
        quality_gate: 'pass',
        available_actions: ['approve', 'reject'],
      },
      render: {
        render_package_id: 'renderpkg-1',
        contract: 'foundry.render.sections.v1',
        document_type: 'pptx',
        section_count: 2,
        used_assets: ['sg-executive-summary-v1'],
      },
      backend_targets: ['canvas.import_artifact_surface'],
    });

    await useCanvasStore.getState().syncArtifactNode(id);
    const node = useCanvasStore.getState().nodes.find(n => n.id === id);
    expect(node!.data.reviewState).toBe('in_review');
    expect(node!.data.subtitle).toBe('Backend truth');
    expect(node!.data.availableActions).toEqual(['approve', 'reject']);
  });

  it('applyArtifactAction persists operator transition and updates node from backend response', async () => {
    const store = useCanvasStore.getState();
    const id = store.importArtifactSurface({
      contract_version: 'architecture.artifact.surface.v1',
      surface: 'canvas',
      artifact: {
        artifact_id: 'artifact-123',
        artifact_type: 'architecture_decision_pack',
        title: 'Decision Pack',
      },
      lineage: {
        artifact_id: 'artifact-123',
        render_package_id: 'renderpkg-1',
        render_contract: 'foundry.render.sections.v1',
      },
      review: {
        state: 'review_requested',
        available_actions: ['start_review'],
      },
      render: {
        render_package_id: 'renderpkg-1',
        contract: 'foundry.render.sections.v1',
      },
    });

    (applyArtifactSurfaceAction as Mock).mockResolvedValueOnce({
      contract_version: 'architecture.artifact.surface.v1',
      surface: 'canvas',
      artifact: {
        artifact_id: 'artifact-123',
        artifact_type: 'architecture_decision_pack',
        title: 'Decision Pack',
        summary: 'Review started',
      },
      lineage: {
        artifact_id: 'artifact-123',
        render_package_id: 'renderpkg-1',
        render_contract: 'foundry.render.sections.v1',
      },
      review: {
        state: 'in_review',
        available_actions: ['approve', 'reject'],
      },
      render: {
        render_package_id: 'renderpkg-1',
        contract: 'foundry.render.sections.v1',
      },
      backend_targets: ['canvas.import_artifact_surface'],
    });

    await useCanvasStore.getState().applyArtifactAction(id, 'start_review');
    const node = useCanvasStore.getState().nodes.find(n => n.id === id);
    expect(applyArtifactSurfaceAction).toHaveBeenCalledWith('artifact-123', 'start_review');
    expect(node!.data.reviewState).toBe('in_review');
    expect(node!.data.availableActions).toEqual(['approve', 'reject']);
  });

  it('removeSelected removes the selected node and its edges', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'A');
    const nodeA = useCanvasStore.getState().nodes[0];
    store.addNode('entity', 'B');
    const nodeB = useCanvasStore.getState().nodes[1];

    // Manually add an edge between them
    useCanvasStore.setState({
      edges: [{ id: 'e1', source: nodeA.id, target: nodeB.id }],
      selectedNodeId: nodeA.id,
    });

    useCanvasStore.getState().removeSelected();
    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe(nodeB.id);
    expect(state.edges).toHaveLength(0);
    expect(state.selectedNodeId).toBeNull();
  });

  it('selectNode sets selectedNodeId', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'X');
    const nodeId = useCanvasStore.getState().nodes[0].id;
    store.selectNode(nodeId);
    expect(useCanvasStore.getState().selectedNodeId).toBe(nodeId);
  });

  it('selectNode(null) clears selection', () => {
    const store = useCanvasStore.getState();
    store.selectNode('anything');
    store.selectNode(null);
    expect(useCanvasStore.getState().selectedNodeId).toBeNull();
  });

  it('clearCanvas removes all nodes and edges', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'A');
    store.addNode('tool', 'B');
    useCanvasStore.setState({ edges: [{ id: 'e1', source: 'a', target: 'b' }] });
    store.clearCanvas();
    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
    expect(state.selectedNodeId).toBeNull();
  });

  it('applyLayout calls layout without crashing', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'A');
    store.addNode('entity', 'B');
    expect(() => store.applyLayout('LR')).not.toThrow();
    expect(useCanvasStore.getState().nodes).toHaveLength(2);
  });

  it('toggleAiPanel flips aiPanelOpen', () => {
    expect(useCanvasStore.getState().aiPanelOpen).toBe(false);
    useCanvasStore.getState().toggleAiPanel();
    expect(useCanvasStore.getState().aiPanelOpen).toBe(true);
    useCanvasStore.getState().toggleAiPanel();
    expect(useCanvasStore.getState().aiPanelOpen).toBe(false);
  });

  it('toggleToolPalette flips toolPaletteOpen', () => {
    expect(useCanvasStore.getState().toolPaletteOpen).toBe(false);
    useCanvasStore.getState().toggleToolPalette();
    expect(useCanvasStore.getState().toolPaletteOpen).toBe(true);
  });

  it('toggleKnowledgeExplorer flips knowledgeExplorerMode', () => {
    expect(useCanvasStore.getState().knowledgeExplorerMode).toBe(false);
    useCanvasStore.getState().toggleKnowledgeExplorer();
    expect(useCanvasStore.getState().knowledgeExplorerMode).toBe(true);
  });
});

// =======================================================================
// 2. Undo / Redo
// =======================================================================
describe('Undo / Redo', () => {
  it('pushSnapshot stores current state on undoStack', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'First'); // addNode calls pushSnapshot internally
    expect(useCanvasStore.getState().undoStack.length).toBeGreaterThanOrEqual(1);
  });

  it('undo restores previous snapshot', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'A');
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it('redo re-applies undone change', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'A');
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
  });

  it('undo is no-op when stack is empty', () => {
    const nodesBefore = useCanvasStore.getState().nodes;
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().nodes).toEqual(nodesBefore);
  });

  it('redo is no-op when redo stack is empty', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'A');
    const nodesBefore = useCanvasStore.getState().nodes;
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().nodes).toEqual(nodesBefore);
  });
});

// =======================================================================
// 3. Graph Operations (mock fetch)
// =======================================================================
describe('Graph Operations', () => {
  it('expandNode adds neighbor nodes from graph', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'TestEntity');
    const nodeId = useCanvasStore.getState().nodes[0].id;

    (graphNeighborSearch as Mock).mockResolvedValueOnce([
      { m: { properties: { name: 'Neighbor1' } }, nodeLabel: 'Entity', relType: 'RELATED' },
      { m: { properties: { name: 'Neighbor2' } }, nodeLabel: 'Tool', relType: 'USES' },
    ]);

    // graphExpand throws to trigger fallback to graphNeighborSearch
    const { graphExpand: graphExpandMock } = await import('../lib/api');
    (graphExpandMock as Mock).mockRejectedValueOnce(new Error('not available'));

    await useCanvasStore.getState().expandNode(nodeId);
    const nodes = useCanvasStore.getState().nodes;
    // Original + 2 neighbors
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    const labels = nodes.map(n => n.data.label);
    expect(labels).toContain('Neighbor1');
    expect(labels).toContain('Neighbor2');
  });

  it('expandNode is no-op for nonexistent node', async () => {
    await useCanvasStore.getState().expandNode('nonexistent-id');
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it('matchTenders adds tender evidence nodes', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'MyCap');
    const nodeId = useCanvasStore.getState().nodes[0].id;

    (mcpCall as Mock).mockResolvedValueOnce({
      success: true,
      matches: [
        { tender_id: 'tid-1', text: 'Tender requirement text here', category: 'IT', confidence: 0.9, score: 0.85 },
      ],
    });

    await useCanvasStore.getState().matchTenders(nodeId);
    const nodes = useCanvasStore.getState().nodes;
    expect(nodes.length).toBe(2); // original + 1 tender
    expect(nodes[1].type).toBe('evidence');
    const edges = useCanvasStore.getState().edges;
    expect(edges.length).toBe(1);
    expect(edges[0].source).toBe(nodeId);
  });

  it('saveToGraph calls graphWrite for nodes and edges', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'SaveMe');
    await useCanvasStore.getState().saveToGraph();
    // 2 delete calls (nodes + edges) + 1 node write = 3 minimum
    expect(graphWrite).toHaveBeenCalled();
    const calls = (graphWrite as Mock).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('loadFromGraph populates canvas from graph records', async () => {
    (graphRead as Mock)
      .mockResolvedValueOnce([
        {
          n: { properties: { id: 'n1', label: 'Loaded', nodeType: 'entity', posX: 100, posY: 200 } },
          nodeLabels: ['CanvasNode'],
        },
      ])
      .mockResolvedValueOnce([
        {
          e: { properties: { id: 'e1', source: 'n1', target: 'n2', label: 'REL' } },
        },
      ]);

    await useCanvasStore.getState().loadFromGraph('test-canvas');
    const state = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].data.label).toBe('Loaded');
    expect(state.edges).toHaveLength(1);
    expect(state.canvasId).toBe('test-canvas');
  });
});

// =======================================================================
// 4. Combo / Group
// =======================================================================
describe('Combo / Group', () => {
  it('groupSelected creates a combo node from selected node and connected neighbors', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'Center', undefined, { x: 100, y: 100 });
    const centerId = useCanvasStore.getState().nodes[0].id;
    store.addNode('tool', 'Leaf', undefined, { x: 200, y: 200 });
    const leafId = useCanvasStore.getState().nodes[1].id;

    useCanvasStore.setState({
      edges: [{ id: 'e1', source: centerId, target: leafId }],
      selectedNodeId: centerId,
    });

    useCanvasStore.getState().groupSelected();
    const state = useCanvasStore.getState();
    // Should have 1 combo node, original 2 removed
    const comboNode = state.nodes.find(n => n.type === 'combo');
    expect(comboNode).toBeDefined();
    expect(comboNode!.data.childCount).toBe(2);
    expect(state.selectedNodeId).toBeNull();
  });

  it('ungroupCombo removes the combo node', () => {
    const store = useCanvasStore.getState();
    // Manually create a combo node
    const id = store.addNodeWithData('combo' as any, {
      label: 'Group (A)',
      nodeType: 'combo' as any,
      childCount: 3,
      metadata: { childIds: ['a', 'b', 'c'] },
    });

    // Force the node type to 'combo' since addNodeWithData sets the passed type
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map(n =>
        n.id === id ? { ...n, type: 'combo' } : n
      ),
    });

    useCanvasStore.getState().ungroupCombo(id);
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it('groupSelected is no-op without selection', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'A');
    // No selectedNodeId set
    useCanvasStore.getState().groupSelected();
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
  });
});

// =======================================================================
// 5. Strategic 10
// =======================================================================
describe('Strategic 10', () => {
  it('autoAnalyze adds nodes from parallel analyses', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'TargetCo');
    const nodeId = useCanvasStore.getState().nodes[0].id;

    (graphNeighborSearch as Mock).mockResolvedValueOnce([
      { m: { properties: { name: 'Rel1' } }, nodeLabel: 'Entity', relType: 'REL' },
    ]);
    (mcpCall as Mock).mockResolvedValueOnce({ success: false, matches: [] });
    // reasonCall is already mocked globally

    await useCanvasStore.getState().autoAnalyze(nodeId);
    const nodes = useCanvasStore.getState().nodes;
    // Original + at least expand result + thought node
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    expect(useCanvasStore.getState().isLoading).toBe(false);
  });

  it('generateNarrative returns empty string for empty canvas', async () => {
    const result = await useCanvasStore.getState().generateNarrative();
    expect(result).toBe('');
  });

  it('generateNarrative creates artifact node and returns text', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'Alpha');
    store.addNode('evidence', 'Doc1');

    (reasonCall as Mock).mockResolvedValueOnce({
      recommendation: 'Narrative text about Alpha',
      thinking_steps: [],
      confidence: 0.9,
    });

    const result = await useCanvasStore.getState().generateNarrative();
    expect(result).toBe('Narrative text about Alpha');
    const artifacts = useCanvasStore.getState().nodes.filter(n => n.type === 'artifact');
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].data.label).toBe('Narrative Report');
  });

  it('evaluateHypothesis updates thought node with score', async () => {
    const store = useCanvasStore.getState();
    const id = store.addNodeWithData('thought', {
      label: 'Hypothesis: Market grows 20%',
      nodeType: 'thought',
    });
    // Force node type to thought
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map(n =>
        n.id === id ? { ...n, type: 'thought' } : n
      ),
    });

    (reasonCall as Mock).mockResolvedValueOnce({
      recommendation: 'Supported by evidence',
      confidence: 0.82,
      thinking_steps: ['Analyzed market data'],
    });

    await useCanvasStore.getState().evaluateHypothesis(id);
    const thought = useCanvasStore.getState().nodes.find(n => n.id === id);
    expect(thought!.data.complianceScore).toBe(0.82);
    expect(thought!.data.reasoningStatus).toBe('complete');
  });

  it('discoverPatterns creates insight nodes from graph data', async () => {
    (graphRead as Mock).mockResolvedValueOnce([
      { domain: 'IT', insight: 'Cloud migration accelerating', confidence: 0.9 },
      { domain: 'IT', insight: 'DevOps adoption', confidence: 0.8 },
      { domain: 'Finance', insight: 'Cost cutting', confidence: 0.7 },
    ]);

    await useCanvasStore.getState().discoverPatterns();
    const nodes = useCanvasStore.getState().nodes;
    // 2 domain insight nodes + 1 synthesis thought
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    expect(nodes.some(n => n.data.label?.toString().includes('Pattern: IT'))).toBe(true);
    expect(nodes.some(n => n.data.label === 'Cross-Engagement Synthesis')).toBe(true);
  });

  it('loadTemplate executes template queries and adds nodes', async () => {
    (graphRead as Mock).mockResolvedValueOnce([
      { n: { properties: { name: 'CompA' } } },
      { n: { properties: { name: 'CompB' } } },
    ]);
    // regulatory-assessment has 2 queries
    (graphRead as Mock).mockResolvedValueOnce([
      { n: { properties: { title: 'Gap1' } } },
    ]);

    await useCanvasStore.getState().loadTemplate('regulatory-assessment');
    const nodes = useCanvasStore.getState().nodes;
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });

  it('loadTemplate is no-op for unknown templateId', async () => {
    await useCanvasStore.getState().loadTemplate('nonexistent-template');
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
    expect(graphRead).not.toHaveBeenCalled();
  });
});

// =======================================================================
// 6. S21-S25 Strategic Moats
// =======================================================================
describe('S21: Engagement Replay', () => {
  it('setEngagement sets engagementId', () => {
    useCanvasStore.getState().setEngagement('eng-001');
    expect(useCanvasStore.getState().engagementId).toBe('eng-001');
  });

  it('recordStep calls graphWrite when engagementId is set', () => {
    useCanvasStore.getState().setEngagement('eng-002');
    useCanvasStore.getState().recordStep('expand', 'SomeNode', 'kept');
    expect(graphWrite).toHaveBeenCalledWith(
      expect.stringContaining('EngagementStep'),
      expect.objectContaining({
        eid: 'eng-002',
        actionType: 'expand',
        nodeContext: 'SomeNode',
        outcome: 'kept',
      }),
    );
  });

  it('recordStep is no-op when no engagement is active', () => {
    useCanvasStore.getState().recordStep('expand', 'SomeNode');
    expect(graphWrite).not.toHaveBeenCalled();
  });

  it('replayEngagement clears canvas and adds step nodes', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'Existing');

    (graphRead as Mock).mockResolvedValueOnce([
      { actionType: 'expand', nodeContext: 'Alpha', outcome: 'kept', timestamp: '2026-03-12T10:00:00Z' },
      { actionType: 'analyze', nodeContext: 'Beta', outcome: 'kept', timestamp: '2026-03-12T10:01:00Z' },
    ]);

    await useCanvasStore.getState().replayEngagement('eng-replay-1');
    const nodes = useCanvasStore.getState().nodes;
    // Existing node cleared + 2 replay nodes
    expect(nodes).toHaveLength(2);
    expect(nodes[0].data.label).toContain('expand');
    expect(nodes[1].data.label).toContain('analyze');
  });
});

describe('S22: Cross-Client Intelligence', () => {
  it('crossReference adds nodes from graph query results', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'ClientA');
    const nodeId = useCanvasStore.getState().nodes[0].id;

    (graphRead as Mock).mockResolvedValueOnce([
      { m: { name: 'RelatedOrg' }, relType: 'COMPETES_WITH', nodeLabel: 'Entity' },
      { m: { name: 'SharedTech' }, relType: 'USES_TECH', nodeLabel: 'Tool' },
    ]);

    await useCanvasStore.getState().crossReference(nodeId);
    const nodes = useCanvasStore.getState().nodes;
    // Original + 2 cross-ref nodes
    expect(nodes).toHaveLength(3);
    const edges = useCanvasStore.getState().edges;
    expect(edges.length).toBe(2);
    expect(edges[0].source).toBe(nodeId);
  });
});

describe('S23: Confidence-Weighted Recommendations', () => {
  it('recommendNextActions returns sorted recommendations', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'TestNode');
    const nodeId = useCanvasStore.getState().nodes[0].id;

    const recs = await useCanvasStore.getState().recommendNextActions(nodeId);
    expect(recs.length).toBeGreaterThan(0);
    // Verify sorted by confidence descending
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].confidence).toBeGreaterThanOrEqual(recs[i].confidence);
    }
  });

  it('recommendNextActions suggests expand for isolated nodes', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'Isolated');
    const nodeId = useCanvasStore.getState().nodes[0].id;

    const recs = await useCanvasStore.getState().recommendNextActions(nodeId);
    const expandRec = recs.find((r: ActionRecommendation) => r.action === 'expand');
    expect(expandRec).toBeDefined();
    expect(expandRec!.confidence).toBe(0.95);
    expect(expandRec!.reasoning).toContain('no connections');
  });

  it('recommendNextActions returns empty array for nonexistent node', async () => {
    const recs = await useCanvasStore.getState().recommendNextActions('ghost-id');
    expect(recs).toEqual([]);
  });
});

describe('S24: Provenance Audit Trail', () => {
  it('exportAuditTrail returns JSON-LD with @context', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'Auditable');

    const json = await useCanvasStore.getState().exportAuditTrail('json');
    const parsed = JSON.parse(json);
    expect(parsed['@context']).toBe('https://www.w3.org/ns/prov');
    expect(parsed['@type']).toBe('ProvenanceBundle');
    expect(parsed.nodeCount).toBe(1);
    expect(parsed.entities).toHaveLength(1);
    expect(parsed.entities[0].label).toBe('Auditable');
  });

  it('exportAuditTrail returns markdown table', async () => {
    const store = useCanvasStore.getState();
    store.addNode('insight', 'Finding1');

    const md = await useCanvasStore.getState().exportAuditTrail('markdown');
    expect(md).toContain('# Provenance Audit Trail');
    expect(md).toContain('| ID |');
    expect(md).toContain('Finding1');
    expect(md).toContain('## Integrity Summary');
  });
});

describe('S25: Canvas-as-API', () => {
  it('runAnalysisPipeline returns nodeCount and narrative', async () => {
    // expandNode will call graphExpand/graphNeighborSearch
    const { graphExpand: geMock } = await import('../lib/api');
    (geMock as Mock).mockRejectedValue(new Error('nope'));
    (graphNeighborSearch as Mock).mockResolvedValue([]);
    (mcpCall as Mock).mockResolvedValue({ success: false });
    (reasonCall as Mock).mockResolvedValue({
      recommendation: 'Pipeline narrative',
      thinking_steps: [],
      confidence: 0.7,
    });

    const result = await useCanvasStore.getState().runAnalysisPipeline('TestCorp');
    expect(result.nodeCount).toBeGreaterThanOrEqual(1);
    expect(typeof result.narrative).toBe('string');
  });
});

// =======================================================================
// 7. Edge Cases
// =======================================================================
describe('Edge Cases', () => {
  it('removeSelected is no-op when nothing is selected', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'A');
    useCanvasStore.getState().removeSelected();
    expect(useCanvasStore.getState().nodes).toHaveLength(1);
  });

  it('evaluateHypothesis ignores non-thought nodes', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'NotAThought');
    const nodeId = useCanvasStore.getState().nodes[0].id;
    await useCanvasStore.getState().evaluateHypothesis(nodeId);
    // reasonCall should NOT have been called
    expect(reasonCall).not.toHaveBeenCalled();
  });

  it('matchTenders handles no matches gracefully', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'NobodyCares');
    const nodeId = useCanvasStore.getState().nodes[0].id;

    (mcpCall as Mock).mockResolvedValueOnce({ success: true, matches: [] });

    await useCanvasStore.getState().matchTenders(nodeId);
    expect(useCanvasStore.getState().nodes).toHaveLength(1); // no new nodes
  });

  it('setFilter merges partial filter state', () => {
    useCanvasStore.getState().setFilter({ searchText: 'hello' });
    expect(useCanvasStore.getState().filterState.searchText).toBe('hello');
    expect(useCanvasStore.getState().filterState.relTypes).toEqual([]);

    useCanvasStore.getState().setFilter({ relTypes: ['USES'] });
    expect(useCanvasStore.getState().filterState.relTypes).toEqual(['USES']);
    expect(useCanvasStore.getState().filterState.searchText).toBe('hello');
  });

  it('setToast stores and exposes toast function', () => {
    const toastFn = vi.fn();
    useCanvasStore.getState().setToast(toastFn);
    expect(useCanvasStore.getState()._toast).toBe(toastFn);
  });

  it('clearCanvas pushes undo snapshot before clearing', () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'A');
    store.addNode('entity', 'B');
    // Note undoStack already has snapshots from addNode calls
    const stackBefore = useCanvasStore.getState().undoStack.length;
    useCanvasStore.getState().clearCanvas();
    expect(useCanvasStore.getState().undoStack.length).toBe(stackBefore + 1);
    expect(useCanvasStore.getState().nodes).toHaveLength(0);
  });

  it('expandNode tracks expandStates for progressive loading', async () => {
    const store = useCanvasStore.getState();
    store.addNode('entity', 'BigNode');
    const nodeId = useCanvasStore.getState().nodes[0].id;

    const { graphExpand: geMock } = await import('../lib/api');
    (geMock as Mock).mockRejectedValueOnce(new Error('nope'));
    // Return 25 records to trigger hasMore
    const records = Array.from({ length: 25 }, (_, i) => ({
      m: { properties: { name: `N${i}` } },
      nodeLabel: 'Entity',
      relType: 'RELATED',
    }));
    (graphNeighborSearch as Mock).mockResolvedValueOnce(records);

    await useCanvasStore.getState().expandNode(nodeId);
    const expandState = useCanvasStore.getState().expandStates.get(nodeId);
    expect(expandState).toBeDefined();
    expect(expandState!.totalAvailable).toBe(25);
    expect(expandState!.loaded).toBe(20); // PROGRESSIVE_EXPAND_LIMIT
    expect(expandState!.hasMore).toBe(true);
  });

  it('crossReference is no-op for nonexistent node', async () => {
    await useCanvasStore.getState().crossReference('ghost');
    expect(graphRead).not.toHaveBeenCalled();
  });
});
