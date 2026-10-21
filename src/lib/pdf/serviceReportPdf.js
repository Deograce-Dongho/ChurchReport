import {
  PAGE,
  COLORS,
  baseTable,
  contentWidth,
  createDocument,
  drawHeader,
  drawKeyValues,
  drawParagraph,
  drawSectionTitle,
  ensureSpace,
  finishDocument,
  loadPdfLibs,
  pdfText,
} from './kit'
import { drawRichText } from './richTextPdf'
import { hasText } from '../richText'

// Colour of the sermon title. If kit.js defines a brand colour, it is used;
// otherwise this blue. Replace it with your brand-900 as an [r, g, b] array.
const SERMON_COLOR = COLORS.brand ?? [30, 58, 138]

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
  doc.text('SERMON', textX, y + 3)

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
//   generatedOn : formatted date
export async function buildServiceReportPdf({
  dateLong,
  preacher,
  sermonTitle,
  keyPoints,
  summary,
  memberRows,
  visitorRows,
  generatedOn,
}) {
  const { jsPDF, autoTable } = await loadPdfLibs()
  const title = 'Sunday Service Report'
  const doc = createDocument(jsPDF, { title })

  let y = drawHeader(doc, { title, lines: [dateLong] })

  y = drawSermonTitle(doc, y, sermonTitle)

  y = drawSectionTitle(doc, y, 'Service information')
  y = drawKeyValues(doc, autoTable, y, [
    ['Date', dateLong],
    ['Preacher', preacher || 'Not specified'],
  ])

  y = drawSectionTitle(doc, y + 3, 'Sermon key points')
  y = hasText(keyPoints)
    ? drawRichText(doc, y, keyPoints)
    : drawParagraph(doc, y, 'No key points recorded.')

  y = drawSectionTitle(doc, y + 5, 'Attendance summary')
  y = drawKeyValues(doc, autoTable, y, [
    ['Total', String(summary.total)],
    ['In person', String(summary.inPerson)],
    ['Online', String(summary.online)],
    ['Members', String(summary.members)],
    ['Visitors', String(summary.visitors)],
  ])

  y = drawSectionTitle(doc, y + 3, 'Attendance list')

  if (memberRows.length + visitorRows.length === 0) {
    y = drawParagraph(doc, y, 'No attendance recorded for this service.')
  }

  for (const [label, rows] of [
    ['Members', memberRows],
    ['Visitors', visitorRows],
  ]) {
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