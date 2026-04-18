/**
 * UC5 — SplitPaneLayout
 * Two-column layout with drag-to-resize divider.
 * Left pane: Canvas (ReactFlow) or Markdown editor.
 * Right pane: any sibling pane (slides, drawio, text, etc.).
 *
 * Uses CSS flex + pointer events for the divider — no external lib dependency.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface SplitPaneLayoutProps {
  left: ReactNode;
  right: ReactNode;
  /** Initial left pane width as a fraction 0–1. Defaults to 0.58 (≈1.4fr:1fr ratio from prototype). */
  initialSplit?: number;
  /** Min px width for each pane */
  minPanePx?: number;
}

export function SplitPaneLayout({
  left,
  right,
  initialSplit = 0.58,
  minPanePx = 240,
}: SplitPaneLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitFraction, setSplitFraction] = useState(initialSplit);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startFraction = useRef(initialSplit);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startFraction.current = splitFraction;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [splitFraction]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const delta = e.clientX - startX.current;
      const deltaFraction = delta / containerWidth;
      const next = Math.max(
        minPanePx / containerWidth,
        Math.min(1 - minPanePx / containerWidth, startFraction.current + deltaFraction),
      );
      setSplitFraction(next);
    };

    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [minPanePx]);

  const leftPct = `${(splitFraction * 100).toFixed(1)}%`;
  const rightPct = `${((1 - splitFraction) * 100).toFixed(1)}%`;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        minHeight: 0,
        background: 'var(--sc-surface-bg)',
        overflow: 'hidden',
      }}
      aria-label="Split pane layout"
    >
      {/* Left pane */}
      <div
        style={{
          width: leftPct,
          minWidth: `${minPanePx}px`,
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
        role="region"
        aria-label="Left pane"
      >
        {left}
      </div>

      {/* Drag-to-resize divider */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize divider — drag to resize panes"
        tabIndex={0}
        onMouseDown={onDividerMouseDown}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setSplitFraction((f) => Math.max(minPanePx / (containerRef.current?.offsetWidth ?? 800), f - 0.02));
          if (e.key === 'ArrowRight') setSplitFraction((f) => Math.min(1 - minPanePx / (containerRef.current?.offsetWidth ?? 800), f + 0.02));
        }}
        style={{
          width: '12px',
          flexShrink: 0,
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Visual handle */}
        <div
          aria-hidden="true"
          style={{
            width: '1px',
            height: '100%',
            background: 'var(--sc-paper-whisper)',
            transition: `background var(--sc-duration-quick) var(--sc-ease-emphasized)`,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--sc-ink-fog)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--sc-paper-whisper)'; }}
        />
      </div>

      {/* Right pane */}
      <div
        style={{
          width: rightPct,
          minWidth: `${minPanePx}px`,
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
        role="region"
        aria-label="Right pane"
      >
        {right}
      </div>
    </div>
  );
}
