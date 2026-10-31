import { LEVELS_BY_ID } from '../regularity'
import {
  COLORS,
  baseTable,
  contentWidth,
  createDocument,
  drawHeader,
  finishDocument,
  loadPdfLibs,
  pdfText,
} from './kit'

const COLUMNS = [
  { id: 'index', label: '#', weight: 4, align: 'center' },
  { id: 'name', label: 'Name', weight: 21 },
  { id: 'category', label: 'Category', weight: 11, align: 'center' },
  { id: 'phone', label: 'Phone', weight: 17 },
  { id: 'email', label: 'Email', weight: 23 },
  { id: 'attendance', label: 'Attendance', weight: 12, align: 'center', needsAttendance: true },
  { id: 'regularity', label: 'Regularity', weight: 14, align: 'center', needsRegularity: true },
]

// Text colors (RGB) used to give the PDF the same visual cues as the screen
const TONES = {
  visitor: [180, 83, 9], // amber
  member: [3, 105, 161], // sky
  good: [4, 120, 87], // emerald
  ok: [3, 105, 161], // sky
  warn: [180, 83, 9], // amber
  low: [185, 28, 28], // red
  muted: [148, 163, 184], // slate
}

const ZEBRA = [248, 250, 252]

function rateTone(attended, total) {
  if (!total) return TONES.muted
  const ratio = attended / total
  if (ratio >= 0.75) return TONES.good
  if (ratio >= 0.5) return TONES.ok
  if (ratio >= 0.25) return TONES.warn
  return TONES.low
}

function cellValue(columnId, row, index, periodTotal) {
  const { person, attended, levelId } = row

  switch (columnId) {
    case 'index':
      return String(index + 1)
    case 'name':
      return person.name || 'Unknown'
    case 'category':
      return person.person_type === 'visitor' ? 'Visitor' : 'Member'
    case 'phone':
      return person.phone || '-'
    case 'email':
      return person.email || '-'
    case 'attendance':
      return `${attended} / ${periodTotal}`
    case 'regularity': {
      const level = levelId ? LEVELS_BY_ID[levelId] : null
      return level
        ? `${level.label} (${Math.round((attended / periodTotal) * 100)}%)`
        : '-'
    }
    default:
      return ''
  }
}

// Builds the PDF of the members / visitors list.
//   title          : "Members", "Visitors" or "Members & Visitors"
//   filterSummary  : text describing the filters in use
//   periodLabel    : period shown in the header (empty to hide it)
//   rows           : [{ person, attended, levelId }], already sorted
//   periodTotal    : number of services in the period
//   showAttendance / showRegularity : columns to include
//   generatedOn    : formatted date
export async function buildMembersPdf({
  title,
  filterSummary,
  periodLabel,
  rows,
  periodTotal,
  showAttendance,
  showRegularity,
  generatedOn,
}) {
  const { jsPDF, autoTable } = await loadPdfLibs()
  const doc = createDocument(jsPDF, { title: `${title} list` })

  const columns = COLUMNS.filter(
    (column) =>
      (!column.needsAttendance || showAttendance) &&
      (!column.needsRegularity || showRegularity)
  )

  const totalWeight = columns.reduce((sum, column) => sum + column.weight, 0)
  const width = contentWidth(doc)

  const columnStyles = Object.fromEntries(
    columns.map((column, index) => [
      index,
      {
        cellWidth: (column.weight / totalWeight) * width,
        halign: column.align ?? 'left',
      },
    ])
  )

  // Summary line: members / visitors counts
  const visitors = rows.filter((row) => row.person.person_type === 'visitor').length
  const members = rows.length - visitors
  const countLine =
    visitors > 0 && members > 0
      ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'} (${members} member${members === 1 ? '' : 's'}, ${visitors} visitor${visitors === 1 ? '' : 's'})`
      : `${rows.length} ${rows.length === 1 ? 'person' : 'people'}`

  const startY = drawHeader(doc, {
    title,
    lines: [
      periodLabel ? `Period: ${periodLabel}` : '',
      filterSummary,
      countLine,
    ],
  })

  const base = baseTable()

  autoTable(doc, {
    ...base,
    startY,
    head: [columns.map((column) => column.label)],
    body: rows.map((row, index) =>
      columns.map((column) =>
        pdfText(cellValue(column.id, row, index, periodTotal))
      )
    ),
    columnStyles,
    styles: { ...base.styles, fontSize: 8, cellPadding: { top: 2.6, bottom: 2.6, left: 2, right: 2 } },
    headStyles: {
      ...base.headStyles,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: ZEBRA },
    // Repeat the header on every page and never split a row across two pages
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    didParseCell(data) {
      if (data.section !== 'body') return

      const column = columns[data.column.index]
      const row = rows[data.row.index]
      if (!column || !row) return

      const { person, attended } = row

      switch (column.id) {
        case 'index':
          data.cell.styles.textColor = TONES.muted
          break
        case 'name':
          data.cell.styles.fontStyle = 'bold'
          break
        case 'category':
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor =
            person.person_type === 'visitor' ? TONES.visitor : TONES.member
          break
        case 'attendance':
        case 'regularity':
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor =
            column.id === 'regularity' && !row.levelId
              ? TONES.muted
              : rateTone(attended, periodTotal)
          break
        default:
          break
      }
    },
  })

  finishDocument(doc, { title: `${title} list`, generatedOn })

  return doc
}