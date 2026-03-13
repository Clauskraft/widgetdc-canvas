import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Tablet, RefreshCcw } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';
import { syncRemarkableNotes } from '../lib/connectors';
import { useState } from 'react';

interface JournalProps {
  isVisible: boolean;
  onFlip: () => void;
}

export function Journal({ isVisible, onFlip }: JournalProps) {
  const { addNodeWithData } = useCanvasStore();
  const [isSyncing, setIsSyncing] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start typing... Your notes are the foundation of your strategy.',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: `<h2>Meeting Notes — LEGO Strategy</h2><p>Focus on supply chain transparency and circular economy. Mentioned Billund facilities as testbed.</p>`,
    editorProps: {
      attributes: {
        class: 'prose prose-slate prose-lg max-w-none focus:outline-none min-h-[60vh] text-slate-900 font-serif',
      },
    },
  });

  const handleSyncRemarkable = async () => {
    setIsSyncing(true);
    const notes = await syncRemarkableNotes();
    if (editor && notes.length > 0) {
      notes.forEach(n => {
        editor.commands.insertContent(`<blockquote>${n.text}</blockquote><p></p>`);
      });
    }
    setTimeout(() => setIsSyncing(false), 800);
  };

  const sendToCanvas = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (selectedText && selectedText.length > 3) {
      addNodeWithData('insight', {
        label: selectedText.slice(0, 60) + (selectedText.length > 60 ? '...' : ''),
        subtitle: selectedText,
        nodeType: 'insight',
        provenance: {
          createdBy: 'manual',
          createdAt: new Date().toISOString(),
          source: 'Journal Extraction'
        }
      });

      editor.commands.setBold();
      onFlip();
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{ 
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 bg-[#f8f9fa] overflow-y-auto"
      style={{ 
        backfaceVisibility: 'hidden', 
        transform: 'rotateY(180deg)',
        transformStyle: 'preserve-3d',
        zIndex: isVisible ? 50 : -1
      }}
    >
      <div className="max-w-4xl mx-auto px-16 py-20 min-h-screen bg-white shadow-2xl border-x border-slate-200/50">
        {/* Header */}
        <div className="mb-12 flex justify-between items-start border-b border-slate-100 pb-8">
          <div>
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-tdc-500 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tdc-500 animate-pulse" />
              Agentic Journal
              {isSyncing && <RefreshCcw size={12} className="animate-spin text-slate-400" />}
            </p>
            <h1 className="text-5xl font-serif text-slate-900 tracking-tight">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h1>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleSyncRemarkable}
              disabled={isSyncing}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 text-slate-600 rounded-full border border-slate-200 hover:bg-slate-100 transition-all text-[11px] font-bold uppercase tracking-wider"
            >
              <Tablet size={14} className={isSyncing ? 'animate-bounce' : ''} />
              Sync reMarkable
            </button>
            <button
              onClick={sendToCanvas}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-full shadow-xl hover:bg-tdc-600 transition-all text-[11px] font-bold uppercase tracking-wider active:scale-95"
            >
              <Sparkles size={14} className="text-amber-400" />
              Send to Canvas
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="relative">
          <EditorContent editor={editor} />
        </div>
        
        {/* Footer info */}
        <div className="mt-20 pt-8 border-t border-slate-50 text-center">
          <p className="text-[10px] text-slate-300 uppercase tracking-widest font-medium">
            Shift + Click to flip back • All changes are persisted locally
          </p>
        </div>
      </div>
    </motion.div>
  );
}
