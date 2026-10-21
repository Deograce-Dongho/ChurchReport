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

// Builds the PDF of one Sunday service report.
//   dateLong, preacher, sermonTitle, keyPoints : the service information
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

  y = drawSectionTitle(doc, y, 'Service information')
  y = drawKeyValues(doc, autoTable, y, [
    ['Date', dateLong],
    ['Preacher', preacher || 'Not specified'],
    ['Sermon title', sermonTitle || 'Not specified'],
  ])

  y = drawSectionTitle(doc, y + 3, 'Sermon key points')
  y = drawParagraph(doc, y, keyPoints?.trim() || 'No key points recorded.')

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
