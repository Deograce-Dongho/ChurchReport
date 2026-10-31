import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  FileText,
  Globe,
  Save,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'

import { getMembers, createMember } from '../lib/membersService'
import RichTextEditor from '../components/RichTextEditor'
import {
  getOrCreateService,
  getServiceByDate,
  getAttendanceForService,
  saveAttendance,
  removeUncheckedAttendance,
} from '../lib/attendanceService'
import {
  KEY_POINTS_MAX,
  KEY_POINTS_WARN_RATIO,
} from '../lib/constants'

const CAMPUS_NAME = 'Gemeinde Giessen'

const PRESENCE_TYPES = ['In person', 'Online']

const SERVICE_TYPES = [
  'Main Sunday Morning Service',
  'Sunday Evening Service',
  'Special Service',
]

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'member', label: 'Members' },
  { id: 'visitor', label: 'Visitors' },
]

const numberFormat = new Intl.NumberFormat('en-GB')

// Today's date in local time, formatted YYYY-MM-DD
function todayLocal() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function timeLabel(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// Fields are at least 44 px tall and use 16 px text on a phone.
const inputClass =
  'min-h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-base text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 disabled:bg-gray-50 disabled:opacity-60 sm:text-sm'

const smallInputClass =
  'min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2 text-base text-gray-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 disabled:bg-gray-50 disabled:text-gray-500 sm:text-sm'

const labelClass =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500'

const cardClass =
  'overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm'

function Required() {
  return <span className="text-red-500"> *</span>
}

function SectionHeader({ icon: Icon, title, step, total }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon size={18} />
        </span>
        <h2 className="text-base font-semibold text-brand-900">{title}</h2>
      </div>
      <span className="text-xs text-gray-400">
        Step {step} of {total}
      </span>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    blue: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    gray: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none tabular-nums text-gray-900">
          {value}
        </p>
        <p className="mt-1 truncate text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function SundayReport() {
  // Service information
  const [serviceDate, setServiceDate] = useState(todayLocal)
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0])
  const [preacher, setPreacher] = useState('')
  const [sermonTitle, setSermonTitle] = useState('')
  const [scripture, setScripture] = useState('')
  const [keyPoints, setKeyPoints] = useState('')

  // People and attendance
  const [people, setPeople] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [existingServiceId, setExistingServiceId] = useState(null)

  // selection = { [memberId]: 'In person' | 'Online' }
  const [selection, setSelection] = useState({})

  // Table controls
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  // "Add a person" form
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('visitor')
  const [newPresence, setNewPresence] = useState('In person')
  const [adding, setAdding] = useState(false)

  // Feedback
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(null)

  // Prevent repeated actions from rapid clicks
  const submittingRef = useRef(false)
  const addingRef = useRef(false)

  // Key Points size against the Appwrite limit
  const keyPointsLength = keyPoints.length
  const keyPointsOverLimit = keyPointsLength > KEY_POINTS_MAX
  const keyPointsNearLimit =
    !keyPointsOverLimit &&
    keyPointsLength >= KEY_POINTS_MAX * KEY_POINTS_WARN_RATIO
  const keyPointsRemaining = KEY_POINTS_MAX - keyPointsLength

  const busy = saving || adding || membersLoading || reportLoading

  function showMessage(text, type = 'info') {
    setMessage(text)
    setMessageType(type)
  }

  // Load all people from Appwrite
  useEffect(() => {
    let cancelled = false

    async function loadPeople() {
      try {
        const data = await getMembers()
        if (!cancelled) setPeople(data)
      } catch (error) {
        console.error('Could not load church members:', error)
        if (!cancelled) {
          showMessage(
            'Could not load members. Please check Appwrite permissions.',
            'error'
          )
        }
      } finally {
        if (!cancelled) setMembersLoading(false)
      }
    }

    loadPeople()

    return () => {
      cancelled = true
    }
  }, [])

  // Load the saved report of the selected date, if there is one
  useEffect(() => {
    if (!serviceDate) return

    let cancelled = false

    async function loadReport() {
      setReportLoading(true)
      showMessage('')

      try {
        const service = await getServiceByDate(serviceDate)
        if (cancelled) return

        if (!service) {
          setExistingServiceId(null)
          setServiceType(SERVICE_TYPES[0])
          setPreacher('')
          setSermonTitle('')
          setScripture('')
          setKeyPoints('')
          setSelection({})
          return
        }

        const records = await getAttendanceForService(service.$id)
        if (cancelled) return

        setExistingServiceId(service.$id)
        setServiceType(service.service_type || SERVICE_TYPES[0])
        setPreacher(service.preacher_name ?? '')
        setSermonTitle(service.sermon_title ?? '')
        setScripture(service.scripture_reference ?? '')
        setKeyPoints(service.sermon_key_points ?? '')
        setSelection(
          Object.fromEntries(
            records.map((record) => [record.memberId, record.presenceType])
          )
        )
      } catch (error) {
        console.error('Could not load the report:', error)
        if (!cancelled) {
          showMessage(
            error.message || 'Could not load the report for this date.',
            'error'
          )
        }
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    }

    loadReport()

    return () => {
      cancelled = true
    }
  }, [serviceDate])

  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.$id, person])),
    [people]
  )

  // Alphabetical list, filtered by category and search
  const visiblePeople = useMemo(() => {
    const term = search.trim().toLowerCase()

    return people
      .filter(
        (person) =>
          filter === 'all' || (person.person_type ?? 'member') === filter
      )
      .filter(
        (person) => !term || (person.name ?? '').toLowerCase().includes(term)
      )
      .sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', undefined, {
          sensitivity: 'base',
        })
      )
  }, [people, filter, search])

  const presentCount = Object.keys(selection).length
  const inPersonCount = Object.values(selection).filter(
    (type) => type === 'In person'
  ).length
  const onlineCount = presentCount - inPersonCount

  const presentMembers = Object.keys(selection).filter(
    (id) => (peopleById.get(id)?.person_type ?? 'member') === 'member'
  ).length
  const presentVisitors = presentCount - presentMembers

  // True when every person currently shown in the table is ticked
  const allVisiblePresent =
    visiblePeople.length > 0 &&
    visiblePeople.every((person) => Object.hasOwn(selection, person.$id))

  function togglePresent(memberId) {
    setSelection((current) => {
      const next = { ...current }

      if (Object.hasOwn(next, memberId)) {
        delete next[memberId]
      } else {
        next[memberId] = 'In person'
      }

      return next
    })
  }

  // Tick (or untick) everyone currently shown in the table.
  function toggleAllVisible() {
    setSelection((current) => {
      const next = { ...current }

      if (allVisiblePresent) {
        visiblePeople.forEach((person) => delete next[person.$id])
      } else {
        visiblePeople.forEach((person) => {
          if (!Object.hasOwn(next, person.$id)) {
            next[person.$id] = 'In person'
          }
        })
      }

      return next
    })
  }

  function changePresenceType(memberId, type) {
    setSelection((current) => ({ ...current, [memberId]: type }))
  }

  // Create a new member or visitor and mark them as present
  async function addPerson() {
    if (addingRef.current || submittingRef.current) return

    const cleanName = newName.trim().replace(/\s+/g, ' ')

    if (!cleanName) {
      showMessage('Please enter a name.', 'error')
      return
    }

    const duplicate = people.some(
      (person) =>
        (person.name ?? '').trim().toLowerCase() === cleanName.toLowerCase()
    )

    if (duplicate) {
      setFilter('all')
      setSearch(cleanName)
      showMessage(
        `"${cleanName}" is already in the list. Tick them in the table, or change the name if this is a different person.`,
        'error'
      )
      return
    }

    addingRef.current = true
    setAdding(true)
    showMessage('')

    try {
      const created = await createMember({
        name: cleanName,
        person_type: newCategory,
      })

      setPeople((current) => [...current, created])
      setSelection((current) => ({ ...current, [created.$id]: newPresence }))

      setFilter('all')
      setSearch('')
      setNewName('')
      setNewCategory('visitor')
      setNewPresence('In person')

      showMessage(`${created.name} was added and marked as present.`, 'success')
    } catch (error) {
      console.error('Could not add person:', error)
      showMessage(error.message || 'Could not add this person.', 'error')
    } finally {
      addingRef.current = false
      setAdding(false)
    }
  }

  // Save the service and all attendance records
  async function handleSubmit(event) {
    event.preventDefault()

    if (submittingRef.current || addingRef.current || busy) return

    if (!serviceDate || !preacher.trim() || !sermonTitle.trim()) {
      showMessage(
        "Please complete the service date, preacher's name and sermon title.",
        'error'
      )
      return
    }

    if (keyPointsOverLimit) {
      showMessage(
        `The key points are too long (${numberFormat.format(
          keyPointsLength
        )} / ${numberFormat.format(
          KEY_POINTS_MAX
        )} characters). Please shorten them by ${numberFormat.format(
          -keyPointsRemaining
        )} characters before saving.`,
        'error'
      )
      return
    }

    if (presentCount === 0) {
      showMessage(
        'Please tick at least one person before saving the report.',
        'error'
      )
      return
    }

    submittingRef.current = true
    setSaving(true)
    showMessage('')

    try {
      const serviceId = await getOrCreateService({
        serviceDate,
        serviceType,
        preacherName: preacher,
        sermonTitle,
        scriptureReference: scripture,
        keyPoints,
      })

      const counts = { created: 0, updated: 0, unchanged: 0 }
      const failed = []

      for (const [memberId, presenceType] of Object.entries(selection)) {
        const person = peopleById.get(memberId)
        if (!person) continue

        try {
          const result = await saveAttendance({
            serviceId,
            memberId,
            presenceType,
          })

          if (Object.hasOwn(counts, result.status)) {
            counts[result.status]++
          } else {
            throw new Error(`Unexpected attendance status: ${result.status}`)
          }
        } catch (error) {
          console.error(`Could not save attendance for ${person.name}:`, error)
          failed.push(person.name)
        }
      }

      // Remove records of people who were unticked
      let removed = 0
      let removalFailed = false

      try {
        const result = await removeUncheckedAttendance(
          serviceId,
          Object.keys(selection)
        )
        removed = result.removed
        removalFailed = result.failed > 0
      } catch (error) {
        console.error('Could not remove unticked attendance:', error)
        removalFailed = true
      }

      setExistingServiceId(serviceId)

      const summary =
        `${counts.created} added, ` +
        `${counts.updated} updated, ` +
        `${counts.unchanged} unchanged, ` +
        `${removed} removed.`

      if (failed.length > 0 || removalFailed) {
        const problems = [
          failed.length > 0 ? `Failed: ${failed.join(', ')}.` : '',
          removalFailed ? 'Some unticked people could not be removed.' : '',
        ]
          .filter(Boolean)
          .join(' ')

        showMessage(
          `Service saved. ${summary} ${problems} Click "Save report" again to retry.`,
          'error'
        )
      } else {
        setLastSavedAt(new Date())
        showMessage(`Report saved. ${summary}`, 'success')
      }
    } catch (error) {
      console.error('Could not save Sunday report:', error)
      showMessage(
        error.message || 'Could not save the report. Please try again.',
        'error'
      )
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
  }

  // Enter must not submit the whole report from a text field
  function blockEnterSubmit(event) {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
      event.preventDefault()
    }
  }

  const counterTone = keyPointsOverLimit
    ? 'text-red-700'
    : keyPointsNearLimit
      ? 'text-amber-700'
      : 'text-gray-500'

  const saveButton = (
    <button
      type="submit"
      form="sunday-report-form"
      disabled={busy || keyPointsOverLimit}
      className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {saving ? <Save size={16} /> : <Check size={16} />}
      {saving ? 'Saving report...' : 'Save report'}
    </button>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 sm:pb-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Sunday Report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Record the details of your Sunday service, attendance metrics and
            notes.
          </p>
        </div>

        <div className="hidden items-center gap-2 sm:flex print:hidden">
          {saveButton}
        </div>
      </div>

      {/* Campus card */}
      <div className={`${cardClass} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Building2 size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">
                {CAMPUS_NAME}
              </p>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                Active campus
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Service registration &amp; attendance tracking
            </p>
          </div>
        </div>

        <p className="flex items-center gap-2 text-xs text-gray-500">
          <span
            className={`h-2 w-2 rounded-full ${
              saving
                ? 'animate-pulse bg-amber-500'
                : existingServiceId || lastSavedAt
                  ? 'bg-green-500'
                  : 'bg-gray-300'
            }`}
          />
          {saving
            ? 'Saving...'
            : lastSavedAt
              ? `Saved at ${timeLabel(lastSavedAt)}`
              : existingServiceId
                ? 'Report exists for this date'
                : 'Not saved yet'}
        </p>
      </div>

      {reportLoading && (
        <p className="rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
          Loading the report for this date...
        </p>
      )}

      {existingServiceId && !reportLoading && (
        <p className="rounded-lg bg-brand-50 p-4 text-sm text-brand-900">
          A report already exists for this date. You are editing it.
        </p>
      )}

      <form
        id="sunday-report-form"
        onSubmit={handleSubmit}
        onKeyDown={blockEnterSubmit}
        className="space-y-5"
      >
        {/* Step 1 */}
        <section className={cardClass}>
          <SectionHeader
            icon={CalendarDays}
            title="Service Information"
            step={1}
            total={2}
          />

          <div className="grid gap-5 p-4 sm:grid-cols-3 sm:p-6">
            <div className="min-w-0">
              <label htmlFor="service-date" className={labelClass}>
                Service date
                <Required />
              </label>
              <input
                id="service-date"
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className={inputClass}
                required
                disabled={saving}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="service-type" className={labelClass}>
                Service type
                <Required />
              </label>
              <select
                id="service-type"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className={inputClass}
                disabled={saving || reportLoading}
              >
                {SERVICE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label htmlFor="preacher" className={labelClass}>
                Preacher's name
                <Required />
              </label>
              <input
                id="preacher"
                value={preacher}
                onChange={(e) => setPreacher(e.target.value)}
                placeholder="Enter preacher's name"
                className={inputClass}
                required
                disabled={saving || reportLoading}
              />
            </div>

            <div className="min-w-0 sm:col-span-2">
              <label htmlFor="sermon-title" className={labelClass}>
                Sermon title
                <Required />
              </label>
              <input
                id="sermon-title"
                value={sermonTitle}
                onChange={(e) => setSermonTitle(e.target.value)}
                placeholder="Enter the sermon title"
                className={inputClass}
                required
                disabled={saving || reportLoading}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="scripture" className={labelClass}>
                Scripture reference
              </label>
              <input
                id="scripture"
                value={scripture}
                onChange={(e) => setScripture(e.target.value)}
                placeholder="e.g. John 8:31-36"
                className={inputClass}
                disabled={saving || reportLoading}
              />
            </div>

            <div className="min-w-0 sm:col-span-3">
              <label htmlFor="key-points" className={labelClass}>
                Key points &amp; sermon summary
              </label>
              <RichTextEditor
                id="key-points"
                value={keyPoints}
                onChange={setKeyPoints}
                placeholder="Write the main points of the sermon..."
                rows={4}
                maxLength={KEY_POINTS_MAX}
                className={inputClass}
                disabled={saving || reportLoading}
              />

              {/* Character counter (Appwrite limit) */}
              <div
                id="key-points-counter"
                role="status"
                aria-live="polite"
                className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs"
              >
                <span className={keyPointsOverLimit || keyPointsNearLimit ? `font-medium ${counterTone}` : 'text-gray-500'}>
                  {keyPointsOverLimit
                    ? `${numberFormat.format(
                        -keyPointsRemaining
                      )} characters over the limit. Please shorten the text.`
                    : keyPointsNearLimit
                      ? `Almost at the limit: ${numberFormat.format(
                          keyPointsRemaining
                        )} characters left.`
                      : 'Formatting also counts toward the limit.'}
                </span>

                <span className={`font-medium tabular-nums ${counterTone}`}>
                  {numberFormat.format(keyPointsLength)} /{' '}
                  {numberFormat.format(KEY_POINTS_MAX)} characters
                </span>
              </div>

              {/* Thin progress bar */}
              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    keyPointsOverLimit
                      ? 'bg-red-500'
                      : keyPointsNearLimit
                        ? 'bg-amber-500'
                        : 'bg-brand-600'
                  }`}
                  style={{
                    width: `${Math.min(
                      (keyPointsLength / KEY_POINTS_MAX) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Step 2 */}
        <section className={cardClass}>
          <SectionHeader icon={Users} title="Attendance" step={2} total={2} />

          <div className="space-y-5 p-4 sm:p-6">
            {/* Live stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={UserCheck} label="Present" value={presentCount} />
              <StatCard
                icon={Building2}
                label="In person"
                value={inPersonCount}
                tone="blue"
              />
              <StatCard
                icon={Globe}
                label="Online"
                value={onlineCount}
                tone="gray"
              />
              <StatCard
                icon={Users}
                label={`Members · ${presentVisitors} visitors`}
                value={presentMembers}
                tone="amber"
              />
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  disabled={busy || visiblePeople.length === 0}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  <CheckCheck size={16} />
                  {allVisiblePresent ? 'Clear all' : 'Select all'}
                </button>

                <div
                  role="group"
                  aria-label="Filter by category"
                  className="flex w-full overflow-hidden rounded-lg border border-gray-200 sm:w-auto"
                >
                  {FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      aria-pressed={filter === item.id}
                      className={`min-h-11 flex-1 px-4 py-2 text-sm font-medium transition sm:flex-none ${
                        filter === item.id
                          ? 'bg-brand-900 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative w-full lg:w-64">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search a name..."
                  aria-label="Search a name"
                  className={`${smallInputClass} w-full pl-9`}
                />
              </div>
            </div>

            {/* Table */}
            <div className="max-h-[32rem] overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-14 px-2 py-3 font-semibold sm:w-20 sm:px-4">
                      Present
                    </th>
                    <th className="px-2 py-3 font-semibold sm:px-4">Name</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">
                      Category
                    </th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">
                      Attendance type
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {membersLoading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-gray-500"
                      >
                        Loading people...
                      </td>
                    </tr>
                  ) : visiblePeople.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-gray-500"
                      >
                        {people.length === 0
                          ? 'No people yet. Add the first one below.'
                          : 'No matching people. Change the filter or add this person below.'}
                      </td>
                    </tr>
                  ) : (
                    visiblePeople.map((person) => {
                      const present = Object.hasOwn(selection, person.$id)
                      const isVisitor = person.person_type === 'visitor'

                      const presenceSelect = (
                        <select
                          value={selection[person.$id] ?? 'In person'}
                          onChange={(e) =>
                            changePresenceType(person.$id, e.target.value)
                          }
                          disabled={!present || busy}
                          aria-label={`Attendance type for ${person.name}`}
                          className={smallInputClass}
                        >
                          {PRESENCE_TYPES.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>
                      )

                      const categoryBadge = (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            isVisitor
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-brand-50 text-brand-800'
                          }`}
                        >
                          {isVisitor ? 'Visitor' : 'Member'}
                        </span>
                      )

                      return (
                        <tr
                          key={person.$id}
                          className={`transition-colors ${
                            present ? 'bg-brand-50/70' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-2 py-1 align-top sm:px-4 sm:align-middle">
                            <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                              <input
                                id={`present-${person.$id}`}
                                type="checkbox"
                                checked={present}
                                onChange={() => togglePresent(person.$id)}
                                disabled={busy}
                                aria-label={`${person.name} was present`}
                                className="h-5 w-5 cursor-pointer accent-brand-600"
                              />
                            </label>
                          </td>

                          <td className="px-2 py-2 font-medium text-gray-800 sm:px-4 sm:py-3">
                            <label
                              htmlFor={`present-${person.$id}`}
                              className="block min-h-6 cursor-pointer break-words"
                            >
                              {person.name}
                            </label>

                            <div className="mt-2 space-y-2 sm:hidden">
                              <div>{categoryBadge}</div>
                              <div className="max-w-[10rem]">
                                {presenceSelect}
                              </div>
                            </div>
                          </td>

                          <td className="hidden px-4 py-3 sm:table-cell">
                            {categoryBadge}
                          </td>

                          <td className="hidden px-4 py-3 sm:table-cell">
                            {presenceSelect}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Add a person */}
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Not in the list? Add a person
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                The person is saved in Members &amp; Visitors and marked as
                present.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto] lg:items-end">
                <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                  <label
                    htmlFor="new-name"
                    className="mb-1 block text-xs text-gray-600"
                  >
                    Full name
                  </label>
                  <input
                    id="new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addPerson()
                    }}
                    placeholder="Enter full name"
                    maxLength={255}
                    disabled={busy}
                    className={`${smallInputClass} w-full`}
                  />
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-category"
                    className="mb-1 block text-xs text-gray-600"
                  >
                    Category
                  </label>
                  <select
                    id="new-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    disabled={busy}
                    className={`${smallInputClass} w-full`}
                  >
                    <option value="visitor">Visitor</option>
                    <option value="member">Member</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="new-presence"
                    className="mb-1 block text-xs text-gray-600"
                  >
                    Attendance type
                  </label>
                  <select
                    id="new-presence"
                    value={newPresence}
                    onChange={(e) => setNewPresence(e.target.value)}
                    disabled={busy}
                    className={`${smallInputClass} w-full`}
                  >
                    {PRESENCE_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={addPerson}
                  disabled={busy}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:col-span-1"
                >
                  <UserPlus size={16} />
                  {adding ? 'Adding...' : 'Add person'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {message && (
          <p
            role="status"
            className={`break-words rounded-lg border p-4 text-sm ${
              messageType === 'error'
                ? 'border-red-100 bg-red-50 text-red-800'
                : messageType === 'success'
                  ? 'border-green-100 bg-green-50 text-green-800'
                  : 'border-brand-100 bg-brand-50 text-brand-900'
            }`}
          >
            {message}
          </p>
        )}
      </form>

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden print:hidden">
        <div className="min-w-0 flex-1 text-xs text-gray-500">
          <span className="block text-sm font-semibold text-gray-900">
            {presentCount} present
          </span>
          {inPersonCount} in person · {onlineCount} online
        </div>
        {saveButton}
      </div>
    </div>
  )
}