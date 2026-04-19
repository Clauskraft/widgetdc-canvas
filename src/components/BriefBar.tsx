/**
 * UC5 — BriefBar
 * Top intelligence input. User types a free-text brief, hits Enter, and the
 * canvas calls orchestrator `canvas_builder` → resolves track → auto-switches
 * pane → seeds pane content → surfaces rationale in the footer strip.
 *
 * This is the single intelligence entrypoint — without it, the canvas is four
 * dumb editors in a beautiful theme.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasSession } from '../state/canvasSession';

export function BriefBar() {
  const submitBrief = useCanvasSession((s) => s.submitBrief);
  const isSubmittingBrief = useCanvasSession((s) => s.isSubmittingBrief);
  const ruleIdFired = useCanvasSession((s) => s.ruleIdFired);
  const hydrateError = useCanvasSession((s) => s.hydrateError);
  const track = useCanvasSession((s) => s.track);

  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isSubmittingBrief) return;
    await submitBrief(trimmed);
    // On success, clear. `submitBrief` itself sets isSubmittingBrief=false.
    // If hydrateError was set, we keep the text so the user can retry.
    if (!useCanvasSession.getState().hydrateError) {
      setValue('');
    }
  }, [value, isSubmittingBrief, submitBrief]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      } else if (e.key === 'Escape') {
        setValue('');
      }
    },
    [handleSubmit],
  );

  // Focus input on mount for zero-friction first-brief entry
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trackHue = track
    ? `var(--sc-track-${track.replace('_', '-')})`
    : 'var(--sc-ink-graphite)';

  return (
    <section
      role="search"
      aria-label="Canvas intelligence brief"
      className="uc5-brief-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '18px',
        padding: '14px var(--sc-pane-pad)',
        borderBottom: '0.5px solid var(--sc-paper-whisper)',
        background: 'var(--sc-surface-bg)',
        flexShrink: 0,
        minHeight: '48px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          background: trackHue,
          borderRadius: '50%',
          flexShrink: 0,
          opacity: 0.9,
        }}
      />
      <label
        htmlFor="uc5-brief-input"
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--sc-ink-fog)',
          flexShrink: 0,
        }}
      >
        Brief
      </label>
      <input
        id="uc5-brief-input"
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSubmittingBrief}
        placeholder="Describe what you want to build… — press Enter"
        aria-label="Brief input"
        aria-busy={isSubmittingBrief}
        aria-describedby={hydrateError ? 'uc5-brief-error' : undefined}
        autoComplete="off"
        spellCheck="true"
        style={{
          flex: 1,
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '13px',
          letterSpacing: '0.01em',
          color: 'var(--sc-ink-graphite)',
          background: 'transparent',
          border: 'none',
          borderBottom: '0.5px solid var(--sc-paper-whisper)',
          outline: 'none',
          padding: '6px 0',
          minWidth: 0,
        }}
      />
      {isSubmittingBrief && (
        <span
          role="status"
          aria-live="polite"
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '10px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
        >
          resolving…
        </span>
      )}
      {!isSubmittingBrief && ruleIdFired && (
        <span
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--sc-ink-fog)',
          }}
          aria-label={`Last rule fired: ${ruleIdFired}`}
        >
          via {ruleIdFired}
        </span>
      )}
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={isSubmittingBrief || !value.trim()}
        aria-label="Resolve brief"
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color:
            isSubmittingBrief || !value.trim()
              ? 'var(--sc-ink-fog)'
              : 'var(--sc-ink-graphite)',
          background: 'transparent',
          border: '0.5px solid',
          borderColor:
            isSubmittingBrief || !value.trim()
              ? 'var(--sc-paper-whisper)'
              : 'var(--sc-ink-graphite)',
          borderRadius: 'var(--sc-radius-sm)',
          padding: '6px 14px',
          cursor: isSubmittingBrief || !value.trim() ? 'not-allowed' : 'pointer',
          transition: 'all var(--sc-duration-quick) var(--sc-ease-emphasized)',
          flexShrink: 0,
        }}
      >
        Resolve
      </button>
      {hydrateError && (
        <span
          id="uc5-brief-error"
          role="alert"
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.15em',
            color: 'var(--sc-track-slide-flow)',
          }}
        >
          {hydrateError}
        </span>
      )}
    </section>
  );
}
