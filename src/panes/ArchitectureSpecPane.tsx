/**
 * M5 — ArchitectureSpecPane (T5.2)
 * Renders ArchitectureBlueprint from the multi-modal SSE 'architecture' artifact.
 * Shows: blueprint name, slots table, patterns_applied chips, mermaid diagram,
 * ConsultingFramework source link.
 *
 * Data source: materializingOrder.artifacts.architecture (from M4 multi-modal wire)
 * Fallback: placeholder when no artifact ready.
 */

import { useEffect, useRef } from 'react';
import { useCanvasSession } from '../state/canvasSession';

// ── Types ────────────────────────────────────────────────────────────────────

interface ArchitectureBlueprint {
  name?: string;
  slots?: Array<{ name: string; description?: string; type?: string }>;
  patterns_applied?: string[];
  mermaid?: string;
  framework_id?: string;
  framework_url?: string;
  blueprint_id?: string;
}

// ── Mermaid renderer (dynamic script injection) ──────────────────────────────

function MermaidDiagram({ definition }: { definition: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !definition.trim()) return;

    const container = containerRef.current;
    container.innerHTML = `<pre class="mermaid">${definition}</pre>`;

    // Dynamically inject mermaid CDN if not already loaded
    const existing = document.querySelector('script[data-mermaid]');
    if (existing) {
      // @ts-expect-error mermaid is loaded via CDN script
      if (typeof window.mermaid !== 'undefined') {
        // @ts-expect-error mermaid is loaded via CDN script
        window.mermaid.run({ nodes: container.querySelectorAll('.mermaid') });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.async = true;
    script.setAttribute('data-mermaid', '1');
    script.onload = () => {
      // @ts-expect-error mermaid is loaded via CDN script
      window.mermaid?.initialize({ startOnLoad: false, theme: 'neutral' });
      // @ts-expect-error mermaid is loaded via CDN script
      window.mermaid?.run({ nodes: container.querySelectorAll('.mermaid') });
    };
    document.head.appendChild(script);
  }, [definition]);

  return (
    <div
      ref={containerRef}
      aria-label="Architecture diagram"
      style={{
        background: 'var(--sc-surface-elevated)',
        border: '0.5px solid var(--sc-paper-whisper)',
        borderRadius: 'var(--sc-radius-md)',
        padding: '16px',
        overflowX: 'auto',
        fontFamily: 'var(--sc-font-mono)',
        fontSize: '11px',
        color: 'var(--sc-ink-stone)',
        minHeight: '80px',
      }}
    />
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ width = '100%', height = '16px' }: { width?: string; height?: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        background: 'var(--sc-paper-whisper)',
        borderRadius: 'var(--sc-radius-sm)',
        animation: 'sc-pulse 1.4s ease-in-out infinite',
        marginBottom: '8px',
      }}
    />
  );
}

// ── ArchitectureSpecPane ─────────────────────────────────────────────────────

