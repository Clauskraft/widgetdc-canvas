/**
 * UC5 — SlidePane
 * Minimal slide viewer: one slide per Y.Array element, arrow-key navigation.
 * Follows substrate-cartography design: paper surface, mono labels, sparse motion.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { useCanvasSession } from '../state/canvasSession';
import type { SlideItem } from '../types/session';

// ── Default empty-state slides ────────────────────────────────────────────────

const DEFAULT_SLIDES: SlideItem[] = [
  {
    id: 'slide-01',
    title: 'Slide 01',
    body: 'No content seeded yet. Hydrate a session or add slides via the host bridge.',
    notes: '',
  },
];

// ── Slide renderer ────────────────────────────────────────────────────────────

interface SlideViewProps {
  slide: SlideItem;
  index: number;
  total: number;
}

function SlideView({ slide, index, total }: SlideViewProps) {
  return (
    <div
      role="region"
      aria-label={`Slide ${index + 1} of ${total}: ${slide.title}`}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'var(--sc-pane-pad)',
        background: 'var(--sc-surface-elevated)',
        border: '0.5px solid var(--sc-paper-whisper)',
        borderRadius: 'var(--sc-radius-md)',
        minHeight: 0,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '9px',
          letterSpacing: 'var(--sc-tracking-label)',
          textTransform: 'uppercase',
          color: 'var(--sc-ink-fog)',
          marginBottom: '24px',
        }}
      >
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>

      <h2
        style={{
          fontFamily: 'var(--sc-font-sans)',
          fontSize: '2rem',
          fontWeight: 300,
          letterSpacing: '-0.01em',
          color: 'var(--sc-ink-graphite)',
          margin: '0 0 20px',
          lineHeight: 'var(--sc-leading-tight)',
        }}
      >
        {slide.title}
      </h2>

      <p
        style={{
          fontFamily: 'var(--sc-font-sans)',
          fontSize: '13px',
          lineHeight: 1.7,
          color: 'var(--sc-ink-stone)',
          maxWidth: '52ch',
          margin: 0,
        }}
      >
        {slide.body}
      </p>

      {slide.notes && (
        <>
          <hr
            style={{
              border: 0,
              borderTop: '0.5px solid var(--sc-paper-whisper)',
              margin: '28px 0',
            }}
          />
          <p
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '11px',
              color: 'var(--sc-ink-fog)',
              letterSpacing: '0.04em',
              margin: 0,
            }}
          >
            {slide.notes}
          </p>
        </>
      )}
    </div>
  );
}

// ── Navigation bar ────────────────────────────────────────────────────────────

interface NavBarProps {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

function NavBar({ index, total, onPrev, onNext }: NavBarProps) {
  const navBtn = (label: string, onClick: () => void, disabled: boolean, ariaLabel: string) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        fontFamily: 'var(--sc-font-mono)',
        fontSize: '9px',
        letterSpacing: 'var(--sc-tracking-label)',
        textTransform: 'uppercase',
        color: disabled ? 'var(--sc-ink-fog)' : 'var(--sc-ink-graphite)',
        background: 'transparent',
        border: '0.5px solid var(--sc-paper-whisper)',
        borderRadius: 'var(--sc-radius-sm)',
        padding: '5px 14px',
        cursor: disabled ? 'default' : 'pointer',
        transition: `color var(--sc-duration-quick) var(--sc-ease-emphasized)`,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0 0',
        borderTop: '0.5px solid var(--sc-paper-whisper)',
        marginTop: '16px',
      }}
      role="navigation"
      aria-label="Slide navigation"
    >
      {navBtn('prev', onPrev, index === 0, 'Previous slide')}
      <span
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '9px',
          letterSpacing: '0.18em',
          color: 'var(--sc-ink-fog)',
        }}
      >
        {index + 1} / {total}
      </span>
      {navBtn('next', onNext, index === total - 1, 'Next slide')}
    </div>
  );
}

// ── SlidePane ─────────────────────────────────────────────────────────────────

export function SlidePane() {
  const { canvasSessionId, track, panes } = useCanvasSession((s) => ({
    canvasSessionId: s.canvasSessionId,
    track: s.track,
    panes: s.panes,
  }));

  const paneState = panes.slides;
  const [slides, setSlides] = useState<SlideItem[]>(DEFAULT_SLIDES);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Observe Y.Array for slide data
  useEffect(() => {
    const doc = paneState.crdtDoc;
    const arr = doc.getArray<SlideItem>('slides');

    const sync = () => {
      const items = arr.toArray();
      setSlides(items.length > 0 ? items : DEFAULT_SLIDES);
      setActiveIndex((prev) => Math.min(prev, Math.max(0, items.length - 1)));
    };

    arr.observe(sync);
    sync(); // initial read

    return () => arr.unobserve(sync);
  }, [paneState.crdtDoc]);

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)));
    },
    [slides.length],
  );

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(activeIndex + 1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(activeIndex - 1);
    };
    containerRef.current?.addEventListener('keydown', onKey);
    return () => containerRef.current?.removeEventListener('keydown', onKey);
  }, [activeIndex, goTo]);

  const trackHue = track ? `var(--sc-track-${track.replace('_', '-')})` : 'var(--sc-ink-graphite)';
  const slide = slides[activeIndex] ?? DEFAULT_SLIDES[0];

  return (
    <div
      ref={containerRef}
      className="sc-root"
      tabIndex={0}
      aria-label="Slide pane — use arrow keys to navigate"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 'var(--sc-pane-pad)',
        background: 'var(--sc-surface-bg)',
        outline: 'none',
      }}
    >
      {/* Pane header */}
      <div className="sc-pane-head">
        <span className="sc-pane-label" style={{ color: trackHue }}>
          Slides · SlidePane
        </span>
        <span className="sc-pane-meta">
          {canvasSessionId ? `session ${canvasSessionId.slice(0, 8)}` : 'no session'}
          {' · '}arrow-key nav
        </span>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <SlideView slide={slide} index={activeIndex} total={slides.length} />
      </div>

      {/* Navigation */}
      <NavBar
        index={activeIndex}
        total={slides.length}
        onPrev={() => goTo(activeIndex - 1)}
        onNext={() => goTo(activeIndex + 1)}
      />
    </div>
  );
}
