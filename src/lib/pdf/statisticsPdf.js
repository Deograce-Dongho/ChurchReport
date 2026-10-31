import {
  PAGE,
  COLORS,
  baseTable,
  contentWidth,
  createDocument,
  drawHeader,
  ensureSpace,
  finishDocument,
  loadPdfLibs,
  pdfText,
} from './kit'

const numberFormat = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 1,
})

// Palette shared with the dashboard.
const BLUE = [10, 132, 198]
const BLUE_DARK = [3, 105, 161]
const ORANGE = [249, 115, 22]
const ORANGE_DARK = [234, 88, 12]
const GRAY = [148, 163, 184]
const MUTED = [100, 116, 139]
const NAVY = [15, 38, 66]
const CARD_BORDER = [226, 232, 240]
const CARD_FILL = [248, 250, 252]

// Section heading, with an optional note on the right.
function drawHeading(doc, y, text, note) {
  const top = ensureSpace(doc, y, 25)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...COLORS.ink)
  doc.text(pdfText(text), PAGE.margin, top)

  if (note) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(
      pdfText(note),
      PAGE.margin + contentWidth(doc),
      top,
      { align: 'right' }
    )
  }

  doc.setDrawColor(...COLORS.line)
  doc.setLineWidth(0.3)

  doc.line(
    PAGE.margin,
    top + 2,
    PAGE.margin + contentWidth(doc),
    top + 2
  )

  return top + 6
}

// Summary cards: 4 per row, label / big value / note.
function drawKpiCards(doc, y, cards) {
  const perRow = 4
  const gap = 3
  const cardHeight = 20
  const width = contentWidth(doc)
  const cardWidth = (width - gap * (perRow - 1)) / perRow

  let cursorY = y

  cards.forEach((card, index) => {
    const col = index % perRow

    if (col === 0) {
      cursorY = ensureSpace(
        doc,
        index === 0 ? y : cursorY + cardHeight + gap,
        cardHeight + 2
      )
    }

    const x = PAGE.margin + col * (cardWidth + gap)

    // Card background.
    doc.setFillColor(...CARD_FILL)
    doc.setDrawColor(...CARD_BORDER)
    doc.setLineWidth(0.25)
    doc.roundedRect(x, cursorY, cardWidth, cardHeight, 2, 2, 'FD')

    // Label.
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...MUTED)
    doc.text(pdfText(card.label), x + 3.5, cursorY + 5.5)

    // Value.
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...(card.color ?? NAVY))
    doc.text(pdfText(String(card.value)), x + 3.5, cursorY + 13)

    // Note.
    if (card.note) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...GRAY)
      doc.text(pdfText(card.note), x + 3.5, cursorY + 17.2)
    }
  })

  const rowCount = Math.ceil(cards.length / perRow)

  return cursorY + cardHeight + (rowCount > 0 ? 3 : 0)
}

