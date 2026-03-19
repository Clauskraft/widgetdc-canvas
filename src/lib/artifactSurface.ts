import type { CanvasNodeData, CanvasNodeType } from '../types/canvas';
import type { NodeLabel } from '@widgetdc/contracts/graph';

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

export interface LibreChatRuntimeBlocker {
  kind?: string;
  id?: string;
  title?: string;
  next_action?: string;
}

export interface LibreChatRuntimeIntelligencePayload {
  contract_version: 'librechat.runtime.intelligence.v1';
  generated_at: string;
  chat: {
    headline: string;
    response_markdown: string;
    next_action?: string;
    uncertainty_visible?: boolean;
  };
  recommendation: {
    target_domain?: string;
    decision?: {
      decision?: string;
      decision_reason?: string;
      next_action?: string;
      benchmark_support?: number;
    };
    recommended_assembly?: {
      assembly_id?: string;
      title?: string;
    };
  };
  artifact_surface: ArtifactSurfacePayload;
  blockers?: LibreChatRuntimeBlocker[];
  backend_runtime?: {
    has_successful_consumption?: boolean;
    has_failed_consumption?: boolean;
    latest_receipt?: Record<string, unknown> | null;
  };
  summary?: Record<string, unknown>;
  lineage?: Record<string, unknown>;
}

function inferCanvasNodeType(artifactType: string): CanvasNodeType {
  const value = artifactType.toLowerCase();
  if (value.includes('answer')) return 'StrategicLeverage';
  if (value.includes('pattern')) return 'KnowledgePattern';
  if (value.includes('control')) return 'GuardrailRule';
  if (value.includes('migration')) return 'Track';
  if (value.includes('replacement')) return 'Decision';
  return 'Artifact';
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
      sourceGraphLabels: (lineage.source_graph_labels ?? []) as NodeLabel[],
      sourceAssetIds,
      availableActions: review?.available_actions ?? [],
      signalIntensity: qualityGate === 'degraded' ? 0.95 : qualityGate === 'warning' ? 0.65 : 0.45,
      regulatoryLevel: qualityGate === 'degraded' ? 'strict' : qualityGate === 'warning' ? 'guideline' : 'info',
      provenance: {
        createdBy: 'ai',
        createdAt: artifact.updated_at ?? new Date().toISOString(),
        source: payload.surface,
        tool: lineage.surface_origin ?? undefined,
        confidence: typeof artifact.confidence === 'number' ? artifact.confidence : undefined,
      },
      metadata: {
        contractVersion: payload.contract_version,
        placement: payload.placement ?? {},
        verificationStatus: lineage.verification_status,
        bundleId: lineage.bundle_id,
        surfaceOrigin: lineage.surface_origin,
        routeToContract: `${payload.surface} -> ${lineage.render_contract}`,
      },
    },
  };
}

export function librechatRuntimeToArtifactSurfacePayload(
  payload: LibreChatRuntimeIntelligencePayload,
): ArtifactSurfacePayload {
  const embedded = payload?.artifact_surface;
  if (!embedded?.artifact?.artifact_id) {
    throw new Error('LibreChat runtime payload missing embedded artifact surface artifact_id');
  }

  const nextAction = payload.chat?.next_action ?? payload.recommendation?.decision?.next_action;
  const availableActions = Array.from(
    new Set([...(embedded.review?.available_actions ?? []), ...(nextAction ? [nextAction] : [])]),
  );

  return {
    ...embedded,
    artifact: {
      ...embedded.artifact,
      title: payload.chat?.headline || embedded.artifact.title,
      summary: payload.chat?.response_markdown || embedded.artifact.summary,
      updated_at: payload.generated_at || embedded.artifact.updated_at,
    },
    review: {
      ...embedded.review,
      available_actions: availableActions,
    },
  };
}

export function librechatRuntimeToCanvasNode(
  payload: LibreChatRuntimeIntelligencePayload,
): { type: CanvasNodeType; data: Partial<CanvasNodeData> } {
  const normalizedSurface = librechatRuntimeToArtifactSurfacePayload(payload);
  const mapped = artifactSurfaceToCanvasNode(normalizedSurface);
  const decision = payload.recommendation?.decision?.decision;
  const nextAction = payload.chat?.next_action ?? payload.recommendation?.decision?.next_action;
  const blockerCount = Array.isArray(payload.blockers) ? payload.blockers.length : 0;

  return {
    type: mapped.type,
    data: {
      ...mapped.data,
      subtitle: payload.chat?.headline || mapped.data.subtitle,
      artifactSource: payload.chat?.response_markdown || mapped.data.artifactSource,
      availableActions: Array.from(
        new Set([...(Array.isArray(mapped.data.availableActions) ? mapped.data.availableActions : []), ...(nextAction ? [nextAction] : [])]),
      ),
      signalIntensity:
        decision === 'blocked'
          ? 0.95
          : blockerCount > 0
            ? 0.8
            : mapped.data.signalIntensity,
      regulatoryLevel:
        decision === 'blocked'
          ? 'strict'
          : blockerCount > 0
            ? 'guideline'
            : mapped.data.regulatoryLevel,
      metadata: {
        ...((mapped.data.metadata as Record<string, unknown> | undefined) ?? {}),
        librechatContractVersion: payload.contract_version,
        librechatHeadline: payload.chat?.headline,
        librechatNextAction: nextAction,
        librechatDecision: decision,
        librechatDecisionReason: payload.recommendation?.decision?.decision_reason,
        targetDomain: payload.recommendation?.target_domain,
        blockerCount,
        uncertaintyVisible: Boolean(payload.chat?.uncertainty_visible),
        hasSuccessfulConsumption: Boolean(payload.backend_runtime?.has_successful_consumption),
        hasFailedConsumption: Boolean(payload.backend_runtime?.has_failed_consumption),
        latestReceipt: payload.backend_runtime?.latest_receipt ?? null,
      },
    },
  };
}
