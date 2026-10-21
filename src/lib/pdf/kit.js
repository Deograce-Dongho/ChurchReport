// Building blocks shared by every PDF report.
//
// The PDFs are written as real text (jsPDF + jspdf-autotable): the text can
// be selected, searched and copied, the file stays small, and the tables
// repeat their header on every page. Only the logo is an image.
//
// jsPDF and the logo are heavy, so this module (and the report modules that
// import it) must be loaded on demand: `await import('../lib/pdf/membersPdf')`.

import logoDataUrl from '../../assets/logo.jpg?inline'

// Set VITE_CHURCH_NAME in .env (and in Vercel) to print your church name.
export const CHURCH_NAME = import.meta.env.VITE_CHURCH_NAME || 'Church Name'

// RGB triplets (jsPDF does not read CSS colors)
export const COLORS = {
  ink: [20, 45, 78], // #142D4E
  primary: [2, 92, 162], // #025CA2
  soft: [219, 234, 254], // #DBEAFE
  pale: [247, 249, 252], // #F7F9FC
  text: [30, 41, 59], // slate-800
  muted: [100, 116, 139], // slate-500
  line: [203, 213, 225], // slate-300
  white: [255, 255, 255],
}

// A4, millimetres
export const PAGE = {
  margin: 14,
  runningTop: 22, // where content starts on pages 2, 3, ...
  bottom: 18, // space kept free for the footer
}

const LOGO_SIZE = 22

// The standard PDF fonts only know Latin-1 and a few Windows-1252 symbols.
// Keep what they can draw, fall back to the base letter (ś -> s) and then
// to "?", so a name never turns into garbage.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

// Letters that have no accent to strip but a plain look-alike
const LOOK_ALIKES = { ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ħ: 'h', Ħ: 'H', ı: 'i' }

export function pdfText(value) {
  const text = String(value ?? '').replace(/[\u00A0\u2007\u2009\u202F]/g, ' ')
  let output = ''

  for (const char of text) {
    const code = char.codePointAt(0)

    if (code <= 0xff || WIN_ANSI_EXTRA.has(char)) {
      output += char
      continue
    }

    const base =
      LOOK_ALIKES[char] ?? char.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    output += base !== char && base.charCodeAt(0) <= 0xff ? base : '?'
  }

  return output
}

// jsPDF and the table plugin, loaded only when a PDF is requested
export async function loadPdfLibs() {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  return { jsPDF, autoTable }
}

export function createDocument(jsPDF, { title }) {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  })

  doc.setProperties({
    title: pdfText(title),
    author: pdfText(CHURCH_NAME),
    creator: 'ChurchReport',
  })

  return doc
}

function pageSize(doc) {
  return {
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
  }
}

export function contentWidth(doc) {
  return pageSize(doc).width - PAGE.margin * 2
}

// Logo, church name, report title and a few detail lines.
// Returns the y position where the content can start.
export function drawHeader(doc, { title, lines = [] }) {
  const { width } = pageSize(doc)
  const left = PAGE.margin
  const textX = left + LOGO_SIZE + 5
  const textWidth = width - PAGE.margin - textX

  doc.addImage(logoDataUrl, 'JPEG', left, PAGE.margin - 2, LOGO_SIZE, LOGO_SIZE)

  let y = PAGE.margin + 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...COLORS.ink)
  doc.text(doc.splitTextToSize(pdfText(CHURCH_NAME), textWidth), textX, y)
  y += 6.5

  doc.setFontSize(12)
  doc.setTextColor(...COLORS.primary)
  doc.text(pdfText(title), textX, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)

  for (const line of lines.filter(Boolean)) {
    const wrapped = doc.splitTextToSize(pdfText(line), textWidth)
    doc.text(wrapped, textX, y)
    y += wrapped.length * 3.9
  }

  const bottom = Math.max(y, PAGE.margin - 2 + LOGO_SIZE) + 2

  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.6)
  doc.line(left, bottom, width - PAGE.margin, bottom)

  return bottom + 7
}

// Running header (pages 2+) and footer (all pages): church name, title,
// generation date and "Page x / y". Call once, when the content is finished.
export function finishDocument(doc, { title, generatedOn }) {
  const { width, height } = pageSize(doc)
  const total = doc.getNumberOfPages()

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page)

    if (page > 1) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.ink)
      doc.text(pdfText(CHURCH_NAME), PAGE.margin, 12)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.muted)
      doc.text(pdfText(title), width - PAGE.margin, 12, { align: 'right' })

      doc.setDrawColor(...COLORS.line)
      doc.setLineWidth(0.3)
      doc.line(PAGE.margin, 15, width - PAGE.margin, 15)
    }

    doc.setDrawColor(...COLORS.line)
    doc.setLineWidth(0.3)
    doc.line(PAGE.margin, height - 13, width - PAGE.margin, height - 13)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...COLORS.muted)
    doc.text(pdfText(`Generated on ${generatedOn}`), PAGE.margin, height - 8)
    doc.text(`Page ${page} / ${total}`, width - PAGE.margin, height - 8, {
      align: 'right',
    })
  }
}

// Starts a new page when fewer than `needed` mm are left. Returns the new y.
export function ensureSpace(doc, y, needed) {
  const { height } = pageSize(doc)

  if (y + needed <= height - PAGE.bottom) return y

  doc.addPage()
  return PAGE.runningTop
}

export function drawSectionTitle(doc, y, text) {
  const top = ensureSpace(doc, y, 22)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLORS.ink)
  doc.text(pdfText(text), PAGE.margin, top)

  return top + 3
}

// A paragraph that may run over several pages. Returns the new y.
export function drawParagraph(doc, y, text, { fontSize = 9.5 } = {}) {
  const { height } = pageSize(doc)
  const lineHeight = fontSize * 0.3528 * 1.4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fontSize)
  doc.setTextColor(...COLORS.text)

  let cursor = y + lineHeight

  for (const line of doc.splitTextToSize(pdfText(text), contentWidth(doc))) {
    if (cursor > height - PAGE.bottom) {
      doc.addPage()
      cursor = PAGE.runningTop + lineHeight
    }

    doc.text(line, PAGE.margin, cursor)
    cursor += lineHeight
  }

  return cursor - lineHeight + 2
}

// Options shared by every table
export function baseTable(extra = {}) {
  return {
    theme: 'striped',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    margin: {
      top: PAGE.runningTop,
      right: PAGE.margin,
      bottom: PAGE.bottom,
      left: PAGE.margin,
    },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      textColor: COLORS.text,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: COLORS.ink,
      textColor: COLORS.white,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: COLORS.pale },
    footStyles: {
      fillColor: COLORS.soft,
      textColor: COLORS.ink,
      fontStyle: 'bold',
    },
    ...extra,
  }
}

// Label / value lines (no header). Returns the y below the table.
export function drawKeyValues(doc, autoTable, y, rows) {
  autoTable(doc, {
    ...baseTable(),
    theme: 'plain',
    startY: y,
    body: rows.map(([label, value]) => [pdfText(label), pdfText(value)]),
    showHead: 'never',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: { top: 1.3, right: 2, bottom: 1.3, left: 0 },
      textColor: COLORS.text,
      overflow: 'linebreak',
      valign: 'top',
    },
    alternateRowStyles: {},
    columnStyles: {
      0: { cellWidth: 44, textColor: COLORS.muted },
      1: { cellWidth: contentWidth(doc) - 44 },
    },
  })

  return doc.lastAutoTable.finalY + 4
}
