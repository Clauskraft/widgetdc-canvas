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

export type PaneId =
  | 'canvas'
  | 'markdown'
  | 'slides'
  | 'drawio'
  | 'split'
  | 'phantom_bom'
  | 'architecture_spec'
  | 'innovation_backlog'
  | 'research'
  | 'telemetry';

/** Modality artifact status from multi-modal SSE stream */
export type ModalityStatus = 'pending' | 'streaming' | 'ready' | 'error';

/** Single modality artifact produced by multi-modal endpoint */
export interface ModalityArtifact {
  status: ModalityStatus;
  uri?: string;
  content_hash?: string;
  content?: unknown;
}

/** Multi-modal order state from POST /api/mrp/produce/multi-modal */
export interface MultiModalOrder {
  order_id: string;
  sse_url: string;
  sse_connected: boolean;
  artifacts: Record<string, ModalityArtifact>;
}

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
  /** M5: framework and blueprint IDs for RationaleExpander drill */
  framework_id?: string;
  blueprint_id?: string;
  patterns_applied?: string[];
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
