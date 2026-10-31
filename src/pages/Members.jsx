import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Footprints,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  UserCheck,
  UserRound,
  Users,
} from 'lucide-react'

import {
  getMembers,
  createMember,
  updateMember,
  deleteMember,
} from '../lib/membersService'
import { listServices } from '../lib/servicesService'
import { useServicesAttendance } from '../lib/useServicesAttendance'
import { usePeriod } from '../lib/usePeriod'
import { servicesInRange, toInputDate } from '../lib/periods'
import { LEVELS, LEVELS_BY_ID, getLevelId } from '../lib/regularity'
import IconButton from '../components/IconButton'
import PeriodPicker from '../components/PeriodPicker'

const PAGE_SIZES = [10, 25, 50]
const FAITHFUL_THRESHOLD = 0.75

// TODO: replace with your real church / campus data
const CHURCH = { name: 'Gemeinde Giessen', badge: 'Active Campus' }

const emptyForm = { name: '', email: '', phone: '', person_type: 'member' }

const CATEGORY_PILLS = [
  { id: 'all', label: 'All' },
  { id: 'member', label: 'Members' },
  { id: 'visitor', label: 'Visitors' },
]

const AVATAR_COLORS = [
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

const byName = (a, b) =>
  String(a.person.name ?? '').localeCompare(String(b.person.name ?? ''), undefined, {
    sensitivity: 'base',
  })

const fieldClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-600 sm:text-sm'

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function avatarColor(name = '') {
  let hash = 0
  for (const char of String(name)) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function barColor(ratio) {
  if (ratio >= 0.75) return 'bg-emerald-500'
  if (ratio >= 0.5) return 'bg-sky-500'
  if (ratio >= 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}

function Avatar({ name }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor(name)}`}
    >
      {initials(name)}
    </span>
  )
}

function CategoryBadge({ type }) {
  const visitor = type === 'visitor'
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        visitor
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-sky-200 bg-sky-50 text-sky-700'
      }`}
    >
      {visitor ? 'Visitor' : 'Member'}
    </span>
  )
}

