import { formatShortDate } from '../lib/periods'
import { LEVELS_BY_ID } from '../lib/regularity'

const CHURCH_NAME = import.meta.env.VITE_CHURCH_NAME || 'Church Name'

// The PDF is built from this element, which is NOT shown on screen.
// Rules (see src/lib/pdfExport.js):
//   - colors are written as HEX in inline styles, never as Tailwind classes
//     (Tailwind v4 colors cannot be read by html2canvas);
//   - only these tags are used: article, header, h2, p, table, th, td,
//     footer, span;
//   - a <span> always gets a grey text color, so do not rely on span colors.

const COLUMNS = [
  { id: 'index', label: '#', width: 4 },
  { id: 'name', label: 'Name', width: 22 },
  { id: 'category', label: 'Category', width: 9 },
  { id: 'phone', label: 'Phone', width: 14 },
  { id: 'email', label: 'Email', width: 22 },
  { id: 'status', label: 'Status', width: 8 },
  { id: 'attendance', label: 'Attendance', width: 10, needsAttendance: true },
  { id: 'regularity', label: 'Regularity', width: 14, needsRegularity: true },
]

const cellStyle = { wordBreak: 'break-word', verticalAlign: 'top' }

// props:
//   title         : "Members", "Visitors" or "Members & Visitors"
//   filterSummary : text describing the filters in use
//   periodLabel   : period shown in the header (empty to hide it)
//   rows          : [{ person, attended, levelId }], already sorted
//   periodTotal   : number of services in the period
//   showAttendance / showRegularity : columns to include
export default function MembersPdfReport({
  ref,
  title,
  filterSummary,
  periodLabel,
  rows,
  periodTotal,
  showAttendance,
  showRegularity,
}) {
  const columns = COLUMNS.filter(
    (column) =>
      (!column.needsAttendance || showAttendance) &&
      (!column.needsRegularity || showRegularity)
  )

  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0)

  function cellValue(columnId, row, index) {
    const { person, attended, levelId } = row

    switch (columnId) {
      case 'index':
        return index + 1
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

  return (
    <article ref={ref}>
      <header>
        <h2>{CHURCH_NAME}</h2>
        <p>{title}</p>
        {periodLabel && <p>{`Period: ${periodLabel}`}</p>}
        {filterSummary && <p>{filterSummary}</p>}
        <p>{`${rows.length} ${rows.length === 1 ? 'person' : 'people'}`}</p>
      </header>

      <table
        data-pdf-font-size="11px"
        style={{ tableLayout: 'fixed', marginTop: '16px' }}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                style={{ width: `${(column.width / totalWidth) * 100}%` }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.person.$id} style={{ breakInside: 'avoid' }}>
              {columns.map((column) => (
                <td key={column.id} style={cellStyle}>
                  {cellValue(column.id, row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <footer>
        <span>{`Generated on ${formatShortDate(new Date())}`}</span>
      </footer>
    </article>
  )
}