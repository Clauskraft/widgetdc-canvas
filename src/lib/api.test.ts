import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchLibreChatRuntimeIntelligence } from './api';

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
