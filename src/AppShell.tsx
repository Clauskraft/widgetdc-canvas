import { useEffect, useRef, useState } from 'react';
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
import { fetchWorkRunCockpit, type WorkRunCanvasProjection } from './lib/api';

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
          <span className="sc-pane-meta">isolines · 7 tracks · 18 ticks/ring</span>
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

function FrameMetadataStrip() {
  const track = useCanvasSession((s) => s.track);
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

  return (
    <section
      aria-label="Frame metadata"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: '18px',
        padding: '16px var(--sc-pane-pad) 18px',
        borderBottom: '0.5px solid var(--sc-paper-whisper)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.36))',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
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

        <span
          style={{
            fontSize: '12px',
            lineHeight: 1.5,
            color: 'var(--sc-ink-fog)',
            maxWidth: '78ch',
          }}
        >
          {frameMeta?.strapline ?? `Current shell remains governed by ${trackLabel.toLowerCase()}.`}
        </span>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
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
            Track · {trackLabel}
          </span>
          {domainProfileId ? (
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--sc-ink-fog)',
              }}
            >
              Domain · {domainProfileId}
            </span>
          ) : null}
          {rationale.length > 0 ? (
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--sc-ink-fog)',
              }}
            >
              Rationale · {rationale.length} checks
            </span>
          ) : null}
        </div>
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
            Contracts
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
        {` · ${frameLabel} · one surface · many windows`}
      </span>
    </footer>
  );
}

// ── UC5 Shell ─────────────────────────────────────────────────────────────────

function UC5Shell() {
  const hydrate = useCanvasSession((s) => s.hydrate);
  const [workRunProjection, setWorkRunProjection] = useState<WorkRunCanvasProjection | null>(null);
  const workrunSeededRef = useRef<string | null>(null);

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

  return (
    <div
      className="sc-root sc-paper-grain"
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
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '24px var(--sc-pane-pad) 20px',
          borderBottom: '0.5px solid var(--sc-paper-whisper)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '11px',
            letterSpacing: 'var(--sc-tracking-label)',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-graphite)',
          }}
        >
          WidgeTDC · Unified Canvas · Substrate Cartography
        </span>
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            color: 'var(--sc-ink-fog)',
          }}
        >
          55°40&prime;N · 12°34&prime;E · Plate I
        </span>
      </header>

      <FrameMetadataStrip />
      <WorkRunCockpitStrip projection={workRunProjection} />

      {/* Track legend + pane switcher */}
      <TrackLegend />

      {/* Pane content */}
      <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <ReactFlowProvider>
          <UC5PaneRouter />
        </ReactFlowProvider>
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
        await useCanvasStore.getState().loadTemplate('h10-strategic-north-star');
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
  // UC5 mode: activated when ?session=... is in the URL
  if (isUC5Mode()) {
    return (
      <ToastProvider>
        <UC5Shell />
      </ToastProvider>
    );
  }

  // Legacy mode: original dark-theme ReactFlow canvas
  return <LegacyShell />;
}
