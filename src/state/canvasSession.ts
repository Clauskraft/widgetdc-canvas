/**
 * UC5 — Canvas Session store
 * Multi-pane Zustand store with per-pane Y.Doc CRDT and session hydration.
 */
import { resolveToolOutput } from '../lib/toolOutputFold';

import { create } from 'zustand';
import * as Y from 'yjs';
import {
  composeEventSourceUrl,
  composeRequest,
  fetchComposeLineage,
  fetchPatternPalette,
  type ComposeLineageEdge,
  type ComposeTopic,
  type PatternPaletteEntry,
} from '../lib/api';
import type {
  BuilderTrack,
  PaneId,
  CanvasResolutionWire,
  PreSeededNode,
  MultiModalOrder,
  ModalityArtifact,
} from '../types/session';

const SESSION_HYDRATE_BASE =
  'https://canvas-production-4bd4.up.railway.app/api/session';

// UC5 intelligence layer — orchestrator canvas_builder + backend reward endpoint.
// URLs resolve from env with a production-safe fallback so the canvas works
// out-of-the-box when embedded in a host that hasn't configured VITE_* vars.
function resolveOrchestratorBase(): string {
  const env = (import.meta.env.VITE_ORCHESTRATOR_URL ?? '').trim().replace(/\/$/, '');
  return env || 'https://orchestrator-production-c27e.up.railway.app';
}
function resolveBackendBase(): string {
  const env = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  return env || 'https://backend-production-d3da.up.railway.app';
}
function resolveOrchestratorApiKey(): string {
  return String(
    import.meta.env.VITE_ORCHESTRATOR_API_KEY ?? import.meta.env.VITE_API_KEY ?? '',
  ).trim();
}
function resolveBackendApiKey(): string {
  return String(import.meta.env.VITE_API_KEY ?? '').trim();
}

/** Brief submission history entry — used by BriefBar for recall + context accretion. */
export interface BriefHistoryEntry {
  brief: string;
  resolvedAt: string;
  track: BuilderTrack;
  ruleId: string | null;
}

/** Incoming host message — displayed as transient toast by HostMessageToast. */
export interface HostMessageEntry {
  origin: string;
  payload: unknown;
  receivedAt: string;
}

export type RewardStatus = 'idle' | 'submitting' | 'sent' | 'failed';
export type OperatorStatus = 'idle' | 'running' | 'done' | 'failed';
export type ComposeOperator = 'CT' | 'tensorAB' | 'projectConstraint' | 'assemble' | 'materialize';

interface ComposeTelemetryEvent {
  topic: ComposeTopic;
  payload: Record<string, unknown>;
  receivedAt: string;
}

const OPERATOR_ORDER: ComposeOperator[] = ['CT', 'tensorAB', 'projectConstraint', 'assemble', 'materialize'];

function idleOperators(): Record<ComposeOperator, OperatorStatus> {
  return {
    CT: 'idle',
    tensorAB: 'idle',
    projectConstraint: 'idle',
    assemble: 'idle',
    materialize: 'idle',
  };
}

/**
 * Extract a rule_id_fired heuristic from a rationale string list.
 * Orchestrator stub emits strings like `heuristic_track:textual` or
 * `rule:doc-intent`. We prefer explicit rule: prefixes, fall back to
 * heuristic_track prefix, then the first rationale entry verbatim.
 */
function extractRuleIdFromRationale(rationale: string[]): string | null {
  if (!Array.isArray(rationale) || rationale.length === 0) return null;
  for (const line of rationale) {
    if (typeof line !== 'string') continue;
    const ruleMatch = line.match(/^rule:([\w.-]+)/i);
    if (ruleMatch) return ruleMatch[1];
  }
  for (const line of rationale) {
    if (typeof line !== 'string') continue;
    const heurMatch = line.match(/^heuristic_track:([\w-]+)/i);
    if (heurMatch) return `heuristic:${heurMatch[1]}`;
  }
  const first = rationale.find((r) => typeof r === 'string');
  return typeof first === 'string' ? first : null;
}