// Draw the attendance trend chart directly with jsPDF.
// This keeps the PDF lightweight and independent of Recharts.
function drawAttendanceChart(doc, y, rows, formatDate) {
  const width = contentWidth(doc)
  const chartHeight = 68

  const top = ensureSpace(doc, y, chartHeight + 6)

  if (!rows.length) return top

  const left = PAGE.margin + 8
  const right = PAGE.margin + width - 5

  // Legend sits above the plot.
  const legendY = top + 2

  const plotTop = top + 10
  const plotBottom = top + 52

  const plotHeight = plotBottom - plotTop
  const plotWidth = right - left

  const maxValue = Math.max(1, ...rows.map((row) => row.total))

  const scaleMax = Math.max(10, Math.ceil(maxValue / 10) * 10)

  const getX = (index) => {
    if (rows.length === 1) return left + plotWidth / 2

    return left + (index / (rows.length - 1)) * plotWidth
  }

  const getY = (value) =>
    plotBottom - (value / scaleMax) * plotHeight

  // Soft area under the members line.
  if (rows.length > 1) {
    const segments = []

    for (let i = 1; i < rows.length; i++) {
      segments.push([
        getX(i) - getX(i - 1),
        getY(rows[i].members ?? 0) - getY(rows[i - 1].members ?? 0),
      ])
    }

    const lastY = getY(rows[rows.length - 1].members ?? 0)

    segments.push([0, plotBottom - lastY])
    segments.push([left - getX(rows.length - 1), 0])

    doc.setFillColor(231, 243, 251)
    doc.lines(
      segments,
      getX(0),
      getY(rows[0].members ?? 0),
      [1, 1],
      'F',
      true
    )
  }

  // Horizontal grid lines and Y labels.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setLineWidth(0.2)

  if (doc.setLineDashPattern) doc.setLineDashPattern([0.8, 1.2], 0)

  for (let i = 0; i <= 3; i++) {
    const value = (scaleMax * i) / 3
    const gridY = getY(value)

    doc.setDrawColor(210, 218, 228)
    doc.line(left, gridY, right, gridY)

    doc.setTextColor(...GRAY)
    doc.text(String(Math.round(value)), left - 3, gridY + 2, {
      align: 'right',
    })
  }

  if (doc.setLineDashPattern) doc.setLineDashPattern([], 0)

  // Chart series.
  const series = [
    { key: 'total', color: GRAY, dashed: true, width: 0.45 },
    { key: 'visitors', color: ORANGE, dashed: false, width: 0.7 },
    { key: 'members', color: BLUE, dashed: false, width: 0.8 },
  ]

  for (const item of series) {
    doc.setDrawColor(...item.color)
    doc.setFillColor(...item.color)
    doc.setLineWidth(item.width)

    if (doc.setLineDashPattern) {
      doc.setLineDashPattern(item.dashed ? [1.5, 1.2] : [], 0)
    }

    rows.forEach((row, index) => {
      const currentX = getX(index)
      const currentY = getY(row[item.key] ?? 0)

      if (index > 0) {
        const previousRow = rows[index - 1]

        doc.line(
          getX(index - 1),
          getY(previousRow[item.key] ?? 0),
          currentX,
          currentY
        )
      }
    })

    // Points are drawn without dash pattern.
    if (doc.setLineDashPattern) doc.setLineDashPattern([], 0)

    if (item.key !== 'total') {
      rows.forEach((row, index) => {
        doc.circle(getX(index), getY(row[item.key] ?? 0), 0.9, 'F')
      })
    }
  }

  if (doc.setLineDashPattern) doc.setLineDashPattern([], 0)

  // Date labels: avoid overlapping on long periods.
  const labelStep = Math.max(1, Math.ceil(rows.length / 7))

  doc.setTextColor(...GRAY)
  doc.setFontSize(6.5)

  rows.forEach((row, index) => {
    const isLast = index === rows.length - 1

    if (index % labelStep !== 0 && !isLast) return

    doc.text(
      pdfText(formatDate(row.date)),
      getX(index),
      plotBottom + 6,
      { align: 'center' }
    )
  })

  // Legend (top right).
  const legendItems = [
    { label: 'Members', color: BLUE, dashed: false },
    { label: 'Visitors', color: ORANGE, dashed: false },
    { label: 'Total', color: GRAY, dashed: true },
  ]

  doc.setFontSize(7.5)

  let legendX = right - 56

  for (const item of legendItems) {
    doc.setDrawColor(...item.color)
    doc.setFillColor(...item.color)
    doc.setLineWidth(0.6)

    if (item.dashed) {
      if (doc.setLineDashPattern) doc.setLineDashPattern([1, 0.8], 0)
      doc.line(legendX - 1, legendY, legendX + 3, legendY)
      if (doc.setLineDashPattern) doc.setLineDashPattern([], 0)
    } else {
      doc.circle(legendX + 1, legendY, 1, 'F')
    }

    doc.setTextColor(71, 85, 105)
    doc.text(item.label, legendX + 5, legendY + 1.2)

    legendX += item.label === 'Visitors' ? 19 : item.label === 'Members' ? 20 : 15
  }

  if (doc.setLineDashPattern) doc.setLineDashPattern([], 0)

  return top + chartHeight
}

