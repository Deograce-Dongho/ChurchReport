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
const BRAND = COLORS.brand ?? [30, 58, 138]
const NAVY = [15, 23, 42] // table header, like the dark header of the preview

const TONES = {
  brand: { bg: [232, 241, 252], bar: BRAND, fg: BRAND },
  amber: { bg: [254, 243, 226], bar: [217, 119, 6], fg: [146, 64, 14] },
}

const PRESENCE_COLORS = {
  'In person': [4, 120, 87],
  Online: [37, 99, 235],
}
const PRESENCE_UNKNOWN = [100, 116, 139]

// Same cards as the preview: Total, In person, Online, Members, Visitors.
const STAT_STYLES = [
  { key: 'total', label: 'Total', bg: [241, 245, 249], fg: [100, 116, 139] },
  { key: 'inPerson', label: 'In person', bg: [240, 249, 255], fg: [3, 105, 161] },
  { key: 'online', label: 'Online', bg: [238, 242, 255], fg: [67, 56, 202] },
  { key: 'members', label: 'Members', bg: [236, 253, 245], fg: [4, 120, 87] },
  { key: 'visitors', label: 'Visitors', bg: [255, 247, 237], fg: [180, 83, 9] },
]

// Section heading: tinted band, coloured bar, bold capitals, optional label
// on the right. It is clearly different from the body text.
function drawSectionHeading(doc, y, text, { meta, tone = 'brand' } = {}) {
  const colors = TONES[tone] ?? TONES.brand
  const height = 7

  // Keep some room below, so a heading is never alone at the page bottom
  y = ensureSpace(doc, y, height + 20)

  doc.setFillColor(...colors.bg)
  doc.rect(PAGE.margin, y, contentWidth(doc), height, 'F')

  doc.setFillColor(...colors.bar)
  doc.rect(PAGE.margin, y, 1.5, height, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...colors.fg)
  doc.text(text.toUpperCase(), PAGE.margin + 5, y + 4.8, { charSpace: 0.4 })

  if (meta) {
    doc.setFontSize(8)
    doc.text(pdfText(meta).toUpperCase(), PAGE.margin + contentWidth(doc) - 3, y + 4.7, {
      align: 'right',
    })
  }

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

  doc.setFillColor(...BRAND)
  doc.rect(left, y, 1.2, height, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...COLORS.muted)
  doc.text('SERMON TITLE', textX, y + 3, { charSpace: 0.4 })

  doc.setFont('times', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...BRAND)

  lines.forEach((line, index) => {
    doc.text(line, textX, y + 10 + index * lineHeight)
  })

  doc.setTextColor(...COLORS.text)

  return y + height + 4
}

// Five coloured cards in a row, like the summary of the preview.
function drawStatCards(doc, y, summary) {
  const gap = 3
  const height = 16
  const width = (contentWidth(doc) - gap * (STAT_STYLES.length - 1)) / STAT_STYLES.length

  y = ensureSpace(doc, y, height + 2)

  STAT_STYLES.forEach((stat, index) => {
    const x = PAGE.margin + index * (width + gap)

    doc.setFillColor(...stat.bg)
    doc.roundedRect(x, y, width, height, 1.5, 1.5, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...stat.fg)
    doc.text(stat.label.toUpperCase(), x + 3, y + 5.5, { charSpace: 0.3 })

    doc.setFontSize(16)
    doc.setTextColor(...NAVY)
    doc.text(String(summary[stat.key] ?? 0), x + 3, y + 13)
  })

  doc.setTextColor(...COLORS.text)

  return y + height + 2
}

// Dark-header table with striped rows and a coloured dot before the
// attendance type (green = in person, blue = online).
function drawAttendanceTable(doc, autoTable, y, rows, { nameLabel, modeLabel }) {
  const width = contentWidth(doc)
  const base = baseTable()

  y = ensureSpace(doc, y, 30)

  autoTable(doc, {
    ...base,
    startY: y,
    head: [['#', nameLabel, modeLabel]],
    body: rows.map((row, index) => [
      String(index + 1),
      pdfText(row.name),
      pdfText(row.presenceType || 'Unknown'),
    ]),
    styles: { ...(base.styles ?? {}), fontSize: 9, cellPadding: 2 },
    headStyles: {
      ...(base.headStyles ?? {}),
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 12, textColor: [148, 163, 184] },
      1: { cellWidth: width - 12 - 42 },
      2: { cellWidth: 42 },
    },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index !== 2) return

      data.cell.styles.textColor =
        PRESENCE_COLORS[data.cell.raw] ?? PRESENCE_UNKNOWN
      data.cell.styles.fontStyle = 'bold'
      data.cell.styles.cellPadding = { top: 2, bottom: 2, left: 7, right: 2 }
    },
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index !== 2) return

      doc.setFillColor(...(PRESENCE_COLORS[data.cell.raw] ?? PRESENCE_UNKNOWN))
      doc.circle(
        data.cell.x + 3.8,
        data.cell.y + data.cell.height / 2,
        0.9,
        'F'
      )
    },
  })

  return doc.lastAutoTable.finalY + 4
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
    y = drawSectionHeading(doc, y + 4, 'Attendance summary', {
      meta: `Total: ${summary.total} persons`,
    })
    y = drawStatCards(doc, y, summary)
  }

  if (showMembers) {
    y = drawSectionHeading(doc, y + 4, 'Attendance list', {
      meta: `Members (${memberRows.length})`,
    })

    y =
      memberRows.length === 0
        ? drawParagraph(doc, y, 'No members recorded for this service.')
        : drawAttendanceTable(doc, autoTable, y, memberRows, {
            nameLabel: 'Name',
            modeLabel: 'Attendance type',
          })
  }

  if (showVisitors) {
    y = drawSectionHeading(doc, y + 4, 'Visitors & guests', {
      tone: 'amber',
      meta: `Visitors (${visitorRows.length})`,
    })

    y =
      visitorRows.length === 0
        ? drawParagraph(doc, y, 'No visitors recorded for this service.')
        : drawAttendanceTable(doc, autoTable, y, visitorRows, {
            nameLabel: 'Visitor name',
            modeLabel: 'Mode',
          })
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