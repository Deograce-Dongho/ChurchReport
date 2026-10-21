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
  { id: 'index', label: '#', weight: 4 },
  { id: 'name', label: 'Name', weight: 19 },
  { id: 'category', label: 'Category', weight: 11 },
  { id: 'phone', label: 'Phone', weight: 17 },
  { id: 'email', label: 'Email', weight: 20 },
  { id: 'status', label: 'Status', weight: 8 },
  { id: 'attendance', label: 'Attendance', weight: 12, needsAttendance: true },
  { id: 'regularity', label: 'Regularity', weight: 14, needsRegularity: true },
]

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
    case 'status':
      return person.status || 'active'
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
      { cellWidth: (column.weight / totalWeight) * width },
    ])
  )

  const startY = drawHeader(doc, {
    title,
    lines: [
      periodLabel ? `Period: ${periodLabel}` : '',
      filterSummary,
      `${rows.length} ${rows.length === 1 ? 'person' : 'people'}`,
    ],
  })

  autoTable(doc, {
    ...baseTable(),
    startY,
    head: [columns.map((column) => column.label)],
    body: rows.map((row, index) =>
      columns.map((column) =>
        pdfText(cellValue(column.id, row, index, periodTotal))
      )
    ),
    columnStyles,
    styles: { ...baseTable().styles, fontSize: 8 },
    headStyles: { ...baseTable().headStyles, textColor: COLORS.white },
  })

  finishDocument(doc, { title: `${title} list`, generatedOn })

  return doc
}
