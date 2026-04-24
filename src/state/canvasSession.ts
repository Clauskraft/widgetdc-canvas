/**
 * UC5 — Canvas Session store
 * Multi-pane Zustand store with per-pane Y.Doc CRDT and session hydration.
 */

import { create } from 'zustand';
import * as Y from 'yjs';
import type {
  BuilderTrack,
  CanvasModeId,
  PaneId,
  CanvasResolutionWire,
  PreSeededNode,
  ProductFrameId,
} from '../types/session';

const SESSION_HYDRATE_BASE = (
  String(import.meta.env.VITE_CANVAS_SESSION_API_BASE ?? '/api/session').trim() ||
  '/api/session'
).replace(/\/$/, '');

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

const PANE_IDS: PaneId[] = ['canvas', 'markdown', 'slides', 'drawio', 'split'];

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
  productFrameId: ProductFrameId | null;
  domainProfileId: string | null;
  starterTemplateIds: string[];
  allowedModes: CanvasModeId[];
  requiredCapabilityIds: string[];
  requiredEvaluationHookIds: string[];
  isHydrating: boolean;
  hydrateError: string | null;

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
  productFrameId: null,
  domainProfileId: null,
  starterTemplateIds: [],
  allowedModes: [],
  requiredCapabilityIds: [],
  requiredEvaluationHookIds: [],
  isHydrating: false,
  hydrateError: null,

  async hydrate({ sessionId, track, initialPane }) {
    set({
      isHydrating: true,
      hydrateError: null,
      productFrameId: null,
      domainProfileId: null,
      starterTemplateIds: [],
      allowedModes: [],
      requiredCapabilityIds: [],
      requiredEvaluationHookIds: [],
    });

    // Optimistic — set track & pane from URL params immediately
    set({ canvasSessionId: sessionId, track, activePane: initialPane });

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
        productFrameId: wire.product_frame_id ?? null,
        domainProfileId: wire.domain_profile_id ?? null,
        starterTemplateIds: wire.starter_template_ids ?? [],
        allowedModes: wire.allowed_modes ?? [],
        requiredCapabilityIds: wire.required_capability_ids ?? [],
        requiredEvaluationHookIds: wire.required_evaluation_hook_ids ?? [],
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
}));
