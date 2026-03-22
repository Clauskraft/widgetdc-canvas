import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchGovernanceEvalSnapshot,
  fetchLibreChatRuntimeIntelligence,
  mcpCall,
  fetchOrchestratorRoutingSnapshot,
  graphSearch,
  graphWindow,
  reasonCall,
} from './api';

describe('Canvas API: LibreChat runtime intelligence', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('posts the canonical request body to the LibreChat runtime endpoint', async () => {
    vi.stubEnv('VITE_RLM_URL', 'https://rlm.example');
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
      'https://rlm.example/intelligence/librechat/runtime-intelligence',
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

describe('Canvas API: MCP route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('uses the canonical backend base URL when configured', async () => {
    vi.stubEnv('VITE_API_URL', 'https://backend.example');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await mcpCall('ping');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example/api/mcp/route',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('omits auth headers when no API key is configured in the browser build', async () => {
    vi.stubEnv('VITE_API_URL', 'https://backend.example');
    vi.stubEnv('VITE_API_KEY', '');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    await mcpCall('ping');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example/api/mcp/route',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
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
            verifiedUnreviewedCount: 12,
            operatorQualityStatus: 'red',
            verifiedUnreviewedCriticalCount: 0,
            oldestVerifiedUnreviewedAgeMinutes: 71.07,
            operatorReviewBacklogStatus: 'yellow',
            failureMemoryClassCount: 2,
            recurringFailureClassCount: 1,
            failureMemoryBacklogStatus: 'red',
            failureMemoryBacklogTop: [
              {
                sourceName: 'legofactory:quality_gate',
                totalFailures: 4,
                uniqueErrorTypes: 2,
                recoverySuccessRate: 0.25,
                averageRecoveryTime: 7200,
                isRecurring: true,
                lastFailureAt: '2026-03-19T10:00:00.000Z',
                recommendedAction: 'raise_quality_floor',
              },
              {
                sourceName: 'legofactory:source_verification',
                totalFailures: 2,
                uniqueErrorTypes: 1,
                recoverySuccessRate: 0.5,
                averageRecoveryTime: 1800,
                isRecurring: false,
                lastFailureAt: '2026-03-18T08:00:00.000Z',
                recommendedAction: 'restore_source_verification',
              },
            ],
            reviewBacklogTop: [
              {
                decisionId: 'ra-evidence-packet-poll-7-1773884999',
                engagementId: 'ENG-LF-C1A-1773766946059',
                verifiedAt: '2026-03-19T01:50:00.37Z',
                ageMinutes: 71.07,
                hasRoute: true,
              },
            ],
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          windowDays: 30,
          limit: 5,
          queueSummary: {
            queueName: 'operator-review-backlog',
            status: 'yellow',
            unreviewedCount: 12,
            criticalCount: 0,
            oldestAgeMinutes: 71.07,
            outputCount: 5,
          },
          items: [{
            decisionId: 'ra-evidence-packet-poll-7-1773884999',
            engagementId: 'ENG-LF-C1A-1773766946059',
            verifiedAt: '2026-03-19T01:50:00.37Z',
            ageMinutes: 71.07,
            hasRoute: true,
          }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          windowDays: 30,
          limit: 5,
          queueSummary: {
            queueName: 'tri-source-arbitration-backlog',
            status: 'green',
            divergentCount: 0,
            unreviewedCount: 0,
            reversedCount: 0,
            oldestAgeMinutes: null,
            outputCount: 0,
          },
          items: [],
        }),
      } as Response);

    const result = await fetchGovernanceEvalSnapshot();

    const governanceCalls = fetchMock.mock.calls.slice(-5);
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
      [
        '/api/governance/review-backlog?days=30&limit=5',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      ],
      [
        '/api/governance/arbitration-backlog?days=30&limit=5',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      ],
    ]);
    expect(result.contractVersion).toBe('canvas.downstream.eval.v1');
    expect(result.readOnly).toBe(true);
    expect(result.legoFactory.queueSummary.blocked).toBe(2);
    expect(result.memory.memoryConnectionCoverage).toBe(0.022);
    expect(result.scorecard.failureMemoryClassCount).toBe(2);
    expect(result.scorecard.recurringFailureClassCount).toBe(1);
    expect(result.scorecard.failureMemoryBacklogStatus).toBe('red');
    expect(result.scorecard.failureMemoryBacklogTop?.[0]?.sourceName).toBe('legofactory:quality_gate');
    expect(result.reviewBacklog.queueSummary.status).toBe('yellow');
    expect(result.reviewBacklog.items[0]?.decisionId).toBe('ra-evidence-packet-poll-7-1773884999');
    expect(result.arbitrationBacklog.queueSummary.status).toBe('green');
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
    const responsePayload = {
      success: true,
      result: {
        nodes: [{ id: 'domain-1', label: 'Strategy', type: 'ConsultingDomain' }],
        edges: [{ source: 'domain-1', target: 'flow-1', type: 'HAS_SUBPROCESS' }],
        total_count: 1,
        lod_level: 'overview',
      },
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(responsePayload),
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
    const responsePayload = {
      success: true,
      result: {
        results: [
          { id: 'flow-1', label: 'Approval Management', type: 'L1ProcessFlow', score: 1 },
        ],
      },
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(responsePayload),
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

describe('Canvas API: reason route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('posts the canonical reason payload shape', async () => {
    vi.stubEnv('VITE_RLM_URL', 'https://rlm.example');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        recommendation: 'Use the baseline /reason path.',
        thinking_steps: ['Inspect graph context', 'Route through RLM'],
        confidence: 0.92,
        sources: ['policy-graph'],
      }),
    } as Response);

    const longPrompt = 'widgetdc '.repeat(40);
    const result = await reasonCall(longPrompt, { domain: 'consulting' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://rlm.example/reason',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(String((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body));
    expect(body).toEqual({
      task: longPrompt,
      context: {
        domain: 'consulting',
        enriched_prompt: longPrompt,
      },
    });
    expect(result).toEqual({
      recommendation: 'Use the baseline /reason path.',
      thinking_steps: ['Inspect graph context', 'Route through RLM'],
      confidence: 0.92,
      sources: ['policy-graph'],
    });
  });
});

describe('Canvas API: RLM reasoning route', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts /reason with canonical task payload shape', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        recommendation: 'Use the baseline /reason path.',
        thinking_steps: ['Inspect graph context', 'Route through RLM'],
        confidence: 0.92,
        sources: ['policy-graph'],
      }),
    } as Response);

    const longPrompt = 'widgetdc '.repeat(40);
    const result = await reasonCall(longPrompt, { domain: 'consulting' });

    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe('/reason');
    expect(init).toEqual(expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));

    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      task: longPrompt,
      context: {
        domain: 'consulting',
        enriched_prompt: longPrompt,
      },
    });

    expect(result.recommendation).toBe('Use the baseline /reason path.');
  });
});
