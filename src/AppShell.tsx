import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';

import { Canvas } from './components/Canvas';
import { CanvasCollaboration } from './components/CanvasCollaboration';
import { ToolPalette } from './components/ToolPalette';
import { NodeInspector } from './components/NodeInspector';
import { CommandPalette } from './components/CommandPalette';
import { ToastProvider, useToast } from './components/Toast';
import { SnoutObserver } from './components/SnoutObserver';
import { PheromonePanel } from './components/PheromonePanel';
// LIN-584: AIPanel, Journal, StatusBar deleted — replaced by Open WebUI tools
import { useCanvasStore, type CanvasSurface } from './store/canvasStore';
import {
  fetchAgentInbox,
  fetchAgentRouterPhonebook,
  type AgentInboxMessage,
  type AgentPhonebookEntry,
  type InnovationApprovalProofResponse,
  fetchWorkRunCockpit,
  type WorkRunCanvasProjection,
} from './lib/api';

// UC5 imports
import { useCanvasSession } from './state/canvasSession';
import { attachBridge, emitSessionReady } from './bridge/hostBridge';
import { TextPane } from './panes/TextPane';
import { SlidePane } from './panes/SlidePane';
import { DrawioEmbed } from './panes/DrawioEmbed';
import { SplitPaneLayout } from './layouts/SplitPaneLayout';
import type { BuilderTrack, CanvasModeId, PaneId, ProductFrameId } from './types/session';

export const DEBUG_BUILD_STAMP = 'UC5-2026-04-18';

export function resolveCockpitUrl(): string {
  const configured = String(import.meta.env.VITE_COCKPIT_URL ?? '').trim().replace(/\/$/, '');
  return configured || '/api/consulting-cockpit/stats';
}

// ── UC5 URL param reading ─────────────────────────────────────────────────────

interface UC5Params {
  sessionId: string | null;
  track: BuilderTrack | null;
  pane: PaneId | null;
  workrunId: string | null;
}

const VALID_TRACKS: ReadonlySet<string> = new Set([
  'textual', 'slide_flow', 'diagram', 'architecture', 'graphical', 'code', 'experiment',
]);
const VALID_PANES: ReadonlySet<string> = new Set([
  'canvas', 'markdown', 'slides', 'drawio', 'split',
]);

function readUC5Params(): UC5Params {
  const url = new URL(window.location.href);
  const sessionId = url.searchParams.get('session');
  const rawTrack = url.searchParams.get('track') ?? '';
  const rawPane = url.searchParams.get('pane') ?? '';
  const workrunId = url.searchParams.get('workrun');

  return {
    sessionId: sessionId ?? null,
    track: VALID_TRACKS.has(rawTrack) ? (rawTrack as BuilderTrack) : null,
    pane: VALID_PANES.has(rawPane) ? (rawPane as PaneId) : null,
    workrunId: workrunId ?? null,
  };
}

/** Returns true if the app was launched with UC5 session params */
function isUC5Mode(): boolean {
  const { sessionId } = readUC5Params();
  return sessionId !== null;
}

function isLegacyMode(): boolean {
  // Legacy ReactFlow component-library canvas is now opt-in via `?legacy=1`.
  // UC5/cockpit (with C8 BlankCanvasEntrySurface + C9 ActionRail) is the
  // default operator entry surface per CANVAS_C8_BLANK_CANVAS_ENTRY_SPEC.
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const legacy = params.get('legacy');
  return legacy === '1' || legacy === 'true';
}

// ── UC5 Pane router ───────────────────────────────────────────────────────────

function UC5PaneRouter() {
  const activePane = useCanvasSession((s) => s.activePane);
  const track = useCanvasSession((s) => s.track);

  // The canvas pane re-uses the legacy ReactFlow Canvas — it is already
  // mounted in the UC5 shell below. This router only governs the non-canvas panes.
  switch (activePane) {
    case 'markdown':
      return <TextPane />;
    case 'slides':
      return <SlidePane />;
    case 'drawio':
      return <DrawioEmbed />;
    case 'split':
      return (
        <SplitPaneLayout
          left={<LegacyCanvas />}
          right={<TextPane />}
        />
      );
    case 'canvas':
    default:
      return <LegacyCanvas track={track} />;
  }
}

// ── Thin wrapper around legacy ReactFlow canvas ───────────────────────────────

function LegacyCanvas({ track }: { track?: BuilderTrack | null }) {
  const trackHue = track
    ? `var(--sc-track-${track.replace('_', '-')})`
    : 'var(--sc-ink-graphite)';
  const productFrameId = useCanvasSession((s) => s.productFrameId);
  const resolvedFrame = resolveShellFrame(productFrameId, track ?? null);
  const frameLabel = resolvedFrame ? FRAME_REGISTRY[resolvedFrame].label : humanizeTrack(track ?? null);

  return (
    <div
      className="sc-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--sc-surface-bg)',
        position: 'relative',
      }}
    >
      <div
        style={{
          padding: 'var(--sc-pane-pad) var(--sc-pane-pad) 0',
        }}
      >
        <div className="sc-pane-head">
          <span className="sc-pane-label" style={{ color: trackHue }}>
            {`Canvas · ${frameLabel}`}
          </span>
          <span className="sc-pane-meta">{frameLabel ? `frame · ${frameLabel}` : 'no frame'}</span>
        </div>
      </div>
      {/* ReactFlow canvas fills the remaining space */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <ToolPalette />
        <Canvas />
        <NodeInspector />
        <CanvasCollaboration />
        <SnoutObserver />
        <PheromonePanel />
      </div>
    </div>
  );
}

// ── UC5 Track legend ──────────────────────────────────────────────────────────

const TRACKS: Array<{ key: BuilderTrack; label: string; index: number }> = [
  { key: 'textual', label: 'T1 · textual', index: 1 },
  { key: 'slide_flow', label: 'T2 · slide flow', index: 2 },
  { key: 'diagram', label: 'T3 · diagram', index: 3 },
  { key: 'architecture', label: 'T4 · architecture', index: 4 },
  { key: 'graphical', label: 'T5 · graphical', index: 5 },
  { key: 'code', label: 'T6 · code', index: 6 },
  { key: 'experiment', label: 'T7 · experiment', index: 7 },
];

const FRAME_REGISTRY: Record<ProductFrameId, {
  label: string;
  strapline: string;
  tint: string;
}> = {
  'book.authoring': {
    label: 'Book Authoring',
    strapline: 'long-form structure · chapter cadence · manuscript flow',
    tint: 'var(--sc-track-textual)',
  },
  'software.feature-delivery': {
    label: 'Software Feature Delivery',
    strapline: 'brief to implementation · capability targeting · traceable runtime',
    tint: 'var(--sc-track-code)',
  },
  'consulting.discovery': {
    label: 'Consulting Discovery',
    strapline: 'framework fit · stakeholder narrative · decision-ready outputs',
    tint: 'var(--sc-track-slide-flow)',
  },
  'architecture.system-design': {
    label: 'Architecture System Design',
    strapline: 'system topology · pattern fit · artifact traceability',
    tint: 'var(--sc-track-architecture)',
  },
  'research.synthesis': {
    label: 'Research Synthesis',
    strapline: 'evidence first · synthesis spine · governed outputs',
    tint: 'var(--sc-track-graphical)',
  },
};

const TRACK_FRAME_FALLBACK: Record<BuilderTrack, ProductFrameId> = {
  textual: 'research.synthesis',
  slide_flow: 'consulting.discovery',
  diagram: 'architecture.system-design',
  architecture: 'architecture.system-design',
  graphical: 'research.synthesis',
  code: 'software.feature-delivery',
  experiment: 'research.synthesis',
};

const TRACK_MODE_FALLBACK: Record<BuilderTrack, CanvasModeId[]> = {
  textual: ['document', 'split'],
  slide_flow: ['slides', 'document', 'split'],
  diagram: ['diagram', 'graph', 'split'],
  architecture: ['graph', 'diagram', 'document', 'split'],
  graphical: ['graph', 'document', 'split'],
  code: ['document', 'graph', 'diff'],
  experiment: ['split', 'timeline', 'document'],
};

function humanizeTrack(track: BuilderTrack | null): string {
  if (!track) return 'No Track';
  return TRACKS.find((entry) => entry.key === track)?.label ?? track.replace('_', ' ');
}

