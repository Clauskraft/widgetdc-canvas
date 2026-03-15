import type { CanvasNodeData, CanvasNodeType } from '../types/canvas';

export interface ArtifactSurfacePayload {
  contract_version: string;
  surface: 'consulting' | 'canvas' | 'librechat';
  artifact: {
    artifact_id: string;
    artifact_type: string;
    title: string;
    summary?: string;
    status?: string;
    confidence?: number;
    quality_gate?: 'pass' | 'warning' | 'degraded';
    updated_at?: string;
  };
  lineage: {
    artifact_id: string;
    source_graph_node_id?: string | null;
    source_graph_labels?: string[];
    verification_status?: string;
    bundle_id?: string | null;
    render_package_id: string;
    render_contract: string;
    source_asset_ids?: string[];
    surface_origin?: string;
  };
  review: {
    state: CanvasNodeData['reviewState'];
    quality_gate?: 'pass' | 'warning' | 'degraded';
    available_actions?: string[];
  };
  placement?: {
    primary?: string;
    native_surface?: string;
  };
  render: {
    render_package_id: string;
    contract: string;
    document_type?: string;
    section_count?: number;
    used_assets?: string[];
  };
  backend_targets?: string[];
}

function inferCanvasNodeType(artifactType: string): CanvasNodeType {
  const value = artifactType.toLowerCase();
  if (value.includes('answer')) return 'answer-block';
  if (value.includes('pattern')) return 'pattern';
  if (value.includes('control')) return 'control-pack';
  if (value.includes('migration')) return 'migration-path';
  if (value.includes('replacement')) return 'replacement-candidate';
  return 'artifact';
}

export function artifactSurfaceToCanvasNode(
  payload: ArtifactSurfacePayload,
): { type: CanvasNodeType; data: Partial<CanvasNodeData> } {
  const artifact = payload?.artifact;
  const lineage = payload?.lineage;
  const review = payload?.review;
  const render = payload?.render;

  if (!artifact?.artifact_id) {
    throw new Error('Artifact surface payload missing artifact_id');
  }
  if (!lineage?.render_package_id) {
    throw new Error('Artifact surface payload missing render_package_id');
  }
  if (!lineage?.render_contract) {
    throw new Error('Artifact surface payload missing render_contract');
  }

  const qualityGate = artifact.quality_gate ?? review?.quality_gate ?? 'warning';
  const reviewState = review?.state ?? 'draft';
  const sourceAssetIds = Array.from(new Set([...(lineage.source_asset_ids ?? []), ...(render.used_assets ?? [])]));
  const subtitleBits = [
    artifact.artifact_type,
    reviewState,
    qualityGate,
  ].filter(Boolean);

  return {
    type: inferCanvasNodeType(artifact.artifact_type),
    data: {
      label: artifact.title || artifact.artifact_id,
      subtitle: artifact.summary || subtitleBits.join(' • '),
      nodeType: inferCanvasNodeType(artifact.artifact_type),
      artifactType: render.document_type === 'pptx' ? 'markdown' : 'summary',
      artifactSource: artifact.summary,
      artifactId: artifact.artifact_id,
      artifactFamily: artifact.artifact_type,
      complianceScore: typeof artifact.confidence === 'number' ? artifact.confidence : undefined,
      qualityGate,
      reviewState,
      renderContract: lineage.render_contract,
      renderPackageId: lineage.render_package_id,
      sourceGraphNodeId: lineage.source_graph_node_id ?? undefined,
      sourceGraphLabels: lineage.source_graph_labels ?? [],
      sourceAssetIds,
      availableActions: review?.available_actions ?? [],
      signalIntensity: qualityGate === 'degraded' ? 0.95 : qualityGate === 'warning' ? 0.65 : 0.45,
      regulatoryLevel: qualityGate === 'degraded' ? 'strict' : qualityGate === 'warning' ? 'guideline' : 'info',
      provenance: {
        createdBy: 'ai',
        createdAt: artifact.updated_at ?? new Date().toISOString(),
        source: payload.surface,
        confidence: typeof artifact.confidence === 'number' ? artifact.confidence : undefined,
      },
      metadata: {
        contractVersion: payload.contract_version,
        placement: payload.placement ?? {},
        verificationStatus: lineage.verification_status,
        bundleId: lineage.bundle_id,
        surfaceOrigin: lineage.surface_origin,
      },
    },
  };
}
