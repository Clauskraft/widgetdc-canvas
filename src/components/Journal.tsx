import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useCanvasStore } from '../store/canvasStore';

interface JournalProps {
  isVisible: boolean;
  onFlip: () => void;
}

export function Journal({ isVisible, onFlip }: JournalProps) {
  const { addNodeWithData } = useCanvasStore();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start typing... Any text can become a node on the canvas.',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none min-h-screen pt-12 pb-40 text-slate-800 font-serif',
      },
    },
  });

  const sendToCanvas = () => {
    if (!editor) return;
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    );

    if (selectedText) {
      // Create a node on the canvas from this text
      addNodeWithData('insight', {
        label: selectedText.slice(0, 50) + (selectedText.length > 50 ? '...' : ''),
        subtitle: selectedText,
        nodeType: 'insight',
        provenance: {
          createdBy: 'manual',
          createdAt: new Date().toISOString(),
          source: 'Journal Extraction'
        }
      });

      editor.commands.toggleBold(); // Visual feedback for now
      onFlip(); // Flip back to canvas to see the new node
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{ 
        opacity: isVisible ? 1 : 0,
        rotateY: isVisible ? 0 : -180,
        pointerEvents: isVisible ? 'auto' : 'none',
        zIndex: isVisible ? 40 : -1
      }}
      transition={{ duration: 0.8, type: 'spring', bounce: 0.2 }}
      className="absolute inset-0 bg-[#Fdfcfaf0] overflow-y-auto backdrop-blur-3xl"
      style={{ backfaceVisibility: 'hidden', transformStyle: 'preserve-3d' }}
    >
      <div className="max-w-3xl mx-auto px-12 relative h-full">
        {/* Date Header */}
        <div className="pt-24 pb-8 flex justify-between items-end">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-tdc-400 mb-4">Daily Notes</p>
            <h1 className="text-5xl font-serif text-slate-900 tracking-tight">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h1>
          </div>
          <button
            onClick={sendToCanvas}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-full shadow-lg hover:bg-tdc-500 transition-colors text-xs font-bold tracking-wide uppercase mb-2"
            title="Extract selected text to Canvas"
          >
            <Sparkles size={14} className="text-amber-300" />
            Send to Canvas
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Editor Area */}
        <div className="mt-4">
          <EditorContent editor={editor} />
        </div>
      </div>
    </motion.div>
  );
}