export function naturalPaneForTrack(track: BuilderTrack): PaneId {
  switch (track) {
    case 'textual':
    case 'code':
      return 'markdown';
    case 'slide_flow':
      return 'slides';
    case 'diagram':
      return 'drawio';
    case 'architecture':
    case 'experiment':
      return 'split';
    case 'graphical':
    default:
      return 'canvas';
  }
}

function humanizeMode(mode: CanvasModeId): string {
  return mode.replace(/_/g, ' ');
}

function paneToMode(pane: PaneId): CanvasModeId {
  switch (pane) {
    case 'markdown':
      return 'document';
    case 'slides':
      return 'slides';
    case 'drawio':
      return 'diagram';
    case 'split':
      return 'split';
    case 'canvas':
    default:
      return 'graph';
  }
}

function modeToPane(mode: CanvasModeId): PaneId {
  switch (mode) {
    case 'document':
      return 'markdown';
    case 'slides':
      return 'slides';
    case 'diagram':
      return 'drawio';
    case 'graph':
      return 'canvas';
    case 'split':
      return 'split';
    case 'timeline':
    case 'diff':
    case 'inspector':
    case 'risk_overlay':
      return 'canvas';
    default:
      return 'canvas';
  }
}

function resolveShellFrame(
  productFrameId: ProductFrameId | null,
  track: BuilderTrack | null,
): ProductFrameId | null {
  if (productFrameId) return productFrameId;
  if (!track) return null;
  return TRACK_FRAME_FALLBACK[track];
}

function resolveShellModes(
  allowedModes: CanvasModeId[],
  track: BuilderTrack | null,
): CanvasModeId[] {
  if (allowedModes.length > 0) return allowedModes;
  if (!track) return [];
  return TRACK_MODE_FALLBACK[track];
}

