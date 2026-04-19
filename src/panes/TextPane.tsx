/**
 * UC5 — TextPane
 * Markdown editor pane backed by a per-session Y.Doc CRDT.
 * Uses Tiptap (already in package.json) as the rich-text engine.
 * Matches substrate-cartography visual spec: paper bg, IBM Plex typography.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useCanvasSession } from '../state/canvasSession';
import { emitToHost } from '../bridge/hostBridge';

// ── Toolbar ──────────────────────────────────────────────────────────────────

interface ToolbarProps {
  onBold: () => void;
  onItalic: () => void;
  onHeading: (level: 1 | 2 | 3) => void;
  onCode: () => void;
  isBold: boolean;
  isItalic: boolean;
  isCode: boolean;
}

function TextToolbar({ onBold, onItalic, onHeading, onCode, isBold, isItalic, isCode }: ToolbarProps) {
  const btn = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        fontFamily: 'var(--sc-font-mono)',
        fontSize: '9px',
        letterSpacing: 'var(--sc-tracking-label)',
        textTransform: 'uppercase',
        color: active ? 'var(--sc-ink-graphite)' : 'var(--sc-ink-fog)',
        background: 'transparent',
        border: '0.5px solid',
        borderColor: active ? 'var(--sc-ink-graphite)' : 'transparent',
        borderRadius: 'var(--sc-radius-sm)',
        padding: '3px 8px',
        cursor: 'pointer',
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
        gap: '4px',
        padding: '8px 0',
        borderBottom: 'var(--sc-rule-thin) solid var(--sc-paper-whisper)',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}
      role="toolbar"
      aria-label="Text formatting"
    >
      {btn('B', isBold, onBold)}
      {btn('I', isItalic, onItalic)}
      {btn('H1', false, () => onHeading(1))}
      {btn('H2', false, () => onHeading(2))}
      {btn('H3', false, () => onHeading(3))}
      {btn('Code', isCode, onCode)}
    </div>
  );
}

// ── TextPane ─────────────────────────────────────────────────────────────────

export function TextPane() {
  // FIX (P0): individual selectors — a single object selector returns a new
  // object reference on every store update, which Zustand's default equality
  // check treats as a change → infinite re-render loop (Maximum update depth).
  const canvasSessionId = useCanvasSession((s) => s.canvasSessionId);
  const track = useCanvasSession((s) => s.track);
  const paneState = useCanvasSession((s) => s.panes.markdown);
  const setContent = useCanvasSession((s) => s.setContent);

  const emitRef = useRef(false);

  // Mirror content changes into the Y.Doc via store
  const handleUpdate = useCallback(
    (html: string) => {
      setContent('markdown', html);
      if (!emitRef.current) {
        emitRef.current = true;
        emitToHost({
          type: 'userEdit',
          sessionId: canvasSessionId,
          activePane: 'markdown',
          timestamp: new Date().toISOString(),
        });
        // Debounce: allow next emit after 500ms
        setTimeout(() => { emitRef.current = false; }, 500);
      }
    },
    [canvasSessionId, setContent],
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing… the substrate listens.',
      }),
    ],
    content: typeof paneState.content === 'string' ? paneState.content : '',
    onUpdate: ({ editor: ed }) => {
      handleUpdate(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'sc-text-editor',
        style: [
          'font-family:var(--sc-font-sans)',
          'font-size:13px',
          'line-height:1.7',
          'color:var(--sc-ink-stone)',
          'min-height:200px',
          'outline:none',
        ].join(';'),
      },
    },
  });

  // Sync pre-seeded content from Y.Doc on mount.
  // FIX (P1 / SECURITY): label and data values from the wire must be HTML-escaped
  // before being passed to setContent() — Tiptap parses the string as HTML, so
  // raw label values containing "<script>" or onerror handlers would be executed
  // immediately in the editor's document context (stored XSS).
  useEffect(() => {
    if (!editor) return;
    const doc = paneState.crdtDoc;
    const arr = doc.getArray<{ label?: string; data?: Record<string, unknown> }>('nodes');
    if (arr.length > 0) {
      const escapeHtml = (s: string): string =>
        s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const html = arr
        .toArray()
        .map((n) => {
          const label = escapeHtml(n.label ?? 'Node');
          const data = escapeHtml(JSON.stringify(n.data ?? {}, null, 2));
          return `<h2>${label}</h2><pre>${data}</pre>`;
        })
        .join('<hr/>');
      editor.commands.setContent(html);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const trackHue = track ? `var(--sc-track-${track.replace('_', '-')})` : 'var(--sc-ink-graphite)';

  return (
    <div
      className="sc-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 'var(--sc-pane-pad)',
        background: 'var(--sc-surface-bg)',
      }}
    >
      {/* Pane header */}
      <div className="sc-pane-head">
        <span className="sc-pane-label" style={{ color: trackHue }}>
          Markdown · TextPane
        </span>
        <span className="sc-pane-meta">
          {canvasSessionId ? `session ${canvasSessionId.slice(0, 8)}` : 'no session'}
        </span>
      </div>

      {/* Formatting toolbar */}
      {editor && (
        <TextToolbar
          onBold={() => editor.chain().focus().toggleBold().run()}
          onItalic={() => editor.chain().focus().toggleItalic().run()}
          onHeading={(level) => editor.chain().focus().toggleHeading({ level }).run()}
          onCode={() => editor.chain().focus().toggleCode().run()}
          isBold={editor.isActive('bold')}
          isItalic={editor.isActive('italic')}
          isCode={editor.isActive('code')}
        />
      )}

      {/* Editor surface */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: '12px',
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
