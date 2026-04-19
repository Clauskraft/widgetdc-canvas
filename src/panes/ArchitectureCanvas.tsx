import { useMemo } from 'react';
import type { BuilderTrack } from '../types/session';

/**
 * ArchitectureCanvas — UC5 canvas pane rendered as a substrate-cartography
 * isoline chart. Seven concentric rings (one per builder track), eighteen
 * radial ticks per ring, a single anchor at the geometric centre
 * (CanvasIntent). Pixel-faithful to `docs/canvas/prototype.html` — the
 * `viewBox`, ring base / gap, tick count, tick length, leader-line offset
 * and label-ring offset are transcribed verbatim from that spec.
 *
 * Rendering strategy: pure SVG, zero dependencies, zero animation loops.
 * All colours / typography resolve through `var(--sc-*)` custom properties
 * defined in `src/theme/substrate-cartography.css`. The only exception is
 * per-track `stroke` / `fill` attributes where we resolve the CSS var
 * inline (e.g. `stroke="var(--sc-track-textual)"`) so each ring can carry
 * its own hue without bleeding into sibling rings.
 *
 * Accessibility: `role="img"` with an `aria-label` describing the chart,
 * and an SVG `<title>` / `<desc>` for screen readers that pick those up.
 */

export interface ArchitectureCanvasProps {
  /** Currently-selected builder track. When set, that ring is emphasised. */
  track?: BuilderTrack | null;
}

/** Ring definitions, transcribed verbatim from prototype.html. */
interface RingDef {
  id: string;
  key: BuilderTrack;
  /** CSS custom-property name (hyphenated). */
  cssVar: string;
  /** Human label rendered along the ring. */
  label: string;
}

const RINGS: readonly RingDef[] = [
  { id: 't1', key: 'textual',      cssVar: '--sc-track-textual',      label: 'T1  textual' },
  { id: 't2', key: 'slide_flow',   cssVar: '--sc-track-slide-flow',   label: 'T2  slide flow' },
  { id: 't3', key: 'diagram',      cssVar: '--sc-track-diagram',      label: 'T3  diagram' },
  { id: 't4', key: 'architecture', cssVar: '--sc-track-architecture', label: 'T4  architecture' },
  { id: 't5', key: 'graphical',    cssVar: '--sc-track-graphical',    label: 'T5  graphical' },
  { id: 't6', key: 'code',         cssVar: '--sc-track-code',         label: 'T6  code' },
  { id: 't7', key: 'experiment',   cssVar: '--sc-track-experiment',   label: 'T7  experiment' },
];

// Geometry — transcribed from prototype.html line 275
const VIEW_W = 600;
const VIEW_H = 520;
const CX = 280;
const CY = 260;
const BASE_R = 50;
const GAP_R = 26;
const TICKS_PER_RING = 18;
const TICK_LEN = 3;       // outward tick length
const LEADER_LEN = 10;    // leader line from ring to label
const LABEL_OFFSET = 14;  // label ring offset beyond the ring itself

/** Grid positions, transcribed from prototype.html lines 178-183. */
const GRID_HORIZONTAL = [80, 160, 240, 320, 400, 480];
const GRID_VERTICAL = [80, 160, 240, 320, 400, 480];

interface ComputedRing {
  def: RingDef;
  r: number;
  ticks: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  label: {
    lx: number;
    ly: number;
    anchor: 'start' | 'middle' | 'end';
    leader: { x1: number; y1: number; x2: number; y2: number };
  };
}

function computeRings(): ComputedRing[] {
  return RINGS.map((def, i) => {
    const r = BASE_R + i * GAP_R;

    // Ticks — 18 evenly spaced, each 3px outward from the ring (prototype lines 284-295).
    const ticks = Array.from({ length: TICKS_PER_RING }, (_, k) => {
      const a = (k / TICKS_PER_RING) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      return {
        x1: CX + cosA * r,
        y1: CY + sinA * r,
        x2: CX + cosA * (r + TICK_LEN),
        y2: CY + sinA * (r + TICK_LEN),
      };
    });

    // Label angle — spread evenly around 360°, starting at north (-90°)
    // so T1 sits at top and each subsequent track rotates clockwise
    // (prototype lines 296-323).
    const angleDeg = -90 + i * (360 / RINGS.length);
    const angleRad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const labelR = r + LABEL_OFFSET;
    const anchor: 'start' | 'middle' | 'end' =
      cosA > 0.25 ? 'start' : cosA < -0.25 ? 'end' : 'middle';

    return {
      def,
      r,
      ticks,
      label: {
        lx: CX + cosA * labelR,
        ly: CY + sinA * labelR,
        anchor,
        leader: {
          x1: CX + cosA * r,
          y1: CY + sinA * r,
          x2: CX + cosA * (r + LEADER_LEN),
          y2: CY + sinA * (r + LEADER_LEN),
        },
      },
    };
  });
}