function TrackLegend() {
  const track = useCanvasSession((s) => s.track);
  const switchPane = useCanvasSession((s) => s.switchPane);
  const activePane = useCanvasSession((s) => s.activePane);
  const productFrameId = useCanvasSession((s) => s.productFrameId);
  const resolvedFrame = resolveShellFrame(productFrameId, track);
  const resolvedTint = resolvedFrame ? FRAME_REGISTRY[resolvedFrame].tint : null;

  return (
    <nav
      aria-label="Builder tracks"
      style={{
        display: 'flex',
        gap: '22px',
        padding: '14px var(--sc-pane-pad) 20px',
        borderBottom: '0.5px solid var(--sc-paper-whisper)',
        flexWrap: 'wrap',
        background: 'var(--sc-surface-bg)',
        flexShrink: 0,
      }}
    >
      {TRACKS.map((t) => {
        const isActive = t.key === track;
        const hue = `var(--sc-track-${t.key.replace('_', '-')})`;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              // Map track to its natural pane
              const paneMap: Record<BuilderTrack, PaneId> = {
                textual: naturalPaneForTrack('textual'),
                slide_flow: naturalPaneForTrack('slide_flow'),
                diagram: naturalPaneForTrack('diagram'),
                architecture: naturalPaneForTrack('architecture'),
                graphical: naturalPaneForTrack('graphical'),
                code: naturalPaneForTrack('code'),
                experiment: naturalPaneForTrack('experiment'),
              };
              switchPane(paneMap[t.key]);
            }}
            aria-pressed={isActive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '10px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: isActive ? (resolvedTint ?? 'var(--sc-ink-graphite)') : hue,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 0',
              fontWeight: isActive ? 500 : 400,
              transition: `color var(--sc-duration-quick) var(--sc-ease-emphasized)`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                background: hue,
                opacity: 0.88,
                borderRadius: '1px',
                flexShrink: 0,
              }}
            />
            {t.label}
          </button>
        );
      })}

      {/* Pane switcher pills */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(['canvas', 'markdown', 'slides', 'drawio', 'split'] as PaneId[]).map((pane) => {
          const isActive = pane === activePane;
          return (
            <button
              key={pane}
              type="button"
              onClick={() => switchPane(pane)}
              aria-pressed={isActive}
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: 'var(--sc-tracking-label)',
                textTransform: 'uppercase',
                color: isActive ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-fog)',
                background: 'transparent',
                border: '0.5px solid',
                borderColor: isActive ? 'var(--sc-ink-graphite)' : 'var(--sc-paper-whisper)',
                borderRadius: 'var(--sc-radius-sm)',
                padding: '3px 8px',
                cursor: 'pointer',
                transition: `all var(--sc-duration-quick) var(--sc-ease-emphasized)`,
              }}
            >
              {pane}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function MissionHeader({ projection }: { projection: WorkRunCanvasProjection | null }) {
  const track = useCanvasSession((s) => s.track);
  const activePane = useCanvasSession((s) => s.activePane);
  const productFrameId = useCanvasSession((s) => s.productFrameId);
  const domainProfileId = useCanvasSession((s) => s.domainProfileId);
  const starterTemplateIds = useCanvasSession((s) => s.starterTemplateIds);
  const allowedModes = useCanvasSession((s) => s.allowedModes);
  const requiredCapabilityIds = useCanvasSession((s) => s.requiredCapabilityIds);
  const requiredEvaluationHookIds = useCanvasSession((s) => s.requiredEvaluationHookIds);
  const rationale = useCanvasSession((s) => s.rationale);
  const isHydrating = useCanvasSession((s) => s.isHydrating);

  const resolvedFrame = resolveShellFrame(productFrameId, track);
  const frameMeta = resolvedFrame ? FRAME_REGISTRY[resolvedFrame] : null;
  const resolvedModes = resolveShellModes(allowedModes, track);
  const modeSource = allowedModes.length > 0 ? 'frame-native' : 'track fallback';
  const trackLabel = humanizeTrack(track);
  const activeMode = humanizeMode(paneToMode(activePane));
  const primaryTrustArtifact = projection?.artifacts.find((artifact) => artifact.trust_scope === 'canonical')
    ?? projection?.artifacts[0]
    ?? null;
  const trustSummary = primaryTrustArtifact?.trust_scope === 'canonical'
    ? `Canonical · ${(primaryTrustArtifact.signing_pubkey ?? '').slice(0, 8) || 'unknown'}`
    : primaryTrustArtifact?.trust_scope
      ? `Ephemeral · ${primaryTrustArtifact.trust_scope.replace(/^ephemeral-?/, '')}`
      : 'Unsigned';
  const missionTitle = projection?.brief
    ?? frameMeta?.label
    ?? trackLabel;
  const missionStatus = projection?.status ?? (isHydrating ? 'HYDRATING' : 'READY');

  return (
    <section
      aria-label="Mission header"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.85fr)',
        gap: '18px',
        padding: '18px var(--sc-pane-pad) 20px',
        borderBottom: '0.5px solid var(--sc-paper-whisper)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(248,249,251,0.72))',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '10px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: frameMeta?.tint ?? 'var(--sc-ink-graphite)',
            }}
          >
            {resolvedFrame ? `Frame · ${frameMeta?.label}` : `Track · ${trackLabel}`}
          </span>
          <span
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--sc-ink-fog)',
            }}
          >
            {productFrameId ? 'frame-native' : 'track fallback'}
          </span>
          {isHydrating ? (
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--sc-ink-fog)',
              }}
            >
              hydrating
            </span>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontSize: '28px',
              lineHeight: 1.15,
              color: 'var(--sc-ink-graphite)',
              letterSpacing: '-0.03em',
              fontWeight: 500,
              maxWidth: '22ch',
            }}
          >
            {missionTitle}
          </span>
          <span
            style={{
              fontSize: '12px',
              lineHeight: 1.55,
              color: 'var(--sc-ink-fog)',
              maxWidth: '76ch',
            }}
          >
            {frameMeta?.strapline ?? `Current shell remains governed by ${trackLabel.toLowerCase()}.`}
          </span>
        </div>

        <span
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, max-content))',
            gap: '10px',
            alignItems: 'center',
            width: 'fit-content',
            maxWidth: '100%',
          }}
        >
          {[
            { label: 'Track', value: trackLabel },
            { label: 'Mode', value: activeMode },
            { label: 'Status', value: missionStatus },
            { label: 'Trust', value: trustSummary },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: 'var(--sc-radius-md)',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.52)',
                minWidth: '120px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--sc-ink-fog)',
                  marginBottom: '5px',
                }}
              >
                {item.label}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>{item.value}</div>
            </div>
          ))}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '12px',
          minWidth: 0,
        }}
      >
        <div
          style={{
            border: '0.5px solid var(--sc-paper-whisper)',
            borderRadius: 'var(--sc-radius-md)',
            padding: '12px',
            background: 'rgba(255,255,255,0.44)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--sc-ink-fog)',
              marginBottom: '6px',
            }}
          >
            Modes · {modeSource}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {resolvedModes.map((mode) => (
              <span
                key={mode}
                style={{
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--sc-ink-graphite)',
                  border: '0.5px solid var(--sc-paper-whisper)',
                  borderRadius: '999px',
                  padding: '3px 8px',
                }}
              >
                {humanizeMode(mode)}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            border: '0.5px solid var(--sc-paper-whisper)',
            borderRadius: 'var(--sc-radius-md)',
            padding: '12px',
            background: 'rgba(255,255,255,0.44)',
            display: 'grid',
            gap: '6px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--sc-ink-fog)',
            }}
          >
            Mission Contracts
          </div>
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>
            {starterTemplateIds.length} starter templates
          </span>
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>
            {requiredCapabilityIds.length} required capabilities
          </span>
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>
            {requiredEvaluationHookIds.length} evaluation hooks
          </span>
          {domainProfileId ? (
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>
              Domain · {domainProfileId}
            </span>
          ) : null}
          {rationale.length > 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>
              Rationale · {rationale.length} checks
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function seedWorkRunProjection(payload: WorkRunCanvasProjection) {
  const store = useCanvasStore.getState();
  const existing = store.nodes.some((node) => {
    const metadata = node.data.metadata as Record<string, unknown> | undefined;
    return metadata?.workrunProjectionId === payload.id;
  });
  if (existing) return;

  const runNodeId = store.addNodeWithData('Track', {
    label: payload.canonical_pattern ?? payload.id,
    subtitle: payload.brief ?? 'Live WorkRun',
    nodeType: 'Track',
    metadata: {
      workrunProjectionId: payload.id,
      workrunStatus: payload.status,
      sourcePhantomRunId: payload.source_phantom_run_id,
      workspecId: payload.workspec_id,
      domainProfileId: payload.domain_profile_id,
    },
  }, { x: 180, y: 220 });

  if (payload.workspec_id || payload.workspec_name) {
    store.addNodeWithData('Claim', {
      label: payload.workspec_name ?? payload.workspec_id ?? 'WorkSpec',
      subtitle: payload.workspec_id ?? undefined,
      nodeType: 'Claim',
      metadata: {
        workrunProjectionId: payload.id,
        workcoreKind: 'workspec',
      },
    }, { x: 520, y: 180 });
  }

  payload.workitems.slice(0, 6).forEach((item, index) => {
    store.addNodeWithData('Decision', {
      label: item.title ?? item.id,
      subtitle: [item.kind, item.status].filter(Boolean).join(' · '),
      nodeType: 'Decision',
      metadata: {
        workrunProjectionId: payload.id,
        workitemId: item.id,
        workcoreKind: 'workitem',
        orderIndex: item.order_index,
      },
    }, { x: 520 + (index % 2) * 280, y: 320 + Math.floor(index / 2) * 150 });
  });

  payload.artifacts.slice(0, 4).forEach((artifact, index) => {
    const trustScope = artifact.trust_scope ?? undefined;
    const pubkeyPrefix =
      artifact.signing_pubkey && artifact.signing_pubkey.length >= 8
        ? artifact.signing_pubkey.slice(0, 8)
        : undefined;
    const trustBadgeLabel =
      trustScope === 'canonical'
        ? `CANONICAL · ${pubkeyPrefix ?? 'unsigned'}`
        : trustScope
          ? `EPHEMERAL · ${trustScope.replace(/^ephemeral-?/, '')}`
          : 'UNSIGNED';
    store.addNodeWithData('Artifact', {
      label: artifact.title ?? artifact.id,
      subtitle: [artifact.artifact_type, artifact.status, artifact.verified_at].filter(Boolean).join(' · '),
      nodeType: 'Artifact',
      artifactId: artifact.id,
      artifactFamily: artifact.artifact_type ?? undefined,
      reviewState: trustScope === 'canonical' ? 'canonical' : trustScope ? 'ephemeral' : 'unsigned',
      qualityGate: trustBadgeLabel,
      metadata: {
        workrunProjectionId: payload.id,
        workcoreKind: 'workartifact',
        trustScope,
        signingPubkey: artifact.signing_pubkey,
        verifiedAt: artifact.verified_at,
        verificationStatus: trustBadgeLabel,
        controlHubs: artifact.control_hubs,
      },
    }, { x: 1120, y: 240 + index * 150 });
  });

  store.selectNode(runNodeId);
}

export function WorkRunCockpitStrip({ projection }: { projection: WorkRunCanvasProjection | null }) {
  if (!projection) return null;

  const primaryHub = projection.artifacts.flatMap((artifact) => artifact.control_hubs ?? [])[0] ?? null;
  const firstArtifact = projection.artifacts[0] ?? null;
  const nextWorkItem = projection.workitems.find((item) => item.status !== 'completed') ?? projection.workitems[0] ?? null;

  return (
    <section
      aria-label="Live WorkRun cockpit"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
        gap: '18px',
        padding: '14px var(--sc-pane-pad) 18px',
        borderBottom: '0.5px solid var(--sc-paper-whisper)',
        background: 'rgba(244, 248, 255, 0.64)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'grid', gap: '8px' }}>
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-track-architecture)',
          }}
        >
          Live WorkRun · {projection.id}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--sc-ink-graphite)' }}>
          {projection.brief ?? projection.canonical_pattern ?? 'Live runtime projection'}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
          Status · {projection.status ?? 'unknown'}
          {projection.all_moves_canonical ? ' · All moves canonical' : ''}
          {projection.completed_at ? ` · Completed ${projection.completed_at}` : ''}
          {projection.workspec_name ? ` · Spec · ${projection.workspec_name}` : ''}
          {projection.domain_profile_name ? ` · Domain · ${projection.domain_profile_name}` : ''}
        </span>
        {firstArtifact ? (
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
            First artifact · {firstArtifact.title ?? firstArtifact.id}
          </span>
        ) : null}
        {nextWorkItem ? (
          <span style={{ fontSize: '12px', color: 'var(--sc-track-code)' }}>
            Recommended next action · {nextWorkItem.title ?? nextWorkItem.id}
          </span>
        ) : null}
        {primaryHub ? (
          <span style={{ fontSize: '12px', color: 'var(--sc-track-architecture)' }}>
            Hub · {primaryHub}
          </span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: '12px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '12px',
          }}
        >
        <div style={{ border: '0.5px solid var(--sc-paper-whisper)', borderRadius: 'var(--sc-radius-md)', padding: '12px', background: 'rgba(255,255,255,0.5)' }}>
          <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--sc-ink-fog)' }}>WorkItems</div>
          <div style={{ fontSize: '18px', color: 'var(--sc-ink-graphite)', marginTop: '6px' }}>{projection.workitems.length}</div>
        </div>
        <div style={{ border: '0.5px solid var(--sc-paper-whisper)', borderRadius: 'var(--sc-radius-md)', padding: '12px', background: 'rgba(255,255,255,0.5)' }}>
          <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--sc-ink-fog)' }}>Artifacts</div>
          <div style={{ fontSize: '18px', color: 'var(--sc-ink-graphite)', marginTop: '6px' }}>{projection.artifacts.length}</div>
        </div>
        <div style={{ border: '0.5px solid var(--sc-paper-whisper)', borderRadius: 'var(--sc-radius-md)', padding: '12px', background: 'rgba(255,255,255,0.5)' }}>
          <div style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--sc-ink-fog)' }}>Source</div>
          <div style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', marginTop: '6px' }}>
            {projection.source_phantom_run_id ?? projection.profile_id ?? 'native'}
          </div>
        </div>
      </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          {projection.artifacts.map((artifact) => {
            const trustScope = artifact.trust_scope ?? null;
            const pubkeyPrefix = artifact.signing_pubkey ? artifact.signing_pubkey.slice(0, 8) : null;
            const badge =
              trustScope === 'canonical'
                ? { label: `CANONICAL · ${pubkeyPrefix ?? 'unknown'}`, color: '#166534', background: 'rgba(22,101,52,0.12)', border: 'rgba(34,197,94,0.35)' }
                : trustScope
                  ? { label: `EPHEMERAL · ${trustScope.replace(/^ephemeral-?/, '')}`, color: '#92400e', background: 'rgba(146,64,14,0.12)', border: 'rgba(245,158,11,0.35)' }
                  : { label: 'UNSIGNED', color: '#991b1b', background: 'rgba(153,27,27,0.12)', border: 'rgba(239,68,68,0.35)' };

            return (
              <div
                key={artifact.id}
                style={{
                  border: '0.5px solid var(--sc-paper-whisper)',
                  borderRadius: 'var(--sc-radius-md)',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.5)',
                  display: 'grid',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', fontWeight: 500 }}>
                    {artifact.title ?? artifact.id}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--sc-font-mono)',
                      fontSize: '9px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: badge.color,
                      background: badge.background,
                      border: `1px solid ${badge.border}`,
                      borderRadius: '999px',
                      padding: '3px 8px',
                    }}
                  >
                    {trustScope === 'canonical' ? '🛡 ' : trustScope ? '🟠 ' : '⛔ '}
                    {badge.label}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--sc-ink-fog)' }}>
                  {[artifact.artifact_type, artifact.verified_at].filter(Boolean).join(' · ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function buildPowerLiftLayers(projection: WorkRunCanvasProjection | null) {
  const canonicalArtifacts = projection?.artifacts.filter((artifact) => artifact.trust_scope === 'canonical') ?? [];
  const inFlightItems = projection?.workitems.filter((item) => item.status !== 'completed') ?? [];
  const primaryArtifact = projection?.artifacts[0] ?? null;
  const primaryDiffTarget = projection?.artifacts[1] ?? primaryArtifact;

  return [
    {
      key: 'research',
      label: 'Research',
      tone: 'var(--sc-track-textual)',
      summary: primaryArtifact
        ? `Anchored on ${primaryArtifact.title ?? primaryArtifact.id}`
        : 'No evidence artifact projected yet',
      detail: `${projection?.artifacts.length ?? 0} artifacts in mission context`,
    },
    {
      key: 'telemetry',
      label: 'Telemetry',
      tone: 'var(--sc-track-graphical)',
      summary: projection?.all_moves_canonical ? 'Canonical runtime lane' : 'Mixed-trust runtime lane',
      detail: `${inFlightItems.length} active work items · ${canonicalArtifacts.length} canonical artifacts`,
    },
    {
      key: 'pattern',
      label: 'Pattern',
      tone: 'var(--sc-track-architecture)',
      summary: projection?.canonical_pattern ?? 'No canonical pattern linked yet',
      detail: projection?.workspec_name ?? projection?.profile_id ?? 'Awaiting pattern alignment',
    },
    {
      key: 'timeline',
      label: 'Timeline',
      tone: 'var(--sc-track-slide-flow)',
      summary: projection?.completed_at ? `Completed ${projection.completed_at}` : `Status · ${projection?.status ?? 'ready'}`,
      detail: projection?.source_phantom_run_id ?? 'No upstream phantom run',
    },
    {
      key: 'diff',
      label: 'Diff',
      tone: 'var(--sc-track-code)',
      summary: primaryDiffTarget ? `Compare against ${primaryDiffTarget.title ?? primaryDiffTarget.id}` : 'No artifact diff target yet',
      detail: `${projection?.workitems.length ?? 0} work items can still mutate this mission`,
    },
  ];
}

export function BlankCanvasUnfoldingCard({ projection }: { projection: WorkRunCanvasProjection | null }) {
  const track = useCanvasSession((s) => s.track);
  const productFrameId = useCanvasSession((s) => s.productFrameId);
  const domainProfileId = useCanvasSession((s) => s.domainProfileId);
  const starterTemplateIds = useCanvasSession((s) => s.starterTemplateIds);
  const rationale = useCanvasSession((s) => s.rationale);

  const resolvedFrame = resolveShellFrame(productFrameId, track);
  const frameLabel = resolvedFrame ? FRAME_REGISTRY[resolvedFrame].label : humanizeTrack(track);
  const firstArtifact = projection?.artifacts[0] ?? null;
  const firstTemplate = starterTemplateIds[0] ?? null;
  const recommendedNextAction =
    projection?.workitems.find((item) => item.status !== 'completed')?.title
    ?? (firstTemplate ? `Open starter template ${firstTemplate}` : null)
    ?? (resolvedFrame ? `Begin ${FRAME_REGISTRY[resolvedFrame].label.toLowerCase()} mission flow` : null)
    ?? 'Resolve the first mission move';

  return (
    <section
      style={{
        border: '0.5px solid var(--sc-paper-whisper)',
        borderRadius: 'var(--sc-radius-lg)',
        padding: '14px',
        background: 'rgba(255,255,255,0.66)',
        display: 'grid',
        gap: '10px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--sc-ink-fog)',
        }}
      >
        Blank Canvas Unfolding
      </div>
      <div style={{ display: 'grid', gap: '6px' }}>
        <span style={{ fontSize: '13px', color: 'var(--sc-ink-graphite)', fontWeight: 500 }}>
          {frameLabel}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)', lineHeight: 1.55 }}>
          {domainProfileId
            ? `Domain profile · ${domainProfileId}`
            : 'No explicit domain profile yet. Frame guidance is carrying the first paint.'}
        </span>
      </div>
      <div style={{ display: 'grid', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>Seeded artifact</span>
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', textAlign: 'right' }}>
            {firstArtifact?.title ?? firstTemplate ?? 'Awaiting first artifact'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>Recommended next action</span>
          <span style={{ fontSize: '12px', color: 'var(--sc-track-code)', textAlign: 'right' }}>
            {recommendedNextAction}
          </span>
        </div>
      </div>
      {rationale.length > 0 ? (
        <div
          style={{
            borderTop: '0.5px solid var(--sc-paper-whisper)',
            paddingTop: '8px',
            display: 'grid',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--sc-ink-fog)',
            }}
          >
            Why this mission unfolded
          </span>
          {rationale.slice(0, 2).map((line, index) => (
            <span key={`${line}-${index}`} style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', lineHeight: 1.5 }}>
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function isBlankCanvasEntryState(
  projection: WorkRunCanvasProjection | null,
  seededContent: {
    canvasSessionId: string | null;
    productFrameId: ProductFrameId | null;
    starterTemplateIds: string[];
    requiredCapabilityIds: string[];
    requiredEvaluationHookIds: string[];
  },
): boolean {
  if (!seededContent.canvasSessionId) {
    return false;
  }

  if (!seededContent.productFrameId) {
    return false;
  }

  if (!projection) {
    return true;
  }

  return projection.workitems.length === 0 && projection.artifacts.length === 0;
}

export function BlankCanvasEntrySurface({ projection }: { projection: WorkRunCanvasProjection | null }) {
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const productFrameId = useCanvasSession((s) => s.productFrameId);
  const domainProfileId = useCanvasSession((s) => s.domainProfileId);
  const starterTemplateIds = useCanvasSession((s) => s.starterTemplateIds);
  const activePane = useCanvasSession((s) => s.activePane);
  const allowedModes = useCanvasSession((s) => s.allowedModes);
  const requiredCapabilityIds = useCanvasSession((s) => s.requiredCapabilityIds);
  const requiredEvaluationHookIds = useCanvasSession((s) => s.requiredEvaluationHookIds);
  const resolvedFrame = resolveShellFrame(productFrameId, useCanvasSession((s) => s.track));
  const frameMeta = resolvedFrame ? FRAME_REGISTRY[resolvedFrame] : null;
  const track = useCanvasSession((s) => s.track);
  const frameLabel = frameMeta?.label ?? humanizeTrack(track);
  const resolvedModes = resolveShellModes(allowedModes, track);
  const entryStatus =
    projection ? (projection.workitems.length > 0 || projection.artifacts.length > 0 ? 'already in progress' : 'seeded') : 'new';
  const naturalPane = track ? naturalPaneForTrack(track) : activePane;

  const switchToEntryMode = (mode: CanvasModeId) => {
    useCanvasSession.getState().switchPane(modeToPane(mode));
  };

  const jumpToEvidence = () => {
    document.querySelector('[aria-label="Evidence spine"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section
      aria-label="Blank canvas entry surface"
      style={{
        display: 'grid',
        gap: '18px',
        padding: '18px',
        border: '0.5px solid var(--sc-paper-whisper)',
        borderRadius: 'var(--sc-radius-xl)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.82), rgba(255,255,255,0.94))',
      }}
    >
      <div style={{ display: 'grid', gap: '8px' }}>
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: frameMeta?.tint ?? 'var(--sc-ink-fog)',
          }}
        >
          Blank Canvas Entry
        </span>
        <span style={{ fontSize: '24px', fontWeight: 500, color: 'var(--sc-ink-graphite)' }}>
          {frameLabel}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--sc-ink-fog)', lineHeight: 1.6 }}>
          {frameMeta?.strapline ?? 'Mission-first entry before pane immersion.'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 320px)', gap: '18px' }}>
        <BlankCanvasUnfoldingCard projection={projection} />
        <div style={{ display: 'grid', gap: '14px' }}>
          <div
            style={{
              border: '0.5px solid var(--sc-paper-whisper)',
              borderRadius: 'var(--sc-radius-lg)',
              padding: '14px',
              background: 'rgba(255,255,255,0.66)',
              display: 'grid',
              gap: '10px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--sc-ink-fog)',
              }}
            >
              Entry constraints
            </span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>
              Mission status · {entryStatus}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>Templates · {starterTemplateIds.length}</span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>Capabilities · {requiredCapabilityIds.length}</span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>Eval hooks · {requiredEvaluationHookIds.length}</span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>Domain · {domainProfileId ?? 'none'}</span>
          </div>

          <div
            style={{
              border: '0.5px solid var(--sc-paper-whisper)',
              borderRadius: 'var(--sc-radius-lg)',
              padding: '14px',
              background: 'rgba(255,255,255,0.66)',
              display: 'grid',
              gap: '10px',
            }}
            >
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--sc-ink-fog)',
              }}
            >
              Mission Actions
            </span>
            <button
              type="button"
              onClick={() => useCanvasSession.getState().switchPane(naturalPane)}
              style={{
                justifyContent: 'space-between',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: '999px',
                padding: '8px 12px',
                background: 'rgba(20,33,61,0.06)',
                color: 'var(--sc-ink-graphite)',
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Enter cockpit
              <span aria-hidden="true">›</span>
            </button>
            <button
              type="button"
              onClick={jumpToEvidence}
              style={{
                justifyContent: 'space-between',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: '999px',
                padding: '8px 12px',
                background: 'transparent',
                color: 'var(--sc-ink-fog)',
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Inspect evidence
              <span aria-hidden="true">↗</span>
            </button>
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--sc-ink-fog)',
                marginTop: '2px',
              }}
            >
              Choose another mode
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {resolvedModes.length > 0 ? resolvedModes.map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => switchToEntryMode(mode)}
                  style={{
                    border: '0.5px solid var(--sc-paper-whisper)',
                    borderRadius: '999px',
                    padding: '6px 10px',
                    background: mode === paneToMode(activePane) ? 'rgba(20,33,61,0.08)' : 'transparent',
                    color: mode === paneToMode(activePane) ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-fog)',
                    fontFamily: 'var(--sc-font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {humanizeMode(mode)}
                </button>
              )) : (
                <span style={{ fontSize: '11px', color: 'var(--sc-ink-fog)' }}>Modes still resolving.</span>
              )}
            </div>
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.16em',
                color: 'var(--sc-ink-fog)',
                marginTop: '4px',
                textTransform: 'uppercase',
              }}
            >
              Session anchor · {canvasSessionId ?? 'not seeded'} · {frameLabel}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ActionRail({ projection }: { projection: WorkRunCanvasProjection | null }) {
  const track = useCanvasSession((s) => s.track);
  const activePane = useCanvasSession((s) => s.activePane);
  const allowedModes = useCanvasSession((s) => s.allowedModes);
  const starterTemplateIds = useCanvasSession((s) => s.starterTemplateIds);
  const switchPane = useCanvasSession((s) => s.switchPane);

  const naturalPane = track ? naturalPaneForTrack(track) : activePane;
  const resolvedModes = resolveShellModes(allowedModes, track);
  const activeMode = paneToMode(activePane);
  const nextAction =
    projection?.workitems.find((item) => item.status !== 'completed')?.title
    ?? starterTemplateIds[0]
    ?? 'Continue the resolved mission flow';

  const jumpToEvidence = () => {
    document.querySelector('[aria-label="Evidence spine"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const jumpToPowerLift = () => {
    document.querySelector('[aria-label="Power-Lift rail"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const jumpToRouter = () => {
    document.querySelector('[aria-label="Agent router contract"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside
      aria-label="Action rail"
      style={{
        display: 'grid',
        alignContent: 'start',
        gap: '14px',
        padding: '16px',
        borderRight: '0.5px solid var(--sc-paper-whisper)',
        background: 'linear-gradient(180deg, rgba(252,253,255,0.96), rgba(248,249,252,0.94))',
        overflowY: 'auto',
      }}
    >
      <section
        style={{
          border: '0.5px solid var(--sc-paper-whisper)',
          borderRadius: 'var(--sc-radius-lg)',
          padding: '14px',
          background: 'rgba(255,255,255,0.62)',
          display: 'grid',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
        >
          Action Rail
        </span>
        <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)', lineHeight: 1.55 }}>
          Compact, context-sensitive actions live here so the cockpit no longer scatters its primary moves across unrelated cards.
        </span>
        <div style={{ display: 'grid', gap: '6px', fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>
          <span>Current mode · {humanizeMode(activeMode)}</span>
          <span>Natural pane · {naturalPane}</span>
          <span>Next action · {nextAction}</span>
        </div>
      </section>

      <div style={{ display: 'grid', gap: '8px' }}>
        {[
          { label: 'Enter cockpit', onClick: () => switchPane(naturalPane), tone: 'var(--sc-ink-graphite)', bg: 'rgba(20,33,61,0.06)' },
          { label: 'Inspect evidence', onClick: jumpToEvidence, tone: 'var(--sc-ink-fog)', bg: 'transparent' },
          { label: 'Open Power-Lift', onClick: jumpToPowerLift, tone: 'var(--sc-ink-fog)', bg: 'transparent' },
          { label: 'Route via alias', onClick: jumpToRouter, tone: 'var(--sc-ink-fog)', bg: 'transparent' },
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            style={{
              justifyContent: 'space-between',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '0.5px solid var(--sc-paper-whisper)',
              borderRadius: '999px',
              padding: '9px 12px',
              background: action.bg,
              color: action.tone,
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <span>{action.label}</span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      <section
        style={{
          border: '0.5px solid var(--sc-paper-whisper)',
          borderRadius: 'var(--sc-radius-lg)',
          padding: '14px',
          background: 'rgba(255,255,255,0.62)',
          display: 'grid',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
        >
          Allowed Modes
        </span>
        {resolvedModes.length > 0 ? (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {resolvedModes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => switchPane(modeToPane(mode))}
                style={{
                  border: '0.5px solid var(--sc-paper-whisper)',
                  borderRadius: '999px',
                  padding: '6px 10px',
                  background: mode === activeMode ? 'rgba(20,33,61,0.08)' : 'transparent',
                  color: mode === activeMode ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-fog)',
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                {humanizeMode(mode)}
              </button>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
            No alternate modes resolved yet.
          </span>
        )}
      </section>
    </aside>
  );
}

export function YourPheromonesCard({ projection }: { projection: WorkRunCanvasProjection | null }) {
  const rationale = useCanvasSession((s) => s.rationale);
  const [consentState, setConsentState] = useState<'granted' | 'revoked'>('granted');

  const hardProofCount = projection?.artifacts.filter((artifact) => artifact.trust_scope === 'canonical').length ?? 0;
  const softPriorCount = rationale.length;
  const reinforcementCount = projection?.workitems.filter((item) => item.status !== 'completed').length ?? 0;

  return (
    <section
      style={{
        border: '0.5px solid var(--sc-paper-whisper)',
        borderRadius: 'var(--sc-radius-lg)',
        padding: '14px',
        background: 'rgba(255,255,255,0.62)',
        display: 'grid',
        gap: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-track-graphical)',
          }}
        >
          Your Pheromones
        </span>
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: consentState === 'granted' ? '#166534' : '#991b1b',
          }}
        >
          Consent · {consentState}
        </span>
      </div>
      <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)', lineHeight: 1.55 }}>
        Soft priors stay visible here. Hard proof remains separate in the Evidence Spine so learning pressure never impersonates signed evidence.
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
        {[
          { label: 'Soft priors', value: softPriorCount, tone: 'var(--sc-track-slide-flow)' },
          { label: 'Hard proof', value: hardProofCount, tone: '#166534' },
          { label: 'Signals live', value: reinforcementCount, tone: 'var(--sc-track-code)' },
        ].map((metric) => (
          <div
            key={metric.label}
            style={{
              border: '0.5px solid var(--sc-paper-whisper)',
              borderRadius: 'var(--sc-radius-md)',
              padding: '10px 12px',
              background: 'rgba(248,249,252,0.86)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--sc-ink-fog)',
              }}
            >
              {metric.label}
            </div>
            <div style={{ fontSize: '18px', color: metric.tone, marginTop: '6px' }}>{metric.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setConsentState('granted')}
          style={{
            border: '0.5px solid var(--sc-paper-whisper)',
            borderRadius: '999px',
            padding: '6px 10px',
            background: consentState === 'granted' ? 'rgba(22,101,52,0.12)' : 'transparent',
            color: consentState === 'granted' ? '#166534' : 'var(--sc-ink-fog)',
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Grant
        </button>
        <button
          type="button"
          onClick={() => setConsentState('revoked')}
          style={{
            border: '0.5px solid var(--sc-paper-whisper)',
            borderRadius: '999px',
            padding: '6px 10px',
            background: consentState === 'revoked' ? 'rgba(153,27,27,0.12)' : 'transparent',
            color: consentState === 'revoked' ? '#991b1b' : 'var(--sc-ink-fog)',
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Revoke
        </button>
      </div>
    </section>
  );
}

export function RouterContractPanel({
  phonebook,
  inbox,
}: {
  phonebook: AgentPhonebookEntry[];
  inbox: Record<string, AgentInboxMessage[]>;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAgentId) {
      return;
    }
    const codex = phonebook.find((entry) => entry.alias === '/codex') ?? phonebook[0];
    if (codex) {
      setSelectedAgentId(codex.id);
    }
  }, [phonebook, selectedAgentId]);

  const selectedAgent = phonebook.find((entry) => entry.id === selectedAgentId) ?? null;
  const messages = selectedAgent ? inbox[selectedAgent.id] ?? [] : [];
  const unreadCount = messages.filter((message) => !message.readAt).length;

  return (
    <section
      style={{
        border: '0.5px solid var(--sc-paper-whisper)',
        borderRadius: 'var(--sc-radius-lg)',
        padding: '14px',
        background: 'rgba(255,255,255,0.62)',
        display: 'grid',
        gap: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-track-architecture)',
          }}
        >
          Agent Router Contract
        </span>
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
        >
          slash dispatch from live alias graph
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {phonebook.map((entry) => {
          const isActive = entry.id === selectedAgentId;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedAgentId(entry.id)}
              style={{
                border: '0.5px solid var(--sc-paper-whisper)',
                borderRadius: '999px',
                padding: '6px 10px',
                background: isActive ? 'rgba(20,33,61,0.10)' : 'transparent',
                color: isActive ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-fog)',
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {entry.alias ?? entry.id}
            </button>
          );
        })}
      </div>

      {selectedAgent ? (
        <>
          <div style={{ display: 'grid', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', fontWeight: 500 }}>
              {selectedAgent.alias ?? selectedAgent.id}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
              Trust · {selectedAgent.trustLevel ?? 'unknown'}
              {selectedAgent.role ? ` · ${selectedAgent.role}` : ''}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
              DNA · {selectedAgent.processDna.join(' · ') || 'none published'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
              Adoption gate · {selectedAgent.adoptionProtocol ?? 'not required'}
            </span>
            <span style={{ fontSize: '12px', color: unreadCount > 0 ? '#991b1b' : 'var(--sc-ink-fog)' }}>
              Inbox · {messages.length} messages · {unreadCount} unread
            </span>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {messages.length > 0 ? messages.slice(0, 3).map((message) => (
              <div
                key={message.id}
                style={{
                  border: '0.5px solid var(--sc-paper-whisper)',
                  borderRadius: 'var(--sc-radius-md)',
                  padding: '10px 12px',
                  background: 'rgba(248,249,252,0.86)',
                  display: 'grid',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', fontWeight: 500 }}>
                    {message.kind ?? 'AgentMessage'}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--sc-font-mono)',
                      fontSize: '9px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: message.readAt ? 'var(--sc-ink-fog)' : '#991b1b',
                    }}
                  >
                    {message.readAt ? 'read' : 'unread'}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--sc-ink-fog)' }}>
                  From {message.fromAlias ?? message.fromId}
                  {message.priority ? ` · ${message.priority}` : ''}
                  {message.sentAt ? ` · ${message.sentAt}` : ''}
                </span>
                {message.body ? (
                  <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', lineHeight: 1.5 }}>
                    {message.body}
                  </span>
                ) : null}
              </div>
            )) : (
              <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
                No inbox messages loaded for this alias yet.
              </span>
            )}
          </div>
        </>
      ) : (
        <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
          Loading live alias phonebook…
        </span>
      )}
    </section>
  );
}

export function PowerLiftRail({ projection }: { projection: WorkRunCanvasProjection | null }) {
  const [phonebook, setPhonebook] = useState<AgentPhonebookEntry[]>([]);
  const [inbox, setInbox] = useState<Record<string, AgentInboxMessage[]>>({});
  const layers = buildPowerLiftLayers(projection);

  useEffect(() => {
    let cancelled = false;

    fetchAgentRouterPhonebook()
      .then(async (entries) => {
        if (cancelled) return;
        setPhonebook(entries);
        const inboxEntries = await Promise.all(
          entries.slice(0, 3).map(async (entry) => [entry.id, await fetchAgentInbox(entry.id, 5)] as const),
        );
        if (!cancelled) {
          setInbox(Object.fromEntries(inboxEntries));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhonebook([]);
          setInbox({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside
      aria-label="Power-Lift rail"
      style={{
        display: 'grid',
        alignContent: 'start',
        gap: '14px',
        padding: '16px',
        borderLeft: '0.5px solid var(--sc-paper-whisper)',
        background: 'linear-gradient(180deg, rgba(250,251,255,0.94), rgba(244,246,250,0.92))',
        overflowY: 'auto',
      }}
    >
      <section
        style={{
          border: '0.5px solid var(--sc-paper-whisper)',
          borderRadius: 'var(--sc-radius-lg)',
          padding: '14px',
          background: 'rgba(255,255,255,0.62)',
          display: 'grid',
          gap: '10px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
        >
          Power-Lift
        </div>
        <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)', lineHeight: 1.55 }}>
          Research, telemetry, pattern, timeline, and diff now stay inside the same mission rail instead of feeling like product switches.
        </span>
      </section>

      <BlankCanvasUnfoldingCard projection={projection} />
      <YourPheromonesCard projection={projection} />
      <RouterContractPanel phonebook={phonebook} inbox={inbox} />

      {layers.map((layer) => (
        <section
          key={layer.key}
          style={{
            border: '0.5px solid var(--sc-paper-whisper)',
            borderRadius: 'var(--sc-radius-lg)',
            padding: '14px',
            background: 'rgba(255,255,255,0.62)',
            display: 'grid',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: layer.tone,
              }}
            >
              {layer.label}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', lineHeight: 1.5 }}>
            {layer.summary}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--sc-ink-fog)', lineHeight: 1.5 }}>
            {layer.detail}
          </span>
        </section>
      ))}
    </aside>
  );
}

export function EvidenceSpine({ projection }: { projection: WorkRunCanvasProjection | null }) {
  const rationale = useCanvasSession((s) => s.rationale);
  const requiredCapabilityIds = useCanvasSession((s) => s.requiredCapabilityIds);
  const requiredEvaluationHookIds = useCanvasSession((s) => s.requiredEvaluationHookIds);
  const starterTemplateIds = useCanvasSession((s) => s.starterTemplateIds);
  const domainProfileId = useCanvasSession((s) => s.domainProfileId);
  const productFrameId = useCanvasSession((s) => s.productFrameId);

  const trustCounts = useMemo(() => {
    const artifacts = projection?.artifacts ?? [];
    return artifacts.reduce(
      (acc, artifact) => {
        if (artifact.trust_scope === 'canonical') acc.canonical += 1;
        else if (artifact.trust_scope) acc.ephemeral += 1;
        else acc.unsigned += 1;
        return acc;
      },
      { canonical: 0, ephemeral: 0, unsigned: 0 },
    );
  }, [projection]);

  return (
    <aside
      aria-label="Evidence spine"
      style={{
        display: 'grid',
        alignContent: 'start',
        gap: '14px',
        padding: '16px',
        borderLeft: '0.5px solid var(--sc-paper-whisper)',
        background: 'linear-gradient(180deg, rgba(252,253,255,0.96), rgba(247,248,250,0.94))',
        overflowY: 'auto',
      }}
    >
      <section
        style={{
          border: '0.5px solid var(--sc-paper-whisper)',
          borderRadius: 'var(--sc-radius-lg)',
          padding: '14px',
          background: 'rgba(255,255,255,0.62)',
          display: 'grid',
          gap: '10px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
        >
          Evidence Spine
        </div>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>Frame</span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', textAlign: 'right' }}>
              {productFrameId ?? 'track-governed'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>Domain</span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', textAlign: 'right' }}>
              {domainProfileId ?? 'unscoped'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>Templates</span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', textAlign: 'right' }}>
              {starterTemplateIds.length}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>Capabilities</span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', textAlign: 'right' }}>
              {requiredCapabilityIds.length}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>Eval Hooks</span>
            <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', textAlign: 'right' }}>
              {requiredEvaluationHookIds.length}
            </span>
          </div>
        </div>
      </section>

      <section
        style={{
          border: '0.5px solid var(--sc-paper-whisper)',
          borderRadius: 'var(--sc-radius-lg)',
          padding: '14px',
          background: 'rgba(255,255,255,0.62)',
          display: 'grid',
          gap: '10px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
        >
          Trust Overview
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Canonical', value: trustCounts.canonical, color: '#166534', bg: 'rgba(22,101,52,0.10)' },
            { label: 'Ephemeral', value: trustCounts.ephemeral, color: '#92400e', bg: 'rgba(146,64,14,0.10)' },
            { label: 'Unsigned', value: trustCounts.unsigned, color: '#991b1b', bg: 'rgba(153,27,27,0.10)' },
          ].map((chip) => (
            <span
              key={chip.label}
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: chip.color,
                background: chip.bg,
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '999px',
                padding: '4px 8px',
              }}
            >
              {chip.label} · {chip.value}
            </span>
          ))}
        </div>
        {projection?.artifacts?.length ? (
          <div style={{ display: 'grid', gap: '8px' }}>
            {projection.artifacts.slice(0, 4).map((artifact) => (
              <div
                key={artifact.id}
                style={{
                  border: '0.5px solid var(--sc-paper-whisper)',
                  borderRadius: 'var(--sc-radius-md)',
                  padding: '10px 12px',
                  background: 'rgba(248,249,252,0.86)',
                  display: 'grid',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', fontWeight: 500 }}>
                    {artifact.title ?? artifact.id}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--sc-font-mono)',
                      fontSize: '9px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: artifact.trust_scope === 'canonical' ? '#166534' : artifact.trust_scope ? '#92400e' : '#991b1b',
                    }}
                  >
                    {artifact.trust_scope ?? 'unsigned'}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--sc-ink-fog)' }}>
                  {[artifact.artifact_type, artifact.verified_at].filter(Boolean).join(' · ') || 'No verification timestamp'}
                </span>
                {artifact.signing_pubkey ? (
                  <span style={{ fontFamily: 'var(--sc-font-mono)', fontSize: '10px', color: 'var(--sc-ink-fog)' }}>
                    Signer · {artifact.signing_pubkey.slice(0, 8)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
            No projected artifacts yet. Trust will materialize here as runtime artifacts arrive.
          </span>
        )}
      </section>

      <section
        style={{
          border: '0.5px solid var(--sc-paper-whisper)',
          borderRadius: 'var(--sc-radius-lg)',
          padding: '14px',
          background: 'rgba(255,255,255,0.62)',
          display: 'grid',
          gap: '10px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
        >
          Rationale
        </div>
        {rationale.length > 0 ? (
          <div style={{ display: 'grid', gap: '8px' }}>
            {rationale.map((line, index) => (
              <div
                key={`${line}-${index}`}
                style={{
                  borderLeft: '2px solid var(--sc-paper-whisper)',
                  paddingLeft: '10px',
                  fontSize: '12px',
                  lineHeight: 1.55,
                  color: 'var(--sc-ink-graphite)',
                }}
              >
                {line}
              </div>
            ))}
          </div>
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--sc-ink-fog)' }}>
            No rationale recorded yet.
          </span>
        )}
      </section>

      <section
        style={{
          border: '0.5px solid var(--sc-paper-whisper)',
          borderRadius: 'var(--sc-radius-lg)',
          padding: '14px',
          background: 'rgba(255,255,255,0.62)',
          display: 'grid',
          gap: '8px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
        >
          Runtime Lineage
        </div>
        <div style={{ fontSize: '12px', color: 'var(--sc-ink-graphite)', display: 'grid', gap: '5px' }}>
          <span>Run · {projection?.id ?? 'no live workrun'}</span>
          {projection?.workspec_id ? <span>Spec · {projection.workspec_id}</span> : null}
          {projection?.source_phantom_run_id ? <span>Source · {projection.source_phantom_run_id}</span> : null}
          {projection?.all_moves_canonical !== null && projection?.all_moves_canonical !== undefined ? (
            <span>Moves · {projection.all_moves_canonical ? 'all canonical' : 'mixed trust'}</span>
          ) : null}
        </div>
      </section>
    </aside>
  );
}

export function OperatorActionProofCard({
  proof,
}: {
  proof: InnovationApprovalProofResponse;
}) {
  return (
    <section
      style={{
        border: '0.5px solid var(--sc-paper-whisper)',
        borderRadius: 'var(--sc-radius-lg)',
        padding: '14px',
        background: 'rgba(255,255,255,0.62)',
        display: 'grid',
        gap: '10px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--sc-ink-fog)',
        }}
      >
        Operator Action Proof
      </div>
      <div style={{ display: 'grid', gap: '6px', fontSize: '12px', color: 'var(--sc-ink-graphite)' }}>
        <span>Action · approve innovation ticket</span>
        <span>Ticket · {proof.ticket_id}</span>
        <span>Proof · {proof.proof_id}</span>
        <span>Applied · {proof.applied_at}</span>
        <span>Result · {proof.adopted_pattern_id ?? 'no adopted pattern linked'}</span>
        <span>Rationale · {proof.arbitration_decision_id ?? 'no arbitration decision linked'}</span>
        <span>Ack · {proof.sse_ack_topic}</span>
      </div>
    </section>
  );
}

// ── UC5 status bar (bottom) ───────────────────────────────────────────────────

function UC5StatusBar() {
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const hostOrigin = useCanvasSession((s) => s.hostOrigin);
  const isHydrating = useCanvasSession((s) => s.isHydrating);
  const productFrameId = useCanvasSession((s) => s.productFrameId);
  const track = useCanvasSession((s) => s.track);
  const resolvedFrame = resolveShellFrame(productFrameId, track);
  const frameLabel = resolvedFrame ? FRAME_REGISTRY[resolvedFrame].label : humanizeTrack(track);

  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '10px var(--sc-pane-pad)',
        borderTop: '0.5px solid var(--sc-paper-whisper)',
        background: 'var(--sc-surface-bg)',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '9px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--sc-ink-fog)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span className="sc-bridge-dot" aria-hidden="true" />
        Bridge · postMessage
        {hostOrigin ? ` · ${new URL(hostOrigin).hostname}` : ' · unattached'}
      </span>
      <span
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '9px',
          letterSpacing: '0.15em',
          color: 'var(--sc-ink-fog)',
          marginLeft: 'auto',
        }}
      >
        {isHydrating ? 'hydrating…' : canvasSessionId ? `session ${canvasSessionId.slice(0, 8)}` : 'no session'}
        {` · ${frameLabel} · cockpit over shell`}
      </span>
    </footer>
  );
}

// ── UC5 Shell ─────────────────────────────────────────────────────────────────

function UC5Shell() {
  const hydrate = useCanvasSession((s) => s.hydrate);
  const [workRunProjection, setWorkRunProjection] = useState<WorkRunCanvasProjection | null>(null);
  const workrunSeededRef = useRef<string | null>(null);
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const productFrameId = useCanvasSession((s) => s.productFrameId);
  const starterTemplateIds = useCanvasSession((s) => s.starterTemplateIds);
  const requiredCapabilityIds = useCanvasSession((s) => s.requiredCapabilityIds);
  const requiredEvaluationHookIds = useCanvasSession((s) => s.requiredEvaluationHookIds);

  // On mount: read URL params, attach bridge, call hydrate
  useEffect(() => {
    const detach = attachBridge();
    const { sessionId, track, pane, workrunId } = readUC5Params();

    if (sessionId) {
      hydrate({
        sessionId,
        track: track ?? 'textual',
        initialPane: pane ?? naturalPaneForTrack(track ?? 'textual'),
      })
        .then(() => { emitSessionReady(); })
        .catch((err: unknown) => { console.error('[UC5Shell] hydrate failed:', err); });
    } else {
      emitSessionReady();
    }

    if (workrunId) {
      fetchWorkRunCockpit(workrunId)
        .then((projection) => {
          setWorkRunProjection(projection);
          if (workrunSeededRef.current !== projection.id) {
            seedWorkRunProjection(projection);
            workrunSeededRef.current = projection.id;
          }
        })
        .catch((err: unknown) => {
          console.error('[UC5Shell] workrun cockpit load failed:', err);
        });
    }

    return detach;
  }, [hydrate]);

  const showBlankCanvasEntry = isBlankCanvasEntryState(workRunProjection, {
    canvasSessionId,
    productFrameId,
    starterTemplateIds,
    requiredCapabilityIds,
    requiredEvaluationHookIds,
  });

  return (
    <div
      className="sc-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px var(--sc-pane-pad)',
          borderBottom: '1px solid var(--sc-divider)',
          background: 'var(--sc-surface-bg)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: 'var(--sc-size-xs)',
            letterSpacing: 'var(--sc-tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--sc-text-primary)',
            fontWeight: 600,
          }}
        >
          WidgeTDC Canvas
        </span>
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: 'var(--sc-size-xs)',
            letterSpacing: '0.04em',
            color: 'var(--sc-text-tertiary)',
          }}
        >
          {workRunProjection ? `run · ${workRunProjection.id.slice(0, 24)}` : 'no active run'}
        </span>
      </header>

      <MissionHeader projection={workRunProjection} />

      {/* Track legend + pane switcher */}
      <TrackLegend />

      {/* Pane content */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px 360px',
        }}
      >
        <div style={{ minWidth: 0, minHeight: 0, display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
          <WorkRunCockpitStrip projection={workRunProjection} />
          <div
            style={{
              minHeight: 0,
              minWidth: 0,
              display: 'grid',
              gridTemplateColumns: '220px minmax(0, 1fr)',
            }}
          >
            <ActionRail projection={workRunProjection} />
            <div style={{ minHeight: 0, minWidth: 0 }}>
              <ReactFlowProvider>
                {showBlankCanvasEntry ? (
                  <div style={{ padding: '18px', minHeight: '100%', background: 'rgba(255,255,255,0.35)' }}>
                    <BlankCanvasEntrySurface projection={workRunProjection} />
                  </div>
                ) : (
                  <UC5PaneRouter />
                )}
              </ReactFlowProvider>
            </div>
          </div>
        </div>
        <PowerLiftRail projection={workRunProjection} />
        <EvidenceSpine projection={workRunProjection} />
      </main>

      {/* Status bar */}
      <UC5StatusBar />
    </div>
  );
}

// ── Legacy shell helpers ──────────────────────────────────────────────────────

function hasPersistedCanvasState(): boolean {
  const { nodes, edges } = useCanvasStore.getState();
  return nodes.length > 0 || edges.length > 0;
}

function readSurfaceFromUrl(): CanvasSurface {
  const url = new URL(window.location.href);
  const view = url.searchParams.get('view');
  if (view === 'knowledge' || view === 'journal') {
    return view;
  }
  return 'canvas';
}

function syncSurfaceToUrl(surface: CanvasSurface) {
  const url = new URL(window.location.href);
  if (surface === 'canvas') {
    url.searchParams.delete('view');
  } else {
    url.searchParams.set('view', surface);
  }
  window.history.replaceState({}, '', url);
}

function AutoLoader() {
  const activeSurface = useCanvasStore((state) => state.activeSurface);

  useEffect(() => {
    let cancelled = false;
    if (activeSurface !== 'canvas') return () => { cancelled = true; };

    (async () => {
      try {
        if (hasPersistedCanvasState()) return;
        // Default substrate: real WidgeTDC governance state from AuraDB
        // (claims, gates, packs, patterns, artifacts, services, affordances).
        // Operators can switch templates via the canvas surface; this is the
        // entry-time default per CANVAS_C8 spec ("structured workbench, not a
        // dead empty field").
        await useCanvasStore.getState().loadTemplate('governance-spine');
      } catch {
        if (!cancelled) {
          // Keep the shell alive; template bootstrap is not allowed to kill the surface.
        }
      }
    })();

    return () => { cancelled = true; };
  }, [activeSurface]);

  return null;
}

function ToastBridge() {
  const { toast } = useToast();
  useEffect(() => { useCanvasStore.getState().setToast(toast); }, [toast]);
  return null;
}

// ── Legacy shell (non-UC5 mode) ───────────────────────────────────────────────

function LegacyShell() {
  const activeSurface = useCanvasStore((state) => state.activeSurface);
  const setActiveSurface = useCanvasStore((state) => state.setActiveSurface);
  const [surfaceHydrated, setSurfaceHydrated] = useState(false);

  useEffect(() => {
    setActiveSurface(readSurfaceFromUrl());
    setSurfaceHydrated(true);
  }, [setActiveSurface]);

  useEffect(() => {
    const handlePopState = () => { setActiveSurface(readSurfaceFromUrl()); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveSurface]);

  useEffect(() => {
    if (!surfaceHydrated) return;
    syncSurfaceToUrl(activeSurface);
  }, [activeSurface, surfaceHydrated]);

  return (
    <ToastProvider>
      <ReactFlowProvider>
        <ToastBridge />
        <CommandPalette />

        <div className="flex flex-col h-screen w-screen bg-[#050b14] overflow-hidden">
          <motion.div className="flex-1 w-full h-full relative">
            <motion.div className="absolute inset-0 flex flex-col bg-neural-bg">
              <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none z-50 flex items-center justify-between">
                <div className="flex items-center gap-3 bg-neural-surface/80 backdrop-blur-md px-4 py-2 rounded-full border border-neural-border shadow-lg pointer-events-auto">
                  <h1 className="text-sm font-bold text-gray-100 tracking-wide">WidgeTDC Canvas</h1>
                  <span className="text-[10px] font-black text-lime-300 border-l border-lime-500/30 pl-3 tracking-widest">
                    Component Library
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {activeSurface === 'knowledge' && (
                    <span className="text-[10px] text-purple-300 font-medium uppercase tracking-widest bg-purple-500/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/20">
                      Knowledge Surface
                    </span>
                  )}
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest bg-neural-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-neural-border">
                    Ctrl+K Commands
                  </span>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden relative mt-0">
                <ToolPalette />
                <Canvas />
                <NodeInspector />
                {surfaceHydrated && activeSurface === 'canvas' && <AutoLoader />}
                <CanvasCollaboration />
                <SnoutObserver />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </ReactFlowProvider>
    </ToastProvider>
  );
}

// ── AppShell — top-level router ───────────────────────────────────────────────

export function AppShell() {
  // Legacy ReactFlow component-library canvas is now opt-in via ?legacy=1.
  // Bookmarked legacy demos still resolve when explicitly requested.
  if (isLegacyMode()) {
    return <LegacyShell />;
  }

  // Default operator entry surface: UC5 cockpit with C8 BlankCanvasEntrySurface
  // (mission card + frame label + entry constraints + mission actions) and
  // C9 ActionRail. UC5Shell handles its own state — when no ?session= is
  // provided, it renders the cockpit chrome with empty workrun projection,
  // which is the correct pre-flight surface per CANVAS_C8 spec.
  return (
    <ToastProvider>
      <UC5Shell />
    </ToastProvider>
  );
}
