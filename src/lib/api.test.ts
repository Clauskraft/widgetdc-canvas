import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchGovernanceEvalSnapshot,
  fetchLibreChatRuntimeIntelligence,
  fetchOrchestratorRoutingSnapshot,
  graphSearch,
  graphWindow,
} from './api';

describe('Canvas API: LibreChat runtime intelligence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the canonical request body to the LibreChat runtime endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        contract_version: 'librechat.runtime.intelligence.v1',
        generated_at: '2026-03-17T10:00:00Z',
        chat: {
          headline: 'Strategic recommendation ready',
          response_markdown: 'Decision: accepted',
        },
        recommendation: {},
        artifact_surface: {
          contract_version: 'architecture.artifact.surface.v1',
          surface: 'librechat',
          artifact: {
            artifact_id: 'artifact-librechat-1',
            artifact_type: 'consulting_recommendation_pack',
            title: 'Strategic recommendation ready',
          },
          lineage: {
            artifact_id: 'artifact-librechat-1',
            render_package_id: 'renderpkg-1',
            render_contract: 'foundry.render.sections.v1',
          },
          review: { state: 'export_ready' },
          render: {
            render_package_id: 'renderpkg-1',
            contract: 'foundry.render.sections.v1',
          },
        },
      }),
    } as Response);

    const result = await fetchLibreChatRuntimeIntelligence({
      target_domain: 'nis2',
      framework: 'NIS2',
      enterprise_grounding: true,
      benchmark_outcomes: [{ benchmark_id: 'bench-1' }],
      loose_ends: [{ loose_end_id: 'le-1' }],
      backend_consumption_receipts: [{ acknowledged: true }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/intelligence/librechat/runtime-intelligence',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1] && (fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toEqual({
      target_domain: 'nis2',
      framework: 'NIS2',
      enterprise_grounding: true,
      benchmark_outcomes: [{ benchmark_id: 'bench-1' }],
      loose_ends: [{ loose_end_id: 'le-1' }],
      backend_consumption_receipts: [{ acknowledged: true }],
    });
    expect(result.contract_version).toBe('librechat.runtime.intelligence.v1');
  });

  it('throws on non-ok responses from the LibreChat runtime endpoint', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    await expect(
      fetchLibreChatRuntimeIntelligence({
        target_domain: 'nis2',
      }),
    ).rejects.toThrow(/503/);
  });
});

describe('Canvas API: orchestrator routing snapshot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('loads routing decisions and latest workflow from orchestrator dashboard data', async () => {
    vi.stubEnv('VITE_ORCHESTRATOR_URL', 'https://orchestrator.example');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        routing: {
          recentDecisions: [{
            decision_id: 'route-1',
            selected_agent_id: 'nexus',
            selected_capability: 'guided_decomposition',
            trust_score: 0.91,
            reason_code: 'TRUST_WIN',
            decided_at: '2026-03-17T12:00:00Z',
          }],
          topTrustProfiles: [{
            agent_id: 'nexus',
            task_domain: 'decomposition',
            success_count: 3,
            fail_count: 0,
            bayesian_score: 0.91,
            evidence_source: 'runtime_readback',
            scorecard_dimension: 'decomposition_quality',
            last_verified_at: '2026-03-17T12:00:00Z',
          }],
        },
        chains: [{
          execution_id: 'exec-1',
          workflow_envelope: {
            workflow_id: 'wf-1',
            workflow_type: 'delivery',
            current_phase: 'define',
            participants: ['master', 'nexus'],
            primary_surface: 'widgetdc-librechat',
            flow_ref: 'core-flow-2',
            scorecard_ref: 'LIN-261',
            reasoning_lineage_visible: true,
            started_at: '2026-03-17T11:59:00Z',
            updated_at: '2026-03-17T12:00:00Z',
          },
        }],
      }),
    } as Response);

    const result = await fetchOrchestratorRoutingSnapshot();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://orchestrator.example/dashboard/data',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(result.recentDecisions[0]?.selected_agent_id).toBe('nexus');
    expect(result.latestWorkflow?.workflow_id).toBe('wf-1');
    expect(result.latestChainExecutionId).toBe('exec-1');
  });
});

