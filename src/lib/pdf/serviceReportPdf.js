import {
  PAGE,
  COLORS,
  baseTable,
  contentWidth,
  createDocument,
  drawHeader,
  drawKeyValues,
  drawParagraph,
  ensureSpace,
  finishDocument,
  loadPdfLibs,
  pdfText,
} from './kit'
import { drawRichText } from './richTextPdf'
import { hasText } from '../richText'

// Replace with your brand-900 / brand-50 as [r, g, b] arrays if needed.
const SERMON_COLOR = COLORS.brand ?? [30, 58, 138]
const HEADING_BG = [219, 234, 254]

// Section heading: tinted band, coloured bar, bold capitals.
// It is clearly different from the body text, even when that text is bold.
function drawSectionHeading(doc, y, text) {
  const height = 7

  // Keep some room below, so a heading is never alone at the page bottom
  y = ensureSpace(doc, y, height + 20)

  doc.setFillColor(...HEADING_BG)
  doc.rect(PAGE.margin, y, contentWidth(doc), height, 'F')

  doc.setFillColor(...SERMON_COLOR)
  doc.rect(PAGE.margin, y, 1.5, height, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...SERMON_COLOR)
  doc.text(text.toUpperCase(), PAGE.margin + 5, y + 4.8, { charSpace: 0.4 })

  doc.setTextColor(...COLORS.text)

  return y + height + 3
}

// The sermon title stands out: coloured bar, small label, large serif title.
function drawSermonTitle(doc, y, sermonTitle) {
  const left = PAGE.margin
  const textX = left + 5
  const lineHeight = 8

  doc.setFont('times', 'bold')
  doc.setFontSize(18)

  const lines = doc.splitTextToSize(
    pdfText(sermonTitle || 'Not specified'),
    contentWidth(doc) - 5
  )

  const height = 5 + lines.length * lineHeight

  y = ensureSpace(doc, y + 2, height + 3)

  doc.setFillColor(...SERMON_COLOR)
  doc.rect(left, y, 1.2, height, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text('SERMON TITLE', textX, y + 3, { charSpace: 0.4 })

  doc.setFont('times', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...SERMON_COLOR)

  lines.forEach((line, index) => {
    doc.text(line, textX, y + 10 + index * lineHeight)
  })

  doc.setTextColor(...COLORS.text)

  return y + height + 4
}

// Builds the PDF of one Sunday service report.
//   dateLong, preacher, sermonTitle, keyPoints : the service information
//   (keyPoints is HTML from the rich text editor, or old plain text)
//   summary     : { total, inPerson, online, members, visitors }
//   memberRows / visitorRows : [{ name, presenceType }], already sorted
//   include     : { keyPoints, summary, members, visitors } (all true by default)
//   generatedOn : formatted date
export async function buildServiceReportPdf({
  dateLong,
  preacher,
  sermonTitle,
  keyPoints,
  summary,
  memberRows,
  visitorRows,
  include = {},
  generatedOn,
}) {
  const showKeyPoints = include.keyPoints !== false
  const showSummary = include.summary !== false
  const showMembers = include.members !== false
  const showVisitors = include.visitors !== false

  const { jsPDF, autoTable } = await loadPdfLibs()
  const title = 'Sunday Service Report'
  const doc = createDocument(jsPDF, { title })

  let y = drawHeader(doc, { title, lines: [dateLong] })

  y = drawSermonTitle(doc, y, sermonTitle)

  y = drawSectionHeading(doc, y + 2, 'Service information')
  y = drawKeyValues(doc, autoTable, y, [
    ['Date', dateLong],
    ['Preacher', preacher || 'Not specified'],
  ])

  if (showKeyPoints) {
    y = drawSectionHeading(doc, y + 4, 'Sermon key points')
    y = hasText(keyPoints)
      ? drawRichText(doc, y, keyPoints)
      : drawParagraph(doc, y, 'No key points recorded.')
  }

  if (showSummary) {
    y = drawSectionHeading(doc, y + 4, 'Attendance summary')
    y = drawKeyValues(doc, autoTable, y, [
      ['Total', String(summary.total)],
      ['In person', String(summary.inPerson)],
      ['Online', String(summary.online)],
      ['Members', String(summary.members)],
      ['Visitors', String(summary.visitors)],
    ])
  }

  if (showMembers || showVisitors) {
    y = drawSectionHeading(doc, y + 4, 'Attendance list')

    if (memberRows.length + visitorRows.length === 0) {
      y = drawParagraph(doc, y, 'No attendance recorded for this service.')
    }

    const lists = []
    if (showMembers) lists.push(['Members', memberRows])
    if (showVisitors) lists.push(['Visitors', visitorRows])

    for (const [label, rows] of lists) {
      if (rows.length === 0) continue

      y = ensureSpace(doc, y + 2, 30)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.text)
      doc.text(`${label} (${rows.length})`, PAGE.margin, y + 4)

      const width = contentWidth(doc)

      autoTable(doc, {
        ...baseTable(),
        startY: y + 6,
        head: [['#', 'Name', 'Attendance type']],
        body: rows.map((row, index) => [
          String(index + 1),
          pdfText(row.name),
          pdfText(row.presenceType || 'Unknown'),
        ]),
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: width - 12 - 42 },
          2: { cellWidth: 42 },
        },
      })

      y = doc.lastAutoTable.finalY + 4
    }
  }

  // Signature line, kept together on one page
  y = ensureSpace(doc, y + 10, 30)

  const right = PAGE.margin + contentWidth(doc)

  doc.setDrawColor(...COLORS.muted)
  doc.setLineWidth(0.3)
  doc.line(right - 62, y + 14, right, y + 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLORS.muted)
  doc.text("Secretary's signature", right, y + 19, { align: 'right' })

  finishDocument(doc, { title, generatedOn })

  return doc
}