// ── Per-pane state ──────────────────────────────────────────────────────────

export interface PaneState {
  content: unknown;
  crdtDoc: Y.Doc;
  lastMutatedAt?: string;
}

function createPaneState(): PaneState {
  return {
    content: null,
    crdtDoc: new Y.Doc(),
    lastMutatedAt: undefined,
  };
}

const PANE_IDS: PaneId[] = ['canvas', 'markdown', 'slides', 'drawio', 'split', 'phantom_bom', 'architecture_spec'];

function createInitialPanes(): Record<PaneId, PaneState> {
  return Object.fromEntries(
    PANE_IDS.map((id) => [id, createPaneState()]),
  ) as Record<PaneId, PaneState>;
}

// ── Store interface ─────────────────────────────────────────────────────────

export interface CanvasSessionState {
  canvasSessionId: string | null;
  track: BuilderTrack | null;
  activePane: PaneId;
  panes: Record<PaneId, PaneState>;
  hostOrigin: string | null;
  embedUrl: string | null;
  rationale: string[];
  preSeededNodes: PreSeededNode[];
  isHydrating: boolean;
  hydrateError: string | null;

  // UC5 intelligence layer state
  lastResolution: CanvasResolutionWire | null;
  ruleIdFired: string | null;
  briefHistory: BriefHistoryEntry[];
  hostMessages: HostMessageEntry[];
  rewardStatus: RewardStatus;
  isSubmittingBrief: boolean;
  composeBomrunId: string | null;
  composeSseConnected: boolean;
  composeAcceptedAt: string | null;
  composeOperatorStatus: Record<ComposeOperator, OperatorStatus>;
  composeEvents: ComposeTelemetryEvent[];
  patternPalette: PatternPaletteEntry[];
  selectedPatternIds: string[];
  lineageEdges: ComposeLineageEdge[];
  lineageLoading: boolean;

  // M5: multi-modal order state (T4.5)
  materializingOrder: MultiModalOrder | null;

  // Actions
  hydrate(args: {
    sessionId: string;
    track: BuilderTrack;
    initialPane: PaneId;
  }): Promise<void>;

  switchPane(pane: PaneId): void;

  mutatePane(pane: PaneId, mutation: (doc: Y.Doc) => void): void;

  setHostOrigin(origin: string): void;

  setContent(pane: PaneId, content: unknown): void;

  /** FIX (P1): Destroy all Y.Doc instances — call on component unmount to prevent memory leaks. */
  destroyDocs(): void;

  // UC5 intelligence layer actions
  submitBrief(brief: string): Promise<void>;
  recordReward(reward: 0 | 1): Promise<void>;
  appendHostMessage(origin: string, payload: unknown): void;

  // M5: multi-modal actions (T4.5)
  startMultiModal(brief: string, canvasResolution: CanvasResolutionWire): Promise<void>;
  updateArtifactFromSSE(modality: string, update: Partial<ModalityArtifact>): void;
  closeSSE(): void;
  fetchPatternPalette(): Promise<void>;
  togglePatternSelection(patternId: string): void;
  startComposeTelemetry(brief: string): Promise<void>;
  fetchProvenanceForCurrentRun(): Promise<void>;
}

// ── Selectors (memoisation helpers) ─────────────────────────────────────────

