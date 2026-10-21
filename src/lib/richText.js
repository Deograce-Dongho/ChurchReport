import DOMPurify from 'dompurify'

// Fonts offered in the editor. They map to the standard PDF fonts
// (Helvetica, Times, Courier), so the PDF matches what is seen on screen.
export const FONT_OPTIONS = [
  { label: 'Sans-serif', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Serif', value: 'Georgia, Times New Roman, serif' },
  { label: 'Monospace', value: 'Courier New, monospace' },
]

// Classes that give lists and spacing back to rich text
// (Tailwind removes the default list styles).
export const richTextClass =
  '[&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5'

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Accepts HTML (new reports) or plain text (reports saved before the
// editor existed) and always returns HTML.
export function toHtml(value) {
  const text = value ?? ''

  if (!text.trim()) return ''
  if (/^\s*<(p|ul|ol)[\s>]/i.test(text)) return text

  return text
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

// Remove everything that is not basic formatting
export function sanitizeHtml(html) {
  return DOMPurify.sanitize(toHtml(html), {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['style'],
  })
}

// True when the rich text contains at least one visible character
export function hasText(html) {
  return (
    DOMPurify.sanitize(toHtml(html), { ALLOWED_TAGS: [] }).trim().length > 0
  )
}