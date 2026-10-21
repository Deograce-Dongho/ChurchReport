import { sanitizeHtml } from '../richText'
import { PAGE, COLORS, contentWidth, ensureSpace, pdfText } from './kit'

const BASE_SIZE = 10
const LINE_HEIGHT = 5 // mm
const INDENT = 6 // mm per list level

const DEFAULT_STYLE = {
  family: 'helvetica',
  bold: false,
  italic: false,
  underline: false,
}

// The editor fonts map to the three standard PDF families.
// "sans" is tested first because "sans-serif" contains "serif".
function pdfFamily(fontFamily = '') {
  const value = fontFamily.toLowerCase()

  if (value.includes('courier') || value.includes('monospace')) return 'courier'
  if (value.includes('sans')) return 'helvetica'
  if (
    value.includes('georgia') ||
    value.includes('times') ||
    value.includes('serif')
  ) {
    return 'times'
  }

  return 'helvetica'
}

function fontStyle({ bold, italic }) {
  if (bold && italic) return 'bolditalic'
  if (bold) return 'bold'
  if (italic) return 'italic'
  return 'normal'
}

// Collect the text pieces of a node, each with its formatting.
// Nested lists are skipped here: parseBlocks handles them.
function collectRuns(node, style, runs) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      runs.push({ ...style, text: child.textContent })
      return
    }

    if (child.nodeType !== 1) return

    const tag = child.tagName.toLowerCase()

    if (tag === 'br') {
      runs.push({ lineBreak: true })
      return
    }

    if (tag === 'ul' || tag === 'ol') return

    const next = { ...style }

    if (tag === 'strong' || tag === 'b') next.bold = true
    if (tag === 'em' || tag === 'i') next.italic = true
    if (tag === 'u') next.underline = true
    if (tag === 'span' && child.style.fontFamily) {
      next.family = pdfFamily(child.style.fontFamily)
    }

    collectRuns(child, next, runs)
  })
}

// HTML -> flat list of blocks: { runs, depth, marker }
// marker is null (paragraph), 'bullet', or a number label such as '1.'
function parseBlocks(html) {
  const parsed = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html')
  const blocks = []

  function walkList(list, depth) {
    const ordered = list.tagName.toLowerCase() === 'ol'
    let number = 0

    Array.from(list.children).forEach((item) => {
      if (item.tagName.toLowerCase() !== 'li') return

      number += 1

      const runs = []
      collectRuns(item, DEFAULT_STYLE, runs)

      blocks.push({
        runs,
        depth,
        marker: ordered ? `${number}.` : 'bullet',
      })

      Array.from(item.children).forEach((child) => {
        const tag = child.tagName.toLowerCase()
        if (tag === 'ul' || tag === 'ol') walkList(child, depth + 1)
      })
    })
  }

  Array.from(parsed.body.children).forEach((element) => {
    const tag = element.tagName.toLowerCase()

    if (tag === 'ul' || tag === 'ol') {
      walkList(element, 0)
      return
    }

    const runs = []
    collectRuns(element, DEFAULT_STYLE, runs)
    blocks.push({ runs, depth: 0, marker: null })
  })

  return blocks
}

// Word wrap: returns lines, each line is a list of drawable segments.
// The font size must already be set on the document.
function layoutLines(doc, runs, width) {
  const lines = [[]]
  let x = 0

  function newLine() {
    lines.push([])
    x = 0
  }

  for (const run of runs) {
    if (run.lineBreak) {
      newLine()
      continue
    }

    const style = fontStyle(run)
    doc.setFont(run.family, style)

    const tokens =
      pdfText(run.text).replace(/\s+/g, ' ').match(/ |[^ ]+/g) ?? []

    for (const token of tokens) {
      const tokenWidth = doc.getTextWidth(token)

      if (token === ' ') {
        if (x === 0) continue
        if (x + tokenWidth > width) {
          newLine()
          continue
        }
      } else if (x > 0 && x + tokenWidth > width) {
        newLine()
      }

      // A single word wider than the line is cut into pieces
      if (tokenWidth > width) {
        for (const piece of doc.splitTextToSize(token, width)) {
          if (x > 0) newLine()

          const pieceWidth = doc.getTextWidth(piece)
          lines[lines.length - 1].push({
            text: piece,
            family: run.family,
            style,
            underline: run.underline,
            width: pieceWidth,
          })
          x = pieceWidth
        }
        continue
      }

      lines[lines.length - 1].push({
        text: token,
        family: run.family,
        style,
        underline: run.underline,
        width: tokenWidth,
      })
      x += tokenWidth
    }
  }

  while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop()

  return lines
}

// Draws formatted text from `y` (top) and returns the y below it.
export function drawRichText(doc, y, html, options = {}) {
  const { fontSize = BASE_SIZE, lineHeight = LINE_HEIGHT } = options
  const left = PAGE.margin
  const fullWidth = contentWidth(doc)

  for (const block of parseBlocks(html)) {
    doc.setFontSize(fontSize)

    const indent = block.marker ? (block.depth + 1) * INDENT : 0
    const lines = layoutLines(doc, block.runs, fullWidth - indent)
    const empty = lines.every((line) => line.length === 0)

    // Empty paragraph: just a small gap
    if (empty) {
      y = ensureSpace(doc, y, lineHeight)
      y += lineHeight * 0.6
      continue
    }

    lines.forEach((line, index) => {
      y = ensureSpace(doc, y, lineHeight)

      const baseline = y + 3.6

      doc.setTextColor(...COLORS.text)
      doc.setDrawColor(...COLORS.text)

      // List marker on the first line of an item
      if (index === 0 && block.marker === 'bullet') {
        doc.setFillColor(...COLORS.text)
        doc.circle(left + indent - 3, baseline - 1.2, 0.55, 'F')
      } else if (index === 0 && block.marker) {
        doc.setFont('helvetica', 'normal')
        doc.text(block.marker, left + indent - 1.5, baseline, {
          align: 'right',
        })
      }

      let x = left + indent

      for (const segment of line) {
        doc.setFont(segment.family, segment.style)
        doc.text(segment.text, x, baseline)

        if (segment.underline && segment.text.trim()) {
          doc.setLineWidth(0.2)
          doc.line(x, baseline + 0.7, x + segment.width, baseline + 0.7)
        }

        x += segment.width
      }

      y += lineHeight
    })

    y += block.marker ? 0.5 : 1.2
  }

  return y + 1
}