/**
 * UC5 — RationaleStrip
 * Footer strip that shows *why* the current track was resolved, plus reward
 * feedback (👍/👎) that feeds UC3 weekly EMA aggregator → UC8 monthly evolver.
 *
 * Three columns:
 *   LEFT  — resolution: track hue pill + track name + rule_id_fired
 *   CENTER — top 2 rationale lines (small monospace)
 *   RIGHT — reward buttons + status
 *
 * Replaces UC5StatusBar's "one surface · many windows" tagline with actionable
 * intelligence. Session + host bridge info is merged into the left column.
 */

import { useCallback } from 'react';
import { useCanvasSession } from '../state/canvasSession';

export function RationaleStrip() {
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const hostOrigin = useCanvasSession((s) => s.hostOrigin);
  const track = useCanvasSession((s) => s.track);
  const rationale = useCanvasSession((s) => s.rationale);
  const ruleIdFired = useCanvasSession((s) => s.ruleIdFired);
  const lastResolution = useCanvasSession((s) => s.lastResolution);
  const rewardStatus = useCanvasSession((s) => s.rewardStatus);
  const recordReward = useCanvasSession((s) => s.recordReward);

  const onThumbUp = useCallback(() => { void recordReward(1); }, [recordReward]);
  const onThumbDown = useCallback(() => { void recordReward(0); }, [recordReward]);

  const hasResolution = Boolean(lastResolution);
  const trackHue = track
    ? `var(--sc-track-${track.replace('_', '-')})`
    : 'var(--sc-ink-graphite)';

  // Reward status copy
  let rewardCopy: string | null = null;
  if (rewardStatus === 'submitting') rewardCopy = 'submitting…';
  else if (rewardStatus === 'sent') rewardCopy = 'sent ✓';
  else if (rewardStatus === 'failed') rewardCopy = 'failed (backend pending)';

  return (
    <footer
      role="contentinfo"
      aria-label="Resolution rationale and feedback"
      className="uc5-rationale-strip"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(220px, 1fr) 2fr auto',
        alignItems: 'center',
        gap: '18px',
        padding: '10px var(--sc-pane-pad)',
        borderTop: '0.5px solid var(--sc-paper-whisper)',
        background: 'var(--sc-surface-bg)',
        flexShrink: 0,
        minHeight: '44px',
      }}
    >
      {/* LEFT column — resolution identity + session */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            background: trackHue,
            borderRadius: '1px',
            flexShrink: 0,
            opacity: 0.9,
          }}
        />
        {hasResolution ? (
          <>
            <span
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--sc-ink-graphite)',
                whiteSpace: 'nowrap',
              }}
            >
              Resolved · {track}
            </span>
            {ruleIdFired && (
              <span
                title={`Rule fired: ${ruleIdFired}`}
                style={{
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.18em',
                  color: 'var(--sc-ink-fog)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                via {ruleIdFired}
              </span>
            )}
          </>
        ) : (
          <span
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '10px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--sc-ink-fog)',
            }}
          >
            Enter a brief to resolve a track
          </span>
        )}
      </div>

      {/* CENTER column — top rationale lines */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          minWidth: 0,
          overflow: 'hidden',
        }}
        aria-live="polite"
      >
        {hasResolution && rationale.length > 0 ? (
          rationale.slice(0, 2).map((line, idx) => (
            <span
              key={`${idx}-${line}`}
              title={line}
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '10px',
                letterSpacing: '0.05em',
                color: idx === 0 ? 'var(--sc-ink-stone)' : 'var(--sc-ink-fog)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {line}
            </span>
          ))
        ) : (
          <span
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: '0.18em',
              color: 'var(--sc-ink-fog)',
            }}
          >
            <span className="sc-bridge-dot" aria-hidden="true" />
            bridge
            {hostOrigin ? ` · ${new URL(hostOrigin).hostname}` : ' · unattached'}
            {canvasSessionId ? ` · session ${canvasSessionId.slice(0, 8)}` : ''}
          </span>
        )}
      </div>

      {/* RIGHT column — reward buttons */}
      <div
        role="group"
        aria-label="Resolution feedback"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
      >
        {rewardCopy && (
          <span
            role="status"
            aria-live="polite"
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color:
                rewardStatus === 'failed'
                  ? 'var(--sc-track-slide-flow)'
                  : 'var(--sc-ink-fog)',
              whiteSpace: 'nowrap',
            }}
          >
            {rewardCopy}
          </span>
        )}
        <button
          type="button"
          onClick={onThumbUp}
          disabled={!hasResolution || rewardStatus === 'submitting'}
          aria-label="Resolution was helpful"
          title="Resolution was helpful"
          style={rewardBtnStyle(hasResolution, rewardStatus === 'submitting')}
        >
          <span aria-hidden="true">&#128077;</span>
        </button>
        <button
          type="button"
          onClick={onThumbDown}
          disabled={!hasResolution || rewardStatus === 'submitting'}
          aria-label="Resolution was wrong"
          title="Resolution was wrong"
          style={rewardBtnStyle(hasResolution, rewardStatus === 'submitting')}
        >
          <span aria-hidden="true">&#128078;</span>
        </button>
      </div>
    </footer>
  );
}

function rewardBtnStyle(enabled: boolean, submitting: boolean): React.CSSProperties {
  const active = enabled && !submitting;
  return {
    fontFamily: 'var(--sc-font-mono)',
    fontSize: '14px',
    lineHeight: 1,
    color: active ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-fog)',
    background: 'transparent',
    border: '0.5px solid',
    borderColor: active ? 'var(--sc-ink-graphite)' : 'var(--sc-paper-whisper)',
    borderRadius: 'var(--sc-radius-sm)',
    padding: '4px 10px',
    cursor: active ? 'pointer' : 'not-allowed',
    opacity: active ? 1 : 0.6,
    transition: 'all var(--sc-duration-quick) var(--sc-ease-emphasized)',
  };
}