describe('Canvas API: governance eval snapshot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('composes scorecard, LegoFactory, and memory governance into one read-only snapshot', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: {
            windowDays: 30,
            verifiedDecisions: 2,
            operatorAccepted: 3,
            operatorRejected: 0,
            acceptanceRate: 1,
            rejectionRate: 0,
            reversalCount: 0,
            stabilityRate: 1,
            routedDecisionEvents: 3,
            routedDecisionCoverage: 0.6,
            triSourceArbitrationDivergenceCount: 1,
            triSourceArbitrationDivergenceRate: 1,
            avgTimeToVerifiedMinutes: 504.52,
            medianTimeToVerifiedMinutes: 504.52,
            oodaRunEvents: 1,
            oodaFallbackEvents: 0,
            oodaFailedEvents: 0,
            oodaFallbackRate: 0,
            oodaFailureRate: 0,
            oodaAverageDurationMs: 1765,
            coverageGaps: [],
            recentEvents: [],
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          queueSummary: {
            queueName: 'lego-factory-governance',
            waiting: 3,
            active: 2,
            blocked: 2,
            promotable: 3,
            outputCount: 5,
          },
          recentGovernedOutputs: [{
            id: 'ra-1',
            kind: 'ReferenceArchitecture',
            status: 'verified',
            readBackVerified: true,
            gate: { blocked: false, reason: 'verified recommendation path' },
            updatedAt: '2026-03-18T10:00:00Z',
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: {
            windowDays: 30,
            activeEngagements: 405,
            engagementsWithConnection: 9,
            memoryConnections: 9,
            memoryConnectionCoverage: 0.022,
            learningObservations: 13,
            acceptedObservations: 13,
            rejectedObservations: 0,
            acceptanceRate: 1,
            rejectionRate: 0,
            coverageGaps: [{
              metric: 'memory_connection_readback',
              reason: '396 engagements are missing canonical MemoryConnection verification',
            }],
          },
        }),
      } as Response);

    const result = await fetchGovernanceEvalSnapshot();

    const governanceCalls = fetchMock.mock.calls.slice(-3);
    expect(governanceCalls).toEqual([
      [
        '/api/governance/scorecard?days=30',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      ],
      [
        '/api/governance/legofactory?limit=5',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      ],
      [
        '/api/governance/memory?days=30',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      ],
    ]);
    expect(result.contractVersion).toBe('canvas.downstream.eval.v1');
    expect(result.readOnly).toBe(true);
    expect(result.legoFactory.queueSummary.blocked).toBe(2);
    expect(result.memory.memoryConnectionCoverage).toBe(0.022);
    expect(result.coverageGaps).toEqual([
      {
        metric: 'memory_connection_readback',
        reason: '396 engagements are missing canonical MemoryConnection verification',
      },
    ]);
  });
});

describe('Canvas API: canonical graph routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts graph.window with canonical payload shape', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        nodes: [{ id: 'domain-1', label: 'Strategy', type: 'ConsultingDomain' }],
        edges: [{ source: 'domain-1', target: 'flow-1', type: 'HAS_SUBPROCESS' }],
        total_count: 1,
        lod_level: 'overview',
      }),
    } as Response);

    const result = await graphWindow('overview', { centerNodeId: 'Strategy', limit: 25 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/mcp/route',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );

    const body = JSON.parse(String((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body));
    expect(body).toEqual({
      tool: 'graph.window',
      payload: {
        lod: 'overview',
        center_node_id: 'Strategy',
        limit: 25,
      },
    });

    expect(result).toEqual({
      nodes: [{ id: 'domain-1', label: 'Strategy', type: 'ConsultingDomain' }],
      edges: [{ source: 'domain-1', target: 'flow-1', type: 'HAS_SUBPROCESS' }],
      totalCount: 1,
      lodLevel: 'overview',
    });
  });

  it('posts graph.search with canonical payload shape', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: [
          { id: 'flow-1', label: 'Approval Management', type: 'L1ProcessFlow', score: 1 },
        ],
      }),
    } as Response);

    const result = await graphSearch('approval', { nodeTypes: ['L1ProcessFlow'], limit: 10 });

    const body = JSON.parse(String((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body));
    expect(body).toEqual({
      tool: 'graph.search',
      payload: {
        query: 'approval',
        node_types: ['L1ProcessFlow'],
        limit: 10,
      },
    });

    expect(result).toEqual([
      { id: 'flow-1', label: 'Approval Management', type: 'L1ProcessFlow', score: 1 },
    ]);
  });
});