export function ArchitectureCanvas({ track = null }: ArchitectureCanvasProps) {
  const rings = useMemo(() => computeRings(), []);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Architecture substrate — seven builder tracks arranged as concentric cartographic isolines."
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          background: 'var(--sc-surface-bg)',
          fontFamily: 'var(--sc-font-mono)',
        }}
      >
        <title>Architecture substrate cartography</title>
        <desc>
          Seven concentric isolines, one per builder track (textual, slide flow, diagram,
          architecture, graphical, code, experiment). Each ring carries eighteen radial
          ticks. A single anchor at the geometric centre marks the CanvasIntent.
        </desc>

        {/* Faint cartographic grid — paper-whisper, 0.5px, .6 opacity. */}
        <g
          stroke="var(--sc-paper-whisper)"
          strokeWidth={0.25}
          opacity={0.6}
          aria-hidden="true"
        >
          {GRID_HORIZONTAL.map((y) => (
            <line key={`h-${y}`} x1={0} y1={y} x2={VIEW_W} y2={y} />
          ))}
          {GRID_VERTICAL.map((x) => (
            <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={VIEW_H} />
          ))}
        </g>

        {/* Isolines — one per track. */}
        <g aria-hidden="true">
          {rings.map((ring) => {
            const isActive = track === ring.def.key;
            const strokeColor = `var(${ring.def.cssVar})`;
            // Active ring: thicker stroke + slightly bolder opacity.
            const ringStrokeWidth = isActive ? 1.8 : 1.1;
            const ringOpacity = isActive ? 0.95 : 0.78;

            return (
              <g key={ring.def.id}>
                {/* Active-track halo — subtle outward glow, no animation. */}
                {isActive ? (
                  <circle
                    cx={CX}
                    cy={CY}
                    r={ring.r}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={4.5}
                    opacity={0.14}
                  />
                ) : null}

                {/* Ring itself. */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={ring.r}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={ringStrokeWidth}
                  opacity={ringOpacity}
                />

                {/* 18 radial ticks. */}
                {ring.ticks.map((t, k) => (
                  <line
                    key={k}
                    x1={t.x1.toFixed(2)}
                    y1={t.y1.toFixed(2)}
                    x2={t.x2.toFixed(2)}
                    y2={t.y2.toFixed(2)}
                    stroke={strokeColor}
                    strokeWidth={1}
                    opacity={0.65}
                  />
                ))}

                {/* Leader line from ring to label. */}
                <line
                  x1={ring.label.leader.x1}
                  y1={ring.label.leader.y1}
                  x2={ring.label.leader.x2}
                  y2={ring.label.leader.y2}
                  stroke={strokeColor}
                  strokeWidth={0.5}
                  opacity={0.7}
                />

                {/* Label. */}
                <text
                  x={ring.label.lx}
                  y={ring.label.ly}
                  fill={strokeColor}
                  textAnchor={ring.label.anchor}
                  dominantBaseline="middle"
                  style={{
                    fontFamily: 'var(--sc-font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.12em',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {ring.def.label.toUpperCase()}
                </text>
              </g>
            );
          })}
        </g>

        {/* Anchor — the fixed geometric centre that maps to CanvasIntent. */}
        <g>
          <circle cx={CX} cy={CY} r={3.2} fill="var(--sc-ink-graphite)" />
          <text
            x={CX + 10}
            y={CY - 5}
            fill="var(--sc-ink-graphite)"
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: 9,
              letterSpacing: '0.12em',
            }}
          >
            CanvasIntent
          </text>
        </g>
      </svg>
    </div>
  );
}

export default ArchitectureCanvas;