export function ArchitectureSpecPane() {
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const track = useCanvasSession((s) => s.track);
  const lastResolution = useCanvasSession((s) => s.lastResolution);
  const materializingOrder = useCanvasSession((s) => s.materializingOrder);

  const architectureArtifact = materializingOrder?.artifacts['architecture'];
  const artifactStatus = architectureArtifact?.status ?? null;
  const artifactContent = architectureArtifact?.content as ArchitectureBlueprint | undefined;

  const hasResolution = Boolean(lastResolution);

  const trackHue = track
    ? `var(--sc-track-${track.replace('_', '-')})`
    : 'var(--sc-ink-graphite)';

  return (
    <div
      className="sc-root architecture-spec-pane"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 'var(--sc-pane-pad)',
        background: 'var(--sc-surface-bg)',
        overflowY: 'auto',
      }}
    >
      {/* Pane header */}
      <div className="sc-pane-head" style={{ marginBottom: '24px' }}>
        <span className="sc-pane-label" style={{ color: trackHue }}>
          Architecture · Blueprint
        </span>
        <span className="sc-pane-meta">
          {canvasSessionId ? `session ${canvasSessionId.slice(0, 8)}` : 'no session'}
          {lastResolution?.framework_id ? ` · ${lastResolution.framework_id}` : ''}
        </span>
      </div>

      {/* No brief submitted yet */}
      {!hasResolution && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '10px',
              letterSpacing: 'var(--sc-tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--sc-ink-fog)',
            }}
          >
            Submit a brief to generate an architecture blueprint
          </span>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '32px',
              height: '32px',
              background: 'var(--sc-paper-whisper)',
              borderRadius: 'var(--sc-radius-md)',
              opacity: 0.5,
            }}
          />
        </div>
      )}

      {/* Loading skeleton while SSE streams */}
      {hasResolution && (artifactStatus === 'pending' || artifactStatus === 'streaming') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SkeletonBlock width="60%" height="20px" />
          <SkeletonBlock width="100%" height="12px" />
          <SkeletonBlock width="80%" height="12px" />
          <SkeletonBlock width="100%" height="80px" />
          <SkeletonBlock width="100%" height="120px" />
          <div
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: 'var(--sc-tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--sc-ink-fog)',
              marginTop: '4px',
            }}
          >
            {artifactStatus === 'streaming' ? 'streaming…' : 'pending…'}
          </div>
        </div>
      )}

      {/* No multi-modal order yet but resolution exists (backend route pending) */}
      {hasResolution && !materializingOrder && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Show resolution metadata as placeholder */}
          <div>
            <div
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '9px',
                letterSpacing: 'var(--sc-tracking-label)',
                textTransform: 'uppercase',
                color: 'var(--sc-ink-fog)',
                marginBottom: '6px',
              }}
            >
              Blueprint
            </div>
            <div
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '13px',
                color: 'var(--sc-ink-stone)',
              }}
            >
              {lastResolution?.blueprint_id ?? `${track ?? 'generic'}-blueprint-v1`}
            </div>
          </div>
          {lastResolution?.patterns_applied && lastResolution.patterns_applied.length > 0 && (
            <PatternChips patterns={lastResolution.patterns_applied} />
          )}
          <div
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: 'var(--sc-tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--sc-ink-fog)',
              padding: '12px',
              border: '0.5px solid var(--sc-paper-whisper)',
              borderRadius: 'var(--sc-radius-md)',
            }}
          >
            Multi-modal produce endpoint pending backend deploy — architecture diagram will render here
          </div>
        </div>
      )}

      {/* Full artifact content from SSE */}
      {hasResolution && artifactStatus === 'ready' && artifactContent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Blueprint name */}
          {artifactContent.name && (
            <div>
              <div
                style={{
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '9px',
                  letterSpacing: 'var(--sc-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--sc-ink-fog)',
                  marginBottom: '6px',
                }}
              >
                Blueprint
              </div>
              <div
                style={{
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '14px',
                  color: 'var(--sc-ink-graphite)',
                  letterSpacing: '0.02em',
                }}
              >
                {artifactContent.name}
              </div>
            </div>
          )}

          {/* Slots table */}
          {artifactContent.slots && artifactContent.slots.length > 0 && (
            <section aria-label="Blueprint slots">
              <div
                style={{
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '9px',
                  letterSpacing: 'var(--sc-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--sc-ink-fog)',
                  marginBottom: '8px',
                }}
              >
                Slots
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '10px',
                }}
              >
                <thead>
                  <tr>
                    {['Slot', 'Type', 'Description'].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        style={{
                          textAlign: 'left',
                          padding: '6px 10px',
                          borderBottom: '0.5px solid var(--sc-paper-whisper)',
                          color: 'var(--sc-ink-fog)',
                          fontWeight: 400,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          fontSize: '8px',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {artifactContent.slots.map((slot) => (
                    <tr key={slot.name}>
                      <td style={{ padding: '6px 10px', borderBottom: '0.5px solid var(--sc-paper-whisper)', color: 'var(--sc-ink-stone)' }}>
                        {slot.name}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '0.5px solid var(--sc-paper-whisper)', color: 'var(--sc-ink-fog)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {slot.type ?? '—'}
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '0.5px solid var(--sc-paper-whisper)', color: 'var(--sc-ink-stone)' }}>
                        {slot.description ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Patterns applied */}
          {artifactContent.patterns_applied && artifactContent.patterns_applied.length > 0 && (
            <PatternChips patterns={artifactContent.patterns_applied} />
          )}

          {/* Mermaid diagram */}
          {artifactContent.mermaid && (
            <section aria-label="Architecture diagram">
              <div
                style={{
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '9px',
                  letterSpacing: 'var(--sc-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--sc-ink-fog)',
                  marginBottom: '8px',
                }}
              >
                Diagram
              </div>
              <MermaidDiagram definition={artifactContent.mermaid} />
            </section>
          )}

          {/* Framework link */}
          {artifactContent.framework_id && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--sc-font-mono)',
                  fontSize: '9px',
                  letterSpacing: 'var(--sc-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--sc-ink-fog)',
                }}
              >
                Framework
              </span>
              {artifactContent.framework_url ? (
                <a
                  href={artifactContent.framework_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: 'var(--sc-font-mono)',
                    fontSize: '10px',
                    color: 'var(--sc-track-textual)',
                    textDecoration: 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  {artifactContent.framework_id}
                </a>
              ) : (
                <span
                  style={{
                    fontFamily: 'var(--sc-font-mono)',
                    fontSize: '10px',
                    color: 'var(--sc-ink-stone)',
                  }}
                >
                  {artifactContent.framework_id}
                </span>
              )}
            </div>
          )}

          {/* Artifact metadata */}
          {architectureArtifact?.content_hash && (
            <div
              style={{
                fontFamily: 'var(--sc-font-mono)',
                fontSize: '8px',
                color: 'var(--sc-ink-fog)',
                letterSpacing: '0.08em',
              }}
            >
              hash {architectureArtifact.content_hash.slice(0, 12)}
              {architectureArtifact.uri ? ` · ${architectureArtifact.uri}` : ''}
            </div>
          )}
        </div>
      )}

      {/* SSE error state */}
      {hasResolution && artifactStatus === 'error' && (
        <div
          role="alert"
          style={{
            fontFamily: 'var(--sc-font-mono)',
            fontSize: '10px',
            color: 'var(--sc-track-slide-flow)',
            letterSpacing: '0.08em',
          }}
        >
          Architecture artifact stream error — check backend logs
        </div>
      )}

      <style>{`
        @keyframes sc-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        .architecture-spec-pane a:focus-visible {
          outline: 2px solid var(--sc-focus-ring);
          outline-offset: 2px;
          border-radius: var(--sc-radius-sm);
        }
      `}</style>
    </div>
  );
}

// ── Shared sub-component ─────────────────────────────────────────────────────

function PatternChips({ patterns }: { patterns: string[] }) {
  return (
    <section aria-label="Patterns applied">
      <div
        style={{
          fontFamily: 'var(--sc-font-mono)',
          fontSize: '9px',
          letterSpacing: 'var(--sc-tracking-label)',
          textTransform: 'uppercase',
          color: 'var(--sc-ink-fog)',
          marginBottom: '8px',
        }}
      >
        Patterns applied
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {patterns.map((pattern) => (
          <span
            key={pattern}
            style={{
              fontFamily: 'var(--sc-font-mono)',
              fontSize: '9px',
              letterSpacing: '0.08em',
              color: 'var(--sc-ink-stone)',
              background: 'var(--sc-paper-deep)',
              border: '0.5px solid var(--sc-paper-whisper)',
              borderRadius: 'var(--sc-radius-sm)',
              padding: '3px 8px',
            }}
          >
            {pattern}
          </span>
        ))}
      </div>
    </section>
  );
}
