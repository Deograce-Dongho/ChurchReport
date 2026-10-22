import {
  PAGE,
  COLORS,
  baseTable,
  contentWidth,
  createDocument,
  drawHeader,
  drawKeyValues,
  ensureSpace,
  finishDocument,
  loadPdfLibs,
  pdfText,
} from './kit'

const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

// Section title: bold dark blue text with a thin line below.
function drawHeading(doc, y, text) {
  const top = ensureSpace(doc, y, 25)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLORS.ink)
  doc.text(pdfText(text), PAGE.margin, top)

  doc.setDrawColor(...COLORS.line)
  doc.setLineWidth(0.3)
  doc.line(PAGE.margin, top + 2, PAGE.margin + contentWidth(doc), top + 2)

  return top + 5
}

// Builds the attendance statistics PDF.
//   periodLabel : "01 Jan 2026 - 30 Jun 2026"
//   stats       : the figures computed by the Statistics page
//   formatDate  : (value) => "20 Oct 2026"
//   generatedOn : formatted date
export async function buildStatisticsPdf({
  periodLabel,
  stats,
  formatDate,
  generatedOn,
}) {
  const { jsPDF, autoTable } = await loadPdfLibs()
  const title = 'Attendance Statistics'
  const doc = createDocument(jsPDF, { title })

  let y = drawHeader(doc, { title, lines: [`Period: ${periodLabel}`] })

  y = drawHeading(doc, y, 'Summary')

  y = drawKeyValues(doc, autoTable, y, [
    ['Services held', String(stats.serviceCount)],
    ['Total attendances', String(stats.totalAttendances)],
    ['Average / service', numberFormat.format(stats.average)],
    ['In person', `${stats.inPerson} (${stats.inPersonPercent}%)`],
    ['Online', `${stats.online} (${stats.onlinePercent}%)`],
    [
      'Members',
      `${stats.memberAttendances} attendances, on average ${numberFormat.format(
        stats.averageMembers
      )} per service`,
    ],
    [
      'Visitors',
      `${stats.visitorAttendances} attendances, ${stats.uniqueVisitors} different visitor(s)`,
    ],
  ])

  y = drawHeading(doc, y + 4, 'Attendance by service')

  const width = contentWidth(doc)

  // autoTable ignores columnStyles in the head and foot sections,
  // so the alignment is given to each cell there.
  const right = { halign: 'right' }

  autoTable(doc, {
    ...baseTable(),
    startY: y,
    showFoot: 'lastPage',
    head: [
      [
        'Date',
        'Sermon',
        { content: 'In person', styles: right },
        { content: 'Online', styles: right },
        { content: 'Members', styles: right },
        { content: 'Visitors', styles: right },
        { content: 'Total', styles: right },
      ],
    ],
    body: stats.rows.map((row) => [
      pdfText(formatDate(row.date)),
      pdfText(row.title),
      String(row.inPerson),
      String(row.online),
      String(row.members),
      String(row.visitors),
      { content: String(row.total), styles: { fontStyle: 'bold' } },
    ]),
    foot: [
      [
        { content: 'Total', colSpan: 2 },
        { content: String(stats.inPerson), styles: right },
        { content: String(stats.online), styles: right },
        { content: String(stats.memberAttendances), styles: right },
        { content: String(stats.visitorAttendances), styles: right },
        { content: String(stats.totalAttendances), styles: right },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: width - 25 - 5 * 17 },
      2: { cellWidth: 17, halign: 'right' },
      3: { cellWidth: 17, halign: 'right' },
      4: { cellWidth: 17, halign: 'right' },
      5: { cellWidth: 17, halign: 'right' },
      6: { cellWidth: 17, halign: 'right' },
    },
  })

  finishDocument(doc, { title, generatedOn })

  return doc
}