function StatCard({ label, value, hint, icon: Icon, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span className={`rounded-md p-1.5 ${tone.bg} ${tone.text}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone.value}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

function pageNumbers(current, total) {
  const start = Math.max(1, Math.min(current - 2, total - 4))
  const end = Math.min(total, start + 4)
  const pages = []
  for (let i = start; i <= end; i += 1) pages.push(i)
  return pages
}

function csvEscape(value) {
  const text = String(value ?? '')
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default function Members() {
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [category, setCategory] = useState('all') // all | member | visitor
  const [level, setLevel] = useState('all') // all | regularity level id

  const period = usePeriod()
  const { range } = period

  const [services, setServices] = useState([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [servicesError, setServicesError] = useState('')

  const [exporting, setExporting] = useState(false)
  const [pdfError, setPdfError] = useState('')

  async function loadMembers() {
    setLoading(true)
    setError('')
    try {
      setMembers(await getMembers())
    } catch (err) {
      console.error('Could not load members:', err)
      setError(
        err.message ||
          'Could not load people. Check your Appwrite configuration and permissions.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getMembers()
      .then((data) => !cancelled && setMembers(data))
      .catch((err) => {
        console.error('Could not load members:', err)
        if (!cancelled) {
          setError(
            err.message ||
              'Could not load people. Check your Appwrite configuration and permissions.'
          )
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadServices() {
      try {
        const rows = await listServices()
        if (!cancelled) setServices(rows)
      } catch (err) {
        console.error('Could not load services:', err)
        if (!cancelled) setServicesError(err.message || 'Could not load the services.')
      } finally {
        if (!cancelled) setServicesLoaded(true)
      }
    }
    loadServices()
    return () => {
      cancelled = true
    }
  }, [])

  const periodServices = useMemo(
    () => (range.valid ? servicesInRange(services, range.start, range.end) : []),
    [services, range]
  )

  const { attendanceById, ready, error: attendanceError, retry } =
    useServicesAttendance(periodServices)

  const regularityStatus =
    !range.valid || servicesError || (attendanceError && !ready)
      ? 'unavailable'
      : servicesLoaded && ready
        ? 'ready'
        : 'loading'

  const regularityReady = regularityStatus === 'ready'
  const periodTotal = periodServices.length

  const attendedByMember = useMemo(() => {
    const counts = new Map()
    for (const service of periodServices) {
      for (const record of attendanceById[service.$id] ?? []) {
        counts.set(record.memberId, (counts.get(record.memberId) ?? 0) + 1)
      }
    }
    return counts
  }, [periodServices, attendanceById])

  const rows = useMemo(
    () =>
      members.map((person) => {
        const attended = attendedByMember.get(person.$id) ?? 0
        const isVisitor = person.person_type === 'visitor'
        return {
          person,
          attended,
          levelId:
            isVisitor || !regularityReady || periodTotal === 0
              ? null
              : getLevelId(attended, periodTotal),
        }
      }),
    [members, attendedByMember, regularityReady, periodTotal]
  )

  // ---------- Stats (whole directory, independent of the filters) ----------
  const stats = useMemo(() => {
    const total = rows.length
    const visitors = rows.filter((r) => r.person.person_type === 'visitor').length
    const memberRows = rows.filter((r) => r.person.person_type !== 'visitor')
    const memberCount = memberRows.length
    const canCompute = regularityReady && periodTotal > 0

    let avgRate = null
    let faithful = null

    if (canCompute && memberCount > 0) {
      const sum = memberRows.reduce((acc, r) => acc + r.attended / periodTotal, 0)
      avgRate = (sum / memberCount) * 100
      faithful = memberRows.filter(
        (r) => r.attended / periodTotal >= FAITHFUL_THRESHOLD
      ).length
    }

    return {
      total,
      visitors,
      memberCount,
      memberShare: total ? (memberCount / total) * 100 : 0,
      visitorShare: total ? (visitors / total) * 100 : 0,
      avgRate,
      avgServices: avgRate === null ? null : (avgRate / 100) * periodTotal,
      faithful,
    }
  }, [rows, regularityReady, periodTotal])

  const levelSelected = LEVELS_BY_ID[level] ? level : null

  const counts = {
    all: rows.length,
    member: stats.memberCount,
    visitor: stats.visitors,
  }

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(({ person, levelId }) => {
      const isVisitor = person.person_type === 'visitor'
      if (category === 'member' && isVisitor) return false
      if (category === 'visitor' && !isVisitor) return false
      if (levelSelected && levelId !== levelSelected) return false
      return [person.name, person.email, person.phone, person.person_type].some(
        (value) => String(value ?? '').toLowerCase().includes(term)
      )
    })
  }, [rows, search, category, levelSelected])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const firstIndex = (currentPage - 1) * pageSize
  const visibleRows = filteredRows.slice(firstIndex, firstIndex + pageSize)

  const showRegularity = category !== 'visitor'

  let emptyMessage = 'No people to display yet. Click "Add Person" to begin.'
  if (levelSelected && regularityStatus === 'loading') {
    emptyMessage = 'Loading regularity...'
  } else if (levelSelected && regularityStatus === 'unavailable') {
    emptyMessage = 'Regularity is not available for the selected period.'
  } else if (levelSelected && periodTotal === 0) {
    emptyMessage =
      'No services were recorded in this period, so there are no regularity levels.'
  } else if (search || category !== 'all' || levelSelected) {
    emptyMessage = 'No matching people found.'
  }

  // ---------- Exports ----------
  const pdfKind =
    category === 'visitor'
      ? 'Visitors'
      : category === 'member' || levelSelected
        ? 'Members'
        : 'Members & Visitors'

  const headerCategory =
    pdfKind === 'Members & Visitors' ? 'Members and visitors' : pdfKind

  const pdfWithAttendance = regularityReady && periodTotal > 0

  const pdfFilterSummary = [
    `Category: ${headerCategory}`,
    levelSelected
      ? `Regularity: ${LEVELS_BY_ID[levelSelected].label} (${LEVELS_BY_ID[levelSelected].rule})`
      : null,
    search.trim() ? `Search: "${search.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(' - ')

  const canExport =
    !loading && !exporting && filteredRows.length > 0 && regularityStatus !== 'loading'

  async function handleDownloadPDF() {
    if (!canExport) return
    setPdfError('')
    setExporting(true)
    try {
      const { downloadMembersPdf } = await import('../lib/pdf/downloads')
      await downloadMembersPdf(
        {
          title: pdfKind,
          filterSummary: pdfFilterSummary,
          periodLabel: pdfWithAttendance ? range.label : '',
          rows: [...filteredRows].sort(byName),
          periodTotal,
          showAttendance: pdfWithAttendance,
          showRegularity: pdfWithAttendance && category !== 'visitor',
        },
        `${pdfKind.replace(/ & /g, '-and-').replace(/ /g, '-')}-${toInputDate(new Date())}.pdf`
      )
    } catch (err) {
      console.error('Could not generate PDF:', err)
      setPdfError(
        'Could not generate the PDF. Please try again or check the browser console.'
      )
    } finally {
      setExporting(false)
    }
  }

  function handleDownloadCSV() {
    if (!canExport) return
    const header = ['Name', 'Category', 'Phone', 'Email']
    if (pdfWithAttendance) header.push('Attendance')
    if (pdfWithAttendance && showRegularity) header.push('Regularity')

    const lines = [...filteredRows].sort(byName).map(({ person, attended, levelId }) => {
      const cells = [
        person.name,
        person.person_type === 'visitor' ? 'Visitor' : 'Member',
        person.phone,
        person.email,
      ]
      if (pdfWithAttendance) cells.push(`${attended}/${periodTotal}`)
      if (pdfWithAttendance && showRegularity) {
        cells.push(levelId ? LEVELS_BY_ID[levelId].label : '')
      }
      return cells.map(csvEscape).join(',')
    })

    const blob = new Blob(['\uFEFF' + [header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${pdfKind.replace(/ & /g, '-and-').replace(/ /g, '-')}-${toInputDate(new Date())}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // ---------- Form ----------
  function openAddForm() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setNotice('')
    setShowForm(true)
  }

  function openEditForm(person) {
    setEditingId(person.$id)
    setForm({
      name: person.name ?? '',
      email: person.email ?? '',
      phone: person.phone ?? '',
      person_type: person.person_type ?? 'member',
    })
    setError('')
    setNotice('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  function handleChange(event) {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!form.name.trim()) {
      setError('Please enter a name.')
      return
    }

    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        person_type: form.person_type,
      }
      if (editingId) {
        await updateMember(editingId, data)
        setNotice('Person updated successfully.')
      } else {
        await createMember(data)
        setNotice('Person added successfully.')
      }
      closeForm()
      await loadMembers()
    } catch (err) {
      console.error('Could not save person:', err)
      setError(
        err.message ||
          'Could not save this person. Check your table columns and permissions.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(person) {
    const confirmed = window.confirm(
      `Delete ${person.name}? This action may affect records linked to this person.`
    )
    if (!confirmed) return

    setError('')
    setNotice('')
    try {
      await deleteMember(person.$id)
      setNotice(`${person.name} was deleted.`)
      await loadMembers()
    } catch (err) {
      console.error('Could not delete person:', err)
      setError(
        err.message ||
          'Could not delete this person. Check linked records and permissions.'
      )
    }
  }

  function handleSearch(event) {
    setSearch(event.target.value)
    setPage(1)
  }

  function handleCategory(id) {
    setCategory(id)
    if (id === 'visitor') setLevel('all')
    setPage(1)
  }

  function handleLevel(event) {
    setLevel(event.target.value)
    // Regularity only concerns members
    if (event.target.value !== 'all' && category === 'visitor') setCategory('member')
    setPage(1)
  }

  function handlePageSize(event) {
    setPageSize(Number(event.target.value))
    setPage(1)
  }

  // ---------- Shared pieces ----------
  function personActions(person) {
    return (
      <div className="flex items-center gap-1 print:hidden">
        <IconButton
          label={`Edit ${person.name}`}
          tooltip="Edit"
          onClick={() => openEditForm(person)}
        >
          <Pencil size={18} />
        </IconButton>
        <IconButton
          label={`Delete ${person.name}`}
          tooltip="Delete"
          tone="red"
          onClick={() => handleDelete(person)}
        >
          <Trash2 size={18} />
        </IconButton>
      </div>
    )
  }

  function attendanceCell(attended) {
    if (regularityStatus === 'loading') return <span className="text-slate-400">…</span>
    if (regularityStatus === 'unavailable' || periodTotal === 0) {
      return <span className="text-slate-400">—</span>
    }
    const ratio = attended / periodTotal
    return (
      <div className="w-24">
        <span className="text-xs font-medium text-slate-700">
          {attended} / {periodTotal}
        </span>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${barColor(ratio)}`}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      </div>
    )
  }

  function regularityCell(levelData, attended) {
    if (regularityStatus === 'loading') return <span className="text-slate-400">…</span>
    if (!levelData) return <span className="text-slate-400">—</span>
    return (
      <>
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${levelData.badge}`}
        >
          {levelData.label}
        </span>
        <span className="ml-2 text-xs text-slate-500">
          {Math.round((attended / periodTotal) * 100)}%
        </span>
      </>
    )
  }

  const columnCount = showRegularity ? 8 : 7

  return (
    <section className="space-y-5">
      {/* ---------- Page header card ---------- */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Users size={28} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-brand-900">{CHURCH.name}</h1>
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                  {CHURCH.badge}
                </span>
              </div>
              <p className="mt-0.5 text-base font-semibold text-brand-600">
                Members &amp; Visitors
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={13} />
                  Period:{' '}
                  <strong className="font-semibold text-slate-700">
                    {range.valid ? range.label : '—'}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users size={13} />
                  Category: <strong className="font-semibold text-slate-700">{headerCategory}</strong>
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5">
                  <strong className="font-semibold text-slate-700">{stats.total}</strong> people registered
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer size={16} />
              Print List
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={!canExport}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText size={16} />
              {exporting ? 'Generating…' : 'Export PDF'}
            </button>

            <button
              type="button"
              onClick={handleDownloadCSV}
              disabled={!canExport}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              CSV
            </button>

            <button
              type="button"
              onClick={openAddForm}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              Add Person
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Total people"
          value={stats.total}
          hint="Enrolled for period"
          icon={Users}
          tone={{ bg: 'bg-sky-50', text: 'text-sky-600', value: 'text-slate-900' }}
        />
        <StatCard
          label="Members"
          value={stats.memberCount}
          hint={`${stats.memberShare.toFixed(1)}% of congregation`}
          icon={UserRound}
          tone={{ bg: 'bg-sky-50', text: 'text-sky-600', value: 'text-sky-700' }}
        />
        <StatCard
          label="Visitors"
          value={stats.visitors}
          hint={`${stats.visitorShare.toFixed(1)}% newcomers`}
          icon={Footprints}
          tone={{ bg: 'bg-amber-50', text: 'text-amber-600', value: 'text-amber-700' }}
        />
        <StatCard
          label="Avg. presence"
          value={stats.avgRate === null ? '—' : `${stats.avgRate.toFixed(1)}%`}
          hint={
            stats.avgServices === null
              ? 'No data for this period'
              : `~${stats.avgServices.toFixed(1)} / ${periodTotal} services`
          }
          icon={BarChart3}
          tone={{ bg: 'bg-emerald-50', text: 'text-emerald-600', value: 'text-emerald-700' }}
        />
        <StatCard
          label={`Faithful (≥${FAITHFUL_THRESHOLD * 100}%)`}
          value={stats.faithful === null ? '—' : stats.faithful}
          hint="Highly committed"
          icon={UserCheck}
          tone={{ bg: 'bg-violet-50', text: 'text-violet-600', value: 'text-violet-700' }}
        />
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </div>
      )}

      {(error || pdfError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error || pdfError}
        </div>
      )}

      {/* ---------- Form ---------- */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
        >
          <h2 className="text-lg font-semibold text-brand-900">
            {editingId ? 'Edit person' : 'Add a person'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block min-w-0 space-y-1 text-sm font-medium text-slate-700">
              Full name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                maxLength={255}
                placeholder="Enter full name"
                className={fieldClass}
              />
            </label>

            <label className="block min-w-0 space-y-1 text-sm font-medium text-slate-700">
              Category *
              <select
                name="person_type"
                value={form.person_type}
                onChange={handleChange}
                required
                className={fieldClass}
              >
                <option value="member">Member</option>
                <option value="visitor">Visitor</option>
              </select>
            </label>

            <label className="block min-w-0 space-y-1 text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className={fieldClass}
                placeholder="name@example.com"
              />
            </label>

            <label className="block min-w-0 space-y-1 text-sm font-medium text-slate-700">
              Phone
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                maxLength={30}
                className={fieldClass}
                placeholder="Phone number"
              />
            </label>
          </div>

          <p className="text-xs text-slate-500">Fields marked with * are required.</p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add person'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ---------- Toolbar ---------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 print:hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={handleSearch}
              placeholder="Search by name, phone, email..."
              aria-label="Search by name, phone or email"
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-base outline-none focus:border-brand-600 sm:text-sm"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div
              role="group"
              aria-label="Category"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
            >
              {CATEGORY_PILLS.map((pill) => {
                const active = category === pill.id
                return (
                  <button
                    key={pill.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleCategory(pill.id)}
                    className={`min-h-9 flex-1 rounded-md px-3 py-1.5 text-xs font-medium sm:flex-none ${
                      active
                        ? 'bg-white text-brand-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {pill.label} ({counts[pill.id]})
                  </button>
                )
              })}
            </div>

            <label className="sr-only" htmlFor="regularity-filter">
              Regularity
            </label>
            <select
              id="regularity-filter"
              value={level}
              onChange={handleLevel}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-brand-600 sm:text-sm"
            >
              <option value="all">All Regularity</option>
              {LEVELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>

            <PeriodPicker
              period={period}
              variant="select"
              idPrefix="members-period"
              label="Attendance period"
            />
          </div>
        </div>

        {(servicesError || attendanceError) && (
          <div
            role="alert"
            className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <span className="min-w-0 break-words">
              Regularity could not be loaded: {servicesError || attendanceError}
            </span>
            {!servicesError && (
              <button
                type="button"
                onClick={retry}
                className="min-h-11 rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
              >
                Try again
              </button>
            )}
          </div>
        )}

        <p className="mt-3 break-words text-xs text-slate-500">
          {!range.valid
            ? 'Choose a valid period to see attendance and regularity.'
            : regularityReady && periodTotal === 0
              ? 'No services were recorded in this period.'
              : `Rate = services attended / ${
                  regularityReady ? periodTotal : 'the'
                } service(s) held in the period. ${LEVELS.map(
                  (item) => `${item.label}: ${item.rule}`
                ).join(' · ')}.`}
          {regularityReady && periodTotal > 0 && periodTotal < 4
            ? ' Only a few services: the levels are only indicative.'
            : ''}
        </p>
      </div>

      {/* ---------- List ---------- */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* Cards (< 768 px) */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {loading ? (
            <li className="py-10 text-center text-sm text-slate-500">Loading people...</li>
          ) : visibleRows.length === 0 ? (
            <li className="py-10 text-center text-sm text-slate-500">{emptyMessage}</li>
          ) : (
            visibleRows.map(({ person, attended, levelId }) => {
              const levelData = levelId ? LEVELS_BY_ID[levelId] : null
              return (
                <li key={person.$id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={person.name} />
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-brand-900">
                          {person.name}
                        </p>
                        <div className="mt-1">
                          <CategoryBadge type={person.person_type} />
                        </div>
                      </div>
                    </div>
                    <div className="-mr-2 -mt-1 shrink-0">{personActions(person)}</div>
                  </div>

                  <dl className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm">
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="min-w-0 break-words text-slate-700">{person.phone || '—'}</dd>
                    <dt className="text-slate-500">Email</dt>
                    <dd className="min-w-0 break-words text-slate-700">{person.email || '—'}</dd>
                    <dt className="text-slate-500">Attendance</dt>
                    <dd>{attendanceCell(attended)}</dd>
                    {showRegularity && (
                      <>
                        <dt className="text-slate-500">Regularity</dt>
                        <dd>{regularityCell(levelData, attended)}</dd>
                      </>
                    )}
                  </dl>
                </li>
              )
            })
          )}
        </ul>

        {/* Table (≥ 768 px) */}
        <div
          className="hidden overflow-x-auto md:block"
          tabIndex={0}
          role="region"
          aria-label="People table"
        >
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-brand-900 text-[11px] uppercase tracking-wide text-white">
              <tr>
                <th className="w-12 px-3 py-3.5 font-semibold">#</th>
                <th className="sticky left-0 z-10 bg-brand-900 px-3 py-3.5 font-semibold">
                  Name
                </th>
                <th className="px-3 py-3.5 font-semibold">Category</th>
                <th className="px-3 py-3.5 font-semibold">Phone</th>
                <th className="px-3 py-3.5 font-semibold">Email</th>
                <th className="px-3 py-3.5 font-semibold">Attendance</th>
                {showRegularity && (
                  <th className="px-3 py-3.5 font-semibold">Regularity</th>
                )}
                <th className="px-3 py-3.5 font-semibold print:hidden">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className="px-3 py-10 text-center text-slate-500">
                    Loading people...
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-3 py-10 text-center text-slate-500">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ person, attended, levelId }, index) => {
                  const levelData = levelId ? LEVELS_BY_ID[levelId] : null
                  return (
                    <tr key={person.$id} className="group hover:bg-slate-50">
                      <td className="px-3 py-3 text-xs text-slate-400">
                        {firstIndex + index + 1}
                      </td>
                      <td className="sticky left-0 bg-white px-3 py-3 group-hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <Avatar name={person.name} />
                          <span className="max-w-[16rem] font-medium text-brand-900">
                            {person.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <CategoryBadge type={person.person_type} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600">
                        {person.phone || '—'}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-sky-700">
                        {person.email || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-3">{attendanceCell(attended)}</td>
                      {showRegularity && (
                        <td className="whitespace-nowrap px-3 py-3">
                          {regularityCell(levelData, attended)}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 print:hidden">
                        {personActions(person)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ---------- Footer / pagination ---------- */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <p className="text-xs">
            {filteredRows.length > 0
              ? `Showing ${firstIndex + 1} to ${Math.min(
                  firstIndex + pageSize,
                  filteredRows.length
                )} of ${filteredRows.length} people`
              : 'No people'}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              Rows per page:
              <select
                value={pageSize}
                onChange={handlePageSize}
                className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs outline-none focus:border-brand-600"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <nav aria-label="Pagination" className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>

              {pageNumbers(currentPage, totalPages).map((number) => (
                <button
                  key={number}
                  type="button"
                  aria-current={number === currentPage ? 'page' : undefined}
                  onClick={() => setPage(number)}
                  className={`h-9 min-w-9 rounded-md border px-2 text-xs font-medium ${
                    number === currentPage
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {number}
                </button>
              ))}

              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </section>
  )
}