// Builds the attendance statistics PDF.
//
// periodLabel : selected reporting period
// stats       : statistics calculated by Statistics.jsx
// formatDate  : date formatting function
// generatedOn : formatted generation date
export async function buildStatisticsPdf({
  periodLabel,
  stats,
  formatDate,
  generatedOn,
}) {
  const { jsPDF, autoTable } = await loadPdfLibs()

  const title = 'Attendance Statistics'

  const doc = createDocument(jsPDF, { title })

  // Header.
  let y = drawHeader(doc, {
    title,
    lines: [`Period: ${periodLabel}`],
  })

  // Summary overview.
  y = drawHeading(doc, y, 'Summary overview')

  y = drawKpiCards(doc, y, [
    {
      label: 'Services held',
      value: stats.serviceCount,
      note: 'In this period',
    },
    {
      label: 'Total attendances',
      value: stats.totalAttendances,
      note: 'In person + online',
    },
    {
      label: 'Average / service',
      value: numberFormat.format(stats.average),
      note: 'Attendees',
      color: BLUE_DARK,
    },
    {
      label: 'In person',
      value: stats.inPerson,
      note: `${stats.inPersonPercent}%`,
    },
    {
      label: 'Online',
      value: stats.online,
      note: `${stats.onlinePercent}%`,
    },
    {
      label: 'Members',
      value: stats.memberAttendances,
      note: `Avg ${numberFormat.format(stats.averageMembers)} / service`,
      color: BLUE_DARK,
    },
    {
      label: 'Visitors',
      value: stats.visitorAttendances,
      note: `${stats.uniqueVisitors} distinct`,
      color: ORANGE_DARK,
    },
  ])

  // Attendance chart.
  y = drawHeading(doc, y + 3, 'Attendance trend')

  y = drawAttendanceChart(doc, y, stats.rows, formatDate)

  // Detailed attendance table.
  y = drawHeading(
    doc,
    y + 3,
    'Attendance by service',
    `${stats.serviceCount} individual service session${
      stats.serviceCount === 1 ? '' : 's'
    } recorded`
  )

  const width = contentWidth(doc)
  const base = baseTable()

  const right = { halign: 'right' }

  const headCell = (label, extra = {}) => ({
    content: label.toUpperCase(),
    styles: extra,
  })

  autoTable(doc, {
    ...base,

    startY: y,

    showFoot: 'lastPage',

    headStyles: {
      ...base.headStyles,
      fillColor: [241, 245, 249],
      textColor: [100, 116, 139],
      fontStyle: 'bold',
      fontSize: 7,
    },

    footStyles: {
      ...base.footStyles,
      fillColor: [231, 243, 251],
      textColor: NAVY,
      fontStyle: 'bold',
    },

    alternateRowStyles: {
      ...base.alternateRowStyles,
      fillColor: [250, 251, 253],
    },

    head: [
      [
        headCell('Date'),
        headCell('Sermon title'),
        headCell('In person', right),
        headCell('Online', right),
        headCell('Members', right),
        headCell('Visitors', right),
        headCell('Total', right),
      ],
    ],

    body: stats.rows.map((row) => [
      {
        content: pdfText(formatDate(row.date)),
        styles: { fontStyle: 'bold', textColor: NAVY },
      },
      pdfText(row.title),
      String(row.inPerson),
      {
        content: String(row.online),
        styles: { textColor: MUTED },
      },
      {
        content: String(row.members),
        styles: { textColor: BLUE_DARK, fontStyle: 'bold' },
      },
      {
        content: String(row.visitors),
        styles: { textColor: ORANGE_DARK, fontStyle: 'bold' },
      },
      {
        content: String(row.total),
        styles: { fontStyle: 'bold', textColor: NAVY },
      },
    ]),

    foot: [
      [
        { content: 'Total', colSpan: 2 },

        { content: String(stats.inPerson), styles: right },

        { content: String(stats.online), styles: right },

        {
          content: String(stats.memberAttendances),
          styles: { ...right, textColor: BLUE_DARK },
        },

        {
          content: String(stats.visitorAttendances),
          styles: { ...right, textColor: ORANGE_DARK },
        },

        {
          content: String(stats.totalAttendances),
          styles: right,
        },
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

  // Footer and page numbering.
  finishDocument(doc, {
    title,
    generatedOn,
  })

  return doc
}