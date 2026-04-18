/**
 * UC5 Canvas Session Types
 * Wire format: snake_case → TS: camelCase
 */

export type BuilderTrack =
  | 'textual'
  | 'slide_flow'
  | 'diagram'
  | 'architecture'
  | 'graphical'
  | 'code'
  | 'experiment';

export type PaneId = 'canvas' | 'markdown' | 'slides' | 'drawio' | 'split';

/** Wire shape returned by /api/session/:id/hydrate */
export interface CanvasResolutionWire {
  track: BuilderTrack;
  initial_pane: PaneId;
  canvas_session_id: string;
  embed_url?: string;
  pre_seeded_nodes?: PreSeededNode[];
  rationale?: string[];
  bom_version: '2.0';
  resolved_at: string;
}

export interface PreSeededNode {
  id: string;
  type: string;
  label: string;
  data?: Record<string, unknown>;
}

/** Camel-cased in-app representation */
export interface CanvasResolution {
  track: BuilderTrack;
  initialPane: PaneId;
  canvasSessionId: string;
  embedUrl?: string;
  preSeededNodes: PreSeededNode[];
  rationale: string[];
  bomVersion: '2.0';
  resolvedAt: string;
}

/** postMessage bridge message shapes */
export interface BridgeMessageInbound {
  type: 'hydrate' | 'mutate' | 'switch';
  sessionId?: string;
  track?: BuilderTrack;
  pane?: PaneId;
  payload?: unknown;
}

export interface BridgeMessageOutbound {
  type: 'sessionReady' | 'paneChanged' | 'userEdit';
  sessionId: string | null;
  activePane?: PaneId;
  timestamp: string;
}

/** Slide shape for SlidePane */
export interface SlideItem {
  id: string;
  title: string;
  body: string;
  notes?: string;
}