export function selectActivePane(state: CanvasSessionState): PaneState {
  return state.panes[state.activePane];
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useCanvasSession = create<CanvasSessionState>()((set, get) => ({
  canvasSessionId: null,
  track: null,
  activePane: 'canvas',
  panes: createInitialPanes(),
  hostOrigin: null,
  embedUrl: null,
  rationale: [],
  preSeededNodes: [],
  isHydrating: false,
  hydrateError: null,
  lastResolution: null,
  ruleIdFired: null,
  briefHistory: [],
  hostMessages: [],
  materializingOrder: null,
  rewardStatus: 'idle',
  isSubmittingBrief: false,
  composeBomrunId: null,
  composeSseConnected: false,
  composeAcceptedAt: null,
  composeOperatorStatus: idleOperators(),
  composeEvents: [],
  patternPalette: [],
  selectedPatternIds: [],
  lineageEdges: [],
  lineageLoading: false,

  async hydrate({ sessionId, track, initialPane }) {
    // Collapse optimistic sets into a single update — two back-to-back set()
    // calls triggered double re-render and, combined with object-ref selectors
    // in pane components, contributed to infinite update loops.
    set({
      canvasSessionId: sessionId,
      track,
      activePane: initialPane,
      isHydrating: false,
      hydrateError: null,
    });

    // FIX: client-bootstrapped sessions (prefix `local-`) have no backend
    // counterpart. Attempting to hydrate them triggers CORS errors from
    // canvas-production-4bd4.up.railway.app AND pollutes the console. Skip
    // the HTTP roundtrip entirely for local-* sessions.
    if (sessionId.startsWith('local-')) {
      return;
    }

    set({ isHydrating: true });

    try {
      const res = await fetch(`${SESSION_HYDRATE_BASE}/${sessionId}/hydrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        // 404 is expected while backend endpoint is pending — degrade gracefully
        if (res.status !== 404) {
          console.warn(
            `[canvasSession] hydrate responded ${res.status} for session ${sessionId}`,
          );
        }
        set({ isHydrating: false });
        return;
      }

      const wire = (await res.json()) as CanvasResolutionWire;

      // Seed the markdown pane's Y.Doc with pre_seeded_nodes if present
      const nodes = wire.pre_seeded_nodes ?? [];
      if (nodes.length > 0) {
        const { panes } = get();
        const markdownDoc = panes.markdown.crdtDoc;
        markdownDoc.transact(() => {
          const arr = markdownDoc.getArray<PreSeededNode>('nodes');
          arr.delete(0, arr.length);
          arr.insert(0, nodes);
        }, 'hydrate');
      }

      set({
        canvasSessionId: wire.canvas_session_id,
        track: wire.track,
        activePane: wire.initial_pane ?? initialPane,
        embedUrl: wire.embed_url ?? null,
        rationale: wire.rationale ?? [],
        preSeededNodes: nodes,
        isHydrating: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[canvasSession] hydrate failed:', message);
      set({ hydrateError: message, isHydrating: false });
    }
  },

  switchPane(pane) {
    set({ activePane: pane });
  },

  mutatePane(pane, mutation) {
    const { panes } = get();
    const target = panes[pane];
    mutation(target.crdtDoc);
    // Trigger a state update so subscribers re-render
    set({
      panes: {
        ...panes,
        [pane]: {
          ...target,
          lastMutatedAt: new Date().toISOString(),
        },
      },
    });
  },

  setHostOrigin(origin) {
    set({ hostOrigin: origin });
  },

  setContent(pane, content) {
    const { panes } = get();
    set({
      panes: {
        ...panes,
        [pane]: {
          ...panes[pane],
          content,
          lastMutatedAt: new Date().toISOString(),
        },
      },
    });
  },

  destroyDocs() {
    // FIX (P1): Y.Doc instances accumulate GC observers and Awareness objects.
    // Without explicit destroy() they are never garbage-collected because yjs
    // holds internal references. Call this in the UC5Shell unmount cleanup.
    const { panes } = get();
    for (const id of PANE_IDS) {
      try {
        panes[id].crdtDoc.destroy();
      } catch {
        // Already destroyed — safe to ignore
      }
    }
  },

  // ── UC5 intelligence layer ─────────────────────────────────────────────────

  async submitBrief(brief) {
    const trimmed = brief.trim();
    if (!trimmed) return;

    const prevTrack = get().track;
    const sequenceStep = get().briefHistory.length;
    set({ isSubmittingBrief: true, hydrateError: null });

    try {
      const apiKey = resolveOrchestratorApiKey();
      const res = await fetch(`${resolveOrchestratorBase()}/api/tools/canvas_builder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey
            ? { 'Authorization': `Bearer ${apiKey}`, 'X-API-Key': apiKey }
            : {}),
        },
        body: JSON.stringify({
          brief: trimmed,
          host_origin: 'widgetdc-canvas',
          surface_hint: 'full',
          prior_track: prevTrack ?? undefined,
          sequence_step: sequenceStep,
        }),
      });

      if (!res.ok) {
        throw new Error(`canvas_builder HTTP ${res.status}`);
      }

      const envelope = (await res.json()) as {
        success?: boolean;
        data?: {
          result?: string | { success?: boolean; resolution?: CanvasResolutionWire };
        };
      };

      // Envelope.data.result may be stringified JSON OR a fold-marker preview
      // when the orchestrator has context-folded the output (>1.5KB). In the folded
      // case it contains a '📄 Full output … 
<url>' pattern; resolveToolOutput
      // de-references that URL automatically. See src/lib/toolOutputFold.ts.
      const rawResult = envelope?.data?.result;
      let parsed: { success?: boolean; resolution?: CanvasResolutionWire } | null = null;
      try {
        parsed = await resolveToolOutput<{ success?: boolean; resolution?: CanvasResolutionWire }>(rawResult);
      } catch (parseErr) {
        console.warn('[canvasSession] canvas_builder output unparseable:', parseErr);
        parsed = null;
      }

      const resolution = parsed?.resolution;
      if (!resolution) {
        throw new Error('canvas_builder returned no resolution');
      }

      const rationale = Array.isArray(resolution.rationale) ? resolution.rationale : [];
      const ruleIdFired = extractRuleIdFromRationale(rationale);
      const nodes = Array.isArray(resolution.pre_seeded_nodes)
        ? resolution.pre_seeded_nodes
        : [];

      // Seed the markdown pane's Y.Doc with pre_seeded_nodes if present.
      // Use transact() — TextPane's useEffect re-renders when crdtDoc observes updates.
      if (nodes.length > 0) {
        const { panes } = get();
        const markdownDoc = panes.markdown.crdtDoc;
        markdownDoc.transact(() => {
          const arr = markdownDoc.getArray<PreSeededNode>('nodes');
          arr.delete(0, arr.length);
          arr.insert(0, nodes);
        }, 'submit-brief');
      }

      const resolvedAt = resolution.resolved_at ?? new Date().toISOString();

      set((state) => ({
        canvasSessionId: resolution.canvas_session_id ?? state.canvasSessionId,
        track: resolution.track ?? state.track,
        activePane: resolution.initial_pane ?? state.activePane,
        embedUrl: resolution.embed_url ?? state.embedUrl,
        rationale,
        preSeededNodes: nodes,
        lastResolution: resolution,
        ruleIdFired,
        isSubmittingBrief: false,
        // Force markdown pane re-render via lastMutatedAt bump when nodes arrived
        panes: nodes.length > 0
          ? {
              ...state.panes,
              markdown: {
                ...state.panes.markdown,
                lastMutatedAt: resolvedAt,
              },
            }
          : state.panes,
        briefHistory: [
          ...state.briefHistory,
          {
            brief: trimmed,
            resolvedAt,
            track: resolution.track,
            ruleId: ruleIdFired,
          },
        ].slice(-20),
      }));

      // M5 T4.5: kick off multi-modal produce after resolution — fire-and-forget
      void get().startMultiModal(trimmed, resolution);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[canvasSession] submitBrief failed:', message);
      set({ hydrateError: message, isSubmittingBrief: false });
    }
  },

  async recordReward(reward) {
    const state = get();
    if (!state.canvasSessionId || !state.ruleIdFired || !state.track) return;
    if (state.rewardStatus === 'submitting') return;

    set({ rewardStatus: 'submitting' });

    try {
      const apiKey = resolveBackendApiKey();
      const res = await fetch(`${resolveBackendBase()}/api/mrp/canvas-outcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey
            ? { 'Authorization': `Bearer ${apiKey}`, 'X-API-Key': apiKey }
            : {}),
        },
        body: JSON.stringify({
          session_id: state.canvasSessionId,
          rule_id_fired: state.ruleIdFired,
          track_selected: state.track,
          reward,
          bom_version: '2.0',
        }),
      });

      if (!res.ok) {
        // Soft fail: backend route may not exist yet (UC3 aggregator reads
        // :CanvasTrackOutcome nodes which the backend needs to MERGE).
        set({ rewardStatus: 'failed' });
        setTimeout(() => {
          if (get().rewardStatus === 'failed') set({ rewardStatus: 'idle' });
        }, 3000);
        return;
      }

      set({ rewardStatus: 'sent' });
      setTimeout(() => {
        if (get().rewardStatus === 'sent') set({ rewardStatus: 'idle' });
      }, 2000);
    } catch (err) {
      console.warn('[canvasSession] recordReward soft-fail:', err);
      set({ rewardStatus: 'failed' });
      setTimeout(() => {
        if (get().rewardStatus === 'failed') set({ rewardStatus: 'idle' });
      }, 3000);
    }
  },

  appendHostMessage(origin, payload) {
    set((state) => ({
      hostMessages: [
        ...state.hostMessages,
        { origin, payload, receivedAt: new Date().toISOString() },
      ].slice(-10),
    }));
  },

  // ── M5: Multi-modal produce (T4.5) ─────────────────────────────────────────

  /**
   * After canvas_builder resolution, call the multi-modal produce endpoint.
   * Opens an SSE EventSource, progressively filling per-pane artifacts as
   * each modality stream event arrives. Soft-fails if endpoint returns 404
   * (backend route may not be live yet).
   */
  async startMultiModal(brief, canvasResolution) {
    const state = get();
    const backendBase = resolveBackendBase();
    const apiKey = resolveBackendApiKey();

    // Initialise the order with all modalities in 'pending' state
    const initialOrder: MultiModalOrder = {
      order_id: '',
      sse_url: '',
      sse_connected: false,
      artifacts: {
        architecture: { status: 'pending' },
        text: { status: 'pending' },
        diagram: { status: 'pending' },
        slides: { status: 'pending' },
      },
    };
    set({ materializingOrder: initialOrder });

    try {
      const res = await fetch(`${backendBase}/api/mrp/produce/multi-modal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey
            ? { 'Authorization': `Bearer ${apiKey}`, 'X-API-Key': apiKey }
            : {}),
        },
        body: JSON.stringify({
          canvas_resolution: canvasResolution,
          brief,
          session_id: state.canvasSessionId,
        }),
      });

      if (!res.ok) {
        // Soft-fail: route may be pending backend deploy
        console.warn(`[canvasSession] multi-modal produce HTTP ${res.status} — skipping SSE`);
        set({ materializingOrder: null });
        return;
      }

      const envelope = (await res.json()) as {
        order_id?: string;
        sse_url?: string;
        modalities?: string[];
      };

      const orderId = envelope.order_id ?? '';
      const sseUrl = envelope.sse_url ?? '';
      const modalities = Array.isArray(envelope.modalities) ? envelope.modalities : Object.keys(initialOrder.artifacts);

      // Build initial artifact map from declared modalities
      const artifacts: Record<string, ModalityArtifact> = {};
      for (const mod of modalities) {
        artifacts[mod] = { status: 'pending' };
      }

      set({
        materializingOrder: {
          order_id: orderId,
          sse_url: sseUrl,
          sse_connected: false,
          artifacts,
        },
      });

      if (!sseUrl) return;

      // Open SSE connection
      const eventSource = new EventSource(sseUrl);

      set((s) => ({
        materializingOrder: s.materializingOrder
          ? { ...s.materializingOrder, sse_connected: true }
          : null,
      }));

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            modality?: string;
            status?: string;
            uri?: string;
            content_hash?: string;
            content?: unknown;
          };
          if (data.modality) {
            get().updateArtifactFromSSE(data.modality, {
              status: (data.status as ModalityArtifact['status']) ?? 'streaming',
              uri: data.uri,
              content_hash: data.content_hash,
              content: data.content,
            });
          }
        } catch {
          // malformed event — ignore
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        set((s) => ({
          materializingOrder: s.materializingOrder
            ? { ...s.materializingOrder, sse_connected: false }
            : null,
        }));
      };

    } catch (err) {
      console.warn('[canvasSession] startMultiModal soft-fail:', err);
      set({ materializingOrder: null });
    }
  },

  updateArtifactFromSSE(modality, update) {
    set((state) => {
      if (!state.materializingOrder) return {};
      return {
        materializingOrder: {
          ...state.materializingOrder,
          artifacts: {
            ...state.materializingOrder.artifacts,
            [modality]: {
              ...(state.materializingOrder.artifacts[modality] ?? { status: 'pending' }),
              ...update,
            },
          },
        },
      };
    });
  },

  closeSSE() {
    set({ materializingOrder: null });
  },

  async fetchPatternPalette() {
    try {
      const palette = await fetchPatternPalette(250);
      set({ patternPalette: palette });
    } catch (err) {
      console.warn('[canvasSession] fetchPatternPalette failed:', err);
      set({ patternPalette: [] });
    }
  },

  togglePatternSelection(patternId) {
    set((state) => {
      const exists = state.selectedPatternIds.includes(patternId);
      return {
        selectedPatternIds: exists
          ? state.selectedPatternIds.filter((id) => id !== patternId)
          : [...state.selectedPatternIds, patternId],
      };
    });
  },

  async startComposeTelemetry(brief) {
    const trimmed = brief.trim();
    if (!trimmed) return;

    const selectedPatterns = get().selectedPatternIds;
    const accepted = await composeRequest({
      brief: trimmed,
      modalities: ['textual'],
      request_features_override: selectedPatterns.length > 0
        ? { patterns_applied: selectedPatterns }
        : undefined,
    });

    const source = new EventSource(composeEventSourceUrl(accepted.sse_url));
    set({
      composeBomrunId: accepted.bomrun_id,
      composeAcceptedAt: accepted.accepted_at,
      composeSseConnected: true,
      composeOperatorStatus: idleOperators(),
      composeEvents: [],
      lineageEdges: [],
    });

    source.onmessage = (event) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(String(event.data ?? '{}')) as Record<string, unknown>;
      } catch {
        parsed = {};
      }

      const topicRaw = String(parsed.topic ?? '');
      const topic = (topicRaw || String((event as MessageEvent).type || '')) as ComposeTopic;
      const explicitOperator = String(parsed.operator ?? parsed.stage ?? '').trim();

      set((state) => {
        const next = { ...state.composeOperatorStatus };

        if (topic === 'composition.started') {
          next.CT = 'running';
        } else if (explicitOperator && OPERATOR_ORDER.includes(explicitOperator as ComposeOperator)) {
          const key = explicitOperator as ComposeOperator;
          next[key] = topic === 'composition.failed' ? 'failed' : 'running';
        } else if (topic === 'composition.artifact_ready') {
          next.materialize = next.materialize === 'done' ? 'done' : 'running';
        } else if (topic === 'composition.fitness_scored') {
          next.materialize = 'done';
        } else if (topic === 'composition.completed') {
          for (const op of OPERATOR_ORDER) {
            next[op] = next[op] === 'failed' ? 'failed' : 'done';
          }
        } else if (topic === 'composition.failed') {
          const running = OPERATOR_ORDER.find((op) => next[op] === 'running');
          if (running) next[running] = 'failed';
        }

        return {
          composeOperatorStatus: next,
          composeEvents: [
            ...state.composeEvents,
            {
              topic: topic || 'composition.started',
              payload: parsed,
              receivedAt: new Date().toISOString(),
            },
          ].slice(-40),
        };
      });
    };

    source.onerror = () => {
      source.close();
      set({ composeSseConnected: false });
    };
  },

  async fetchProvenanceForCurrentRun() {
    const run = get().composeBomrunId;
    if (!run) return;
    set({ lineageLoading: true });
    try {
      const edges = await fetchComposeLineage(run);
      set({ lineageEdges: edges, lineageLoading: false });
    } catch (err) {
      console.warn('[canvasSession] fetchProvenanceForCurrentRun failed:', err);
      set({ lineageEdges: [], lineageLoading: false });
    }
  },
}));
