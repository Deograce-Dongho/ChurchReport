import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Pencil, Trash2 } from 'lucide-react'

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
import { downloadElementAsPDF } from '../lib/pdfExport'
import IconButton from '../components/IconButton'
import PeriodPicker from '../components/PeriodPicker'
import MembersPdfReport from '../components/MembersPdfReport'

const PAGE_SIZE = 25

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  person_type: 'member',
}

// First group of the "Show" list. The other values are regularity levels.
const CATEGORY_FILTERS = [
  { id: 'all', label: 'All people' },
  { id: 'member', label: 'All members' },
  { id: 'visitor', label: 'All visitors' },
]

const byName = (a, b) =>
  String(a.person.name ?? '').localeCompare(String(b.person.name ?? ''), undefined, {
    sensitivity: 'base',
  })

export default function Members() {
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // "Show" list: a category (all / members / visitors) or a regularity level
  const [filter, setFilter] = useState('all')

  // Attendance period
  const period = usePeriod()
  const { range } = period

  const [services, setServices] = useState([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [servicesError, setServicesError] = useState('')

  // PDF export
  const [exportJob, setExportJob] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const pdfRef = useRef(null)

  async function loadMembers() {
    setLoading(true)
    setError('')

    try {
      const data = await getMembers()
      setMembers(data)
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

  // First load (the page starts with loading = true)
  useEffect(() => {
    let cancelled = false

    getMembers()
      .then((data) => {
        if (!cancelled) setMembers(data)
      })
      .catch((err) => {
        console.error('Could not load members:', err)
        if (!cancelled) {
          setError(
            err.message ||
              'Could not load people. Check your Appwrite configuration and permissions.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Load the services once; the attendance is loaded per selected period.
  useEffect(() => {
    let cancelled = false

    async function loadServices() {
      try {
        const rows = await listServices()
        if (!cancelled) setServices(rows)
      } catch (err) {
        console.error('Could not load services:', err)
        if (!cancelled) {
          setServicesError(err.message || 'Could not load the services.')
        }
      } finally {
        if (!cancelled) setServicesLoaded(true)
      }
    }

    loadServices()

    return () => {
      cancelled = true
    }
  }, [])

  // Services held in the selected period, oldest first
  const periodServices = useMemo(
    () => (range.valid ? servicesInRange(services, range.start, range.end) : []),
    [services, range]
  )

  const {
    attendanceById,
    ready,
    error: attendanceError,
    retry,
  } = useServicesAttendance(periodServices)

  // 'ready' | 'loading' | 'unavailable' (invalid period or loading failed)
  const regularityStatus =
    !range.valid || servicesError || (attendanceError && !ready)
      ? 'unavailable'
      : servicesLoaded && ready
        ? 'ready'
        : 'loading'

  const regularityReady = regularityStatus === 'ready'
  const periodTotal = periodServices.length

  // memberId -> number of services attended in the period
  const attendedByMember = useMemo(() => {
    const counts = new Map()

    for (const service of periodServices) {
      for (const record of attendanceById[service.$id] ?? []) {
        counts.set(record.memberId, (counts.get(record.memberId) ?? 0) + 1)
      }
    }

    return counts
  }, [periodServices, attendanceById])

  // One row per person, with the regularity level (members only)
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

  const levelSelected = LEVELS_BY_ID[filter] ? filter : null

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()

    return rows.filter(({ person, levelId }) => {
      const isVisitor = person.person_type === 'visitor'

      if (filter === 'member' && isVisitor) return false
      if (filter === 'visitor' && !isVisitor) return false
      if (levelSelected && levelId !== levelSelected) return false

      return [
        person.name,
        person.email,
        person.phone,
        person.person_type,
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(term)
      )
    })
  }, [rows, search, filter, levelSelected])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE)
  )

  // Stay on a valid page (e.g. after deleting the last person of a page)
  const currentPage = Math.min(page, totalPages)

  const visibleRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  // The Regularity column makes no sense when only visitors are shown
  const showRegularity = filter !== 'visitor'
  const columnCount = showRegularity ? 8 : 7

  let emptyMessage = 'No people to display yet. Click "+ Add person" to begin.'

  if (levelSelected && regularityStatus === 'loading') {
    emptyMessage = 'Loading regularity...'
  } else if (levelSelected && regularityStatus === 'unavailable') {
    emptyMessage = 'Regularity is not available for the selected period.'
  } else if (levelSelected && periodTotal === 0) {
    emptyMessage =
      'No services were recorded in this period, so there are no regularity levels.'
  } else if (search || filter !== 'all') {
    emptyMessage = 'No matching people found.'
  }

  // ---------- PDF ----------

  const pdfKind =
    filter === 'visitor'
      ? 'Visitors'
      : filter === 'member' || levelSelected
        ? 'Members'
        : 'Members & Visitors'

  const pdfWithAttendance = regularityReady && periodTotal > 0

  const pdfRows = useMemo(
    () => (exportJob ? [...filteredRows].sort(byName) : []),
    [exportJob, filteredRows]
  )

  const pdfFilterSummary = [
    `Category: ${pdfKind === 'Members & Visitors' ? 'Members and visitors' : pdfKind}`,
    levelSelected
      ? `Regularity: ${LEVELS_BY_ID[levelSelected].label} (${LEVELS_BY_ID[levelSelected].rule})`
      : null,
    search.trim() ? `Search: "${search.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(' - ')

  const canDownload =
    !loading &&
    !exportJob &&
    filteredRows.length > 0 &&
    regularityStatus !== 'loading'

  function handleDownloadPDF() {
    if (!canDownload) return

    setPdfError('')

    setExportJob({
      filename: `${pdfKind.replace(/ & /g, '-and-').replace(/ /g, '-')}-${toInputDate(new Date())}.pdf`,
    })
  }

  // The report is rendered off screen only while the PDF is generated
  useEffect(() => {
    if (!exportJob) return

    downloadElementAsPDF(pdfRef.current, exportJob.filename, {
      pageNumbers: true,
    })
      .catch((err) => {
        console.error('Could not generate PDF:', err)
        setPdfError(
          'Could not generate the PDF. Please try again or check the browser console.'
        )
      })
      .finally(() => setExportJob(null))
  }, [exportJob])

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

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
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

  function handleFilterChange(event) {
    setFilter(event.target.value)
    setPage(1)
  }

  const selectClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600'

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#142D4E]">
            Members & Visitors
          </h1>
          <p className="mt-1 text-slate-500">
            Manage people in your church community and follow their attendance.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add person
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
        >
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {pdfError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {pdfError}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <h2 className="text-lg font-semibold text-[#142D4E]">
            {editingId ? 'Edit person' : 'Add a person'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Full name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                maxLength={255}
                placeholder="Enter full name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Category *
              <select
                name="person_type"
                value={form.person_type}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-600"
              >
                <option value="member">Member</option>
                <option value="visitor">Visitor</option>
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600"
                placeholder="name@example.com"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Phone
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                maxLength={30}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-600"
                placeholder="Phone number"
              />
            </label>
          </div>

          <p className="text-xs text-slate-500">
            Fields marked with * are required.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Save changes'
                  : 'Add person'}
            </button>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="search"
            value={search}
            onChange={handleSearch}
            placeholder="Search name, email or phone..."
            aria-label="Search name, email or phone"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 sm:max-w-md"
          />

          <span className="text-sm text-slate-500">
            {filteredRows.length} people
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-start gap-4">
            <div>
              <label
                htmlFor="people-filter"
                className="mb-1 block text-xs text-slate-600"
              >
                Show
              </label>
              <select
                id="people-filter"
                value={filter}
                onChange={handleFilterChange}
                className={selectClass}
              >
                <optgroup label="Category">
                  {CATEGORY_FILTERS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Regularity (members only)">
                  {LEVELS.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <PeriodPicker
              period={period}
              variant="select"
              idPrefix="members-period"
              label="Attendance period"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={!canDownload}
            className="mt-5 flex items-center gap-2 rounded-lg bg-[#142D4E] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1d416c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={18} />
            {exportJob ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>

        {(servicesError || attendanceError) && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <span>
              Regularity could not be loaded: {servicesError || attendanceError}
            </span>
            {!servicesError && (
              <button
                type="button"
                onClick={retry}
                className="rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100"
              >
                Try again
              </button>
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          {!range.valid
            ? 'Choose a valid period to see attendance and regularity.'
            : regularityReady && periodTotal === 0
              ? 'No services were recorded in this period.'
              : `Rate = services attended / ${
                  regularityReady ? periodTotal : 'the'
                } service(s) held in the period. ${LEVELS.map(
                  (level) => `${level.label}: ${level.rule}`
                ).join(' · ')}.`}
          {regularityReady && periodTotal > 0 && periodTotal < 4
            ? ' Only a few services: the levels are only indicative.'
            : ''}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-4">Name</th>
                <th className="px-3 py-4">Email</th>
                <th className="px-3 py-4">Phone</th>
                <th className="px-3 py-4">Category</th>
                <th className="px-3 py-4">Status</th>
                <th className="px-3 py-4">Attendance</th>
                {showRegularity && <th className="px-3 py-4">Regularity</th>}
                <th className="px-3 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    Loading people...
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                visibleRows.map(({ person, attended, levelId }) => {
                  const level = levelId ? LEVELS_BY_ID[levelId] : null

                  return (
                    <tr key={person.$id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-4 font-medium text-[#142D4E]">
                        {person.name}
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {person.email || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-slate-600">
                        {person.phone || '—'}
                      </td>
                      <td className="px-3 py-4">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium capitalize text-blue-700">
                          {person.person_type || 'member'}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <span className="text-xs text-slate-600">
                          {person.status || 'active'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-slate-600">
                        {regularityStatus === 'unavailable'
                          ? '—'
                          : regularityStatus === 'loading'
                            ? '…'
                            : periodTotal === 0
                              ? '—'
                              : `${attended} / ${periodTotal}`}
                      </td>
                      {showRegularity && (
                        <td className="whitespace-nowrap px-3 py-4">
                          {regularityStatus === 'loading' ? (
                            <span className="text-slate-400">…</span>
                          ) : level ? (
                            <>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${level.badge}`}
                              >
                                {level.label}
                              </span>
                              <span className="ml-2 text-xs text-slate-500">
                                {Math.round((attended / periodTotal) * 100)}%
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center gap-1">
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
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            Page {currentPage} of {totalPages}
            {filteredRows.length > 0 &&
              ` · Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                currentPage * PAGE_SIZE,
                filteredRows.length
              )} of ${filteredRows.length}`}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {exportJob && (
        // Off-screen copy used only to build the PDF
        <div
          aria-hidden="true"
          style={{ position: 'fixed', left: '-10000px', top: 0, width: '780px' }}
        >
          <MembersPdfReport
            ref={pdfRef}
            title={pdfKind}
            filterSummary={pdfFilterSummary}
            periodLabel={pdfWithAttendance ? range.label : ''}
            rows={pdfRows}
            periodTotal={periodTotal}
            showAttendance={pdfWithAttendance}
            showRegularity={pdfWithAttendance && filter !== 'visitor'}
          />
        </div>
      )}
    </section>
  )
}