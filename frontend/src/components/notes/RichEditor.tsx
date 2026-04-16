import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/react';
import { Bold, Code, Heading2, Italic, List, ListOrdered, Redo, Undo } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}

export function RichEditor({ content, onChange, placeholder, readOnly, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? 'Write something...' }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      {!readOnly ? (
        <div className="flex flex-wrap gap-1 border-b border-codex-border px-2 py-1.5">
          {[
            {
              icon: <Bold size={13} />,
              action: () => editor.chain().focus().toggleBold().run(),
              active: editor.isActive('bold'),
              title: 'Bold',
            },
            {
              icon: <Italic size={13} />,
              action: () => editor.chain().focus().toggleItalic().run(),
              active: editor.isActive('italic'),
              title: 'Italic',
            },
            {
              icon: <Heading2 size={13} />,
              action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
              active: editor.isActive('heading', { level: 2 }),
              title: 'Heading',
            },
            {
              icon: <List size={13} />,
              action: () => editor.chain().focus().toggleBulletList().run(),
              active: editor.isActive('bulletList'),
              title: 'Bullet list',
            },
            {
              icon: <ListOrdered size={13} />,
              action: () => editor.chain().focus().toggleOrderedList().run(),
              active: editor.isActive('orderedList'),
              title: 'Numbered list',
            },
            {
              icon: <Code size={13} />,
              action: () => editor.chain().focus().toggleCode().run(),
              active: editor.isActive('code'),
              title: 'Inline code',
            },
          ].map((btn) => (
            <button
              key={btn.title}
              type="button"
              title={btn.title}
              onClick={btn.action}
              className={`rounded p-1.5 transition-colors ${
                btn.active
                  ? 'bg-codex-accent/20 text-codex-accent'
                  : 'text-codex-muted hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {btn.icon}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            <button
              type="button"
              title="Undo"
              onClick={() => editor.chain().focus().undo().run()}
              className="rounded p-1.5 text-codex-muted hover:bg-white/5 hover:text-slate-200"
            >
              <Undo size={13} />
            </button>
            <button
              type="button"
              title="Redo"
              onClick={() => editor.chain().focus().redo().run()}
              className="rounded p-1.5 text-codex-muted hover:bg-white/5 hover:text-slate-200"
            >
              <Redo size={13} />
            </button>
          </div>
        </div>
      ) : null}
      <EditorContent
        editor={editor}
        className="prose prose-invert prose-sm max-w-none flex-1 overflow-y-auto px-4 py-3 text-slate-200 focus:outline-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-600 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror-focused_p.is-editor-empty:first-child::before]:opacity-0"
      />
    </div>
  );
}
