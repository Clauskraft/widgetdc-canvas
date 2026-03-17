import { describe, expect, it } from 'vitest';

import {
  artifactSurfaceToCanvasNode,
  librechatRuntimeToArtifactSurfacePayload,
  librechatRuntimeToCanvasNode,
  type LibreChatRuntimeIntelligencePayload,
} from './artifactSurface';

function buildLibreChatPayload(
  overrides: Partial<LibreChatRuntimeIntelligencePayload> = {},
): LibreChatRuntimeIntelligencePayload {
  return {
    contract_version: 'librechat.runtime.intelligence.v1',
    generated_at: '2026-03-17T10:00:00Z',
    chat: {
      headline: 'Strategic recommendation ready',
      response_markdown: 'Decision: accepted\nNext action: queue_for_render',
      next_action: 'queue_for_render',
      uncertainty_visible: false,
    },
    recommendation: {
      target_domain: 'nis2',
      decision: {
        decision: 'accepted',
        decision_reason: 'benchmark-backed',
        next_action: 'queue_for_render',
        benchmark_support: 0.91,
      },
      recommended_assembly: {
        assembly_id: 'assembly-nis2-pack',
        title: 'NIS2 Service Pack',
      },
    },
    artifact_surface: {
      contract_version: 'architecture.artifact.surface.v1',
      surface: 'librechat',
      artifact: {
        artifact_id: 'artifact-librechat-1',
        artifact_type: 'consulting_recommendation_pack',
        title: 'Embedded artifact',
        summary: 'Embedded summary',
        confidence: 0.91,
        quality_gate: 'pass',
      },
      lineage: {
        artifact_id: 'artifact-librechat-1',
        render_package_id: 'renderpkg-1',
        render_contract: 'foundry.render.sections.v1',
        source_graph_node_id: 'assembly-nis2-pack',
        source_graph_labels: ['ConsultingServiceAssembly'],
      },
      review: {
        state: 'export_ready',
        available_actions: ['queue_for_render'],
      },
      render: {
        render_package_id: 'renderpkg-1',
        contract: 'foundry.render.sections.v1',
        document_type: 'pptx',
      },
    },
    blockers: [],
    backend_runtime: {
      has_successful_consumption: true,
      has_failed_consumption: false,
      latest_receipt: null,
    },
    summary: {},
    lineage: {},
    ...overrides,
  };
}

describe('artifactSurface bridge', () => {
  it('preserves existing artifact surface mapping', () => {
    const result = artifactSurfaceToCanvasNode({
      contract_version: 'architecture.artifact.surface.v1',
      surface: 'canvas',
      artifact: {
        artifact_id: 'artifact-1',
        artifact_type: 'architecture_decision_pack',
        title: 'Decision Pack',
        summary: 'Existing path',
        quality_gate: 'pass',
      },
      lineage: {
        artifact_id: 'artifact-1',
        render_package_id: 'renderpkg-1',
        render_contract: 'foundry.render.sections.v1',
      },
      review: { state: 'review_requested' },
      render: {
        render_package_id: 'renderpkg-1',
        contract: 'foundry.render.sections.v1',
      },
    });

    expect(result.data.artifactId).toBe('artifact-1');
    expect(result.data.reviewState).toBe('review_requested');
  });

  it('projects librechat runtime payload onto artifact surface contract', () => {
    const result = librechatRuntimeToArtifactSurfacePayload(buildLibreChatPayload());

    expect(result.contract_version).toBe('architecture.artifact.surface.v1');
    expect(result.artifact.title).toBe('Strategic recommendation ready');
    expect(result.artifact.summary).toContain('Decision: accepted');
    expect(result.review.available_actions).toContain('queue_for_render');
  });

  it('maps blocked librechat runtime to stricter canvas metadata', () => {
    const result = librechatRuntimeToCanvasNode(
      buildLibreChatPayload({
        chat: {
          headline: 'Strategic recommendation blocked',
          response_markdown: 'Decision: blocked\nNext action: resolve_loose_end',
          next_action: 'resolve_loose_end',
          uncertainty_visible: true,
        },
        recommendation: {
          target_domain: 'vendor-replacement',
          decision: {
            decision: 'blocked',
            decision_reason: 'missing enterprise grounding',
            next_action: 'resolve_loose_end',
          },
          recommended_assembly: {
            assembly_id: 'assembly-vendor-replacement',
            title: 'Vendor Replacement Track',
          },
        },
        blockers: [{ kind: 'loose_end', id: 'le-1', title: 'Missing enterprise grounding' }],
        backend_runtime: {
          has_successful_consumption: false,
          has_failed_consumption: true,
          latest_receipt: { acknowledged: false },
        },
      }),
    );

    expect(result.data.subtitle).toBe('Strategic recommendation blocked');
    expect(result.data.regulatoryLevel).toBe('strict');
    expect(result.data.signalIntensity).toBe(0.95);
    expect((result.data.metadata as Record<string, unknown>).blockerCount).toBe(1);
    expect((result.data.metadata as Record<string, unknown>).hasFailedConsumption).toBe(true);
  });
});
