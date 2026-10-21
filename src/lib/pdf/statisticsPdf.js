import {
  baseTable,
  contentWidth,
  createDocument,
  drawHeader,
  drawKeyValues,
  drawSectionTitle,
  finishDocument,
  loadPdfLibs,
  pdfText,
} from './kit'

const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

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
  const doc = createDocument(jsPDF, { title: 'Attendance Statistics' })

  let y = drawHeader(doc, {
    title: 'Attendance Statistics',
    lines: [`Period: ${periodLabel}`],
  })

  y = drawSectionTitle(doc, y, 'Summary')

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

  y = drawSectionTitle(doc, y + 4, 'Attendance by service')

  const width = contentWidth(doc)

  autoTable(doc, {
    ...baseTable(),
    startY: y,
    showFoot: 'lastPage',
    head: [
      ['Date', 'Sermon', 'In person', 'Online', 'Members', 'Visitors', 'Total'],
    ],
    body: stats.rows.map((row) => [
      pdfText(formatDate(row.date)),
      pdfText(row.title),
      String(row.inPerson),
      String(row.online),
      String(row.members),
      String(row.visitors),
      String(row.total),
    ]),
    foot: [
      [
        { content: 'Total', colSpan: 2 },
        String(stats.inPerson),
        String(stats.online),
        String(stats.memberAttendances),
        String(stats.visitorAttendances),
        String(stats.totalAttendances),
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

  finishDocument(doc, { title: 'Attendance Statistics', generatedOn })

  return doc
}
