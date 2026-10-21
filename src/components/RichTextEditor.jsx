import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextStyle from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'

import { FONT_OPTIONS, richTextClass, toHtml } from '../lib/richText'

function ToolButton({ label, active = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keeps the text selection while clicking a tool
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 ${
        active
          ? 'bg-brand-900 text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = '',
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
      }),
      Underline,
      TextStyle,
      FontFamily,
    ],
    content: toHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        id: id ?? '',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Key points',
        'data-placeholder': placeholder,
        class: `min-h-40 px-4 py-3 text-base text-gray-800 outline-none sm:text-sm ${richTextClass}`,
      },
    },
    onUpdate: ({ editor: current }) => {
      // An empty editor is saved as an empty string, not "<p></p>"
      onChange(current.isEmpty ? '' : current.getHTML())
    },
  })

  // The parent changes the value when another date is loaded
  useEffect(() => {
    if (!editor) return

    const next = toHtml(value)
    const current = editor.isEmpty ? '' : editor.getHTML()

    if (next !== current) editor.commands.setContent(next, false)
  }, [value, editor])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  if (!editor) return null

  const currentFont = editor.getAttributes('textStyle').fontFamily ?? ''

  return (
    <div
      className={`overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-brand-600 ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-1"
      >
        <select
          value={currentFont}
          disabled={disabled}
          aria-label="Font"
          onChange={(event) => {
            const font = event.target.value
            const chain = editor.chain().focus()

            if (font) chain.setFontFamily(font).run()
            else chain.unsetFontFamily().run()
          }}
          className="min-h-11 rounded-lg border border-gray-200 bg-white px-2 text-base text-gray-800 outline-none focus:border-brand-600 disabled:opacity-60 sm:min-h-9 sm:text-sm"
        >
          <option value="">Default font</option>
          {FONT_OPTIONS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        <ToolButton
          label="Bold"
          active={editor.isActive('bold')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </ToolButton>

        <ToolButton
          label="Italic"
          active={editor.isActive('italic')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </ToolButton>

        <ToolButton
          label="Underline"
          active={editor.isActive('underline')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={16} />
        </ToolButton>

        <ToolButton
          label="Bulleted list"
          active={editor.isActive('bulletList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </ToolButton>

        <ToolButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </ToolButton>

        <ToolButton
          label="Clear formatting"
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          <RemoveFormatting size={16} />
        </ToolButton>

        <ToolButton
          label="Undo"
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </ToolButton>

        <ToolButton
          label="Redo"
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </ToolButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}