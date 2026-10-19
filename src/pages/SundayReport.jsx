import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, Search, UserPlus } from 'lucide-react'

import { getMembers, createMember } from '../lib/membersService'

import {
  getOrCreateService,
  getServiceByDate,
  getAttendanceForService,
  saveAttendance,
  removeUncheckedAttendance,
} from '../lib/attendanceService'

const PRESENCE_TYPES = ['In person', 'Online']

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'member', label: 'Members' },
  { id: 'visitor', label: 'Visitors' },
]

// Today's date in local time, formatted YYYY-MM-DD
function todayLocal() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function SundayReport() {
  // Service information
  const [serviceDate, setServiceDate] = useState(todayLocal)
  const [preacher, setPreacher] = useState('')
  const [sermonTitle, setSermonTitle] = useState('')
  const [keyPoints, setKeyPoints] = useState('')

  // People and attendance
  const [people, setPeople] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [existingServiceId, setExistingServiceId] = useState(null)

  // selection = { [memberId]: 'In person' | 'Online' }
  // A person is present when their id is a key of this object.
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

  // Prevent repeated actions from rapid clicks
  const submittingRef = useRef(false)
  const addingRef = useRef(false)

  const busy = saving || adding || membersLoading || reportLoading

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-600 disabled:opacity-60'

  const smallInputClass =
    'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-600 disabled:bg-gray-50 disabled:text-gray-400'

  const labelClass = 'mb-2 block text-sm font-medium text-gray-700'

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
          setPreacher('')
          setSermonTitle('')
          setKeyPoints('')
          setSelection({})
          return
        }

        const records = await getAttendanceForService(service.$id)
        if (cancelled) return

        setExistingServiceId(service.$id)
        setPreacher(service.preacher_name ?? '')
        setSermonTitle(service.sermon_title ?? '')
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
      // Show the existing person so the secretary can tick them
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

    if (presentCount === 0) {
      showMessage(
        'Please tick at least one person before saving the report.',
        'error'
      )
      return
    }

    // Lock the submission before starting asynchronous work
    submittingRef.current = true
    setSaving(true)
    showMessage('')

    try {
      const serviceId = await getOrCreateService({
        serviceDate,
        preacherName: preacher,
        sermonTitle,
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sunday Report</h1>
        <p className="mt-1 text-sm text-gray-500">
          Record the details of your Sunday service.
        </p>
      </div>

      {reportLoading && (
        <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
          Loading the report for this date...
        </p>
      )}

      {existingServiceId && !reportLoading && (
        <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
          A report already exists for this date. You are editing it.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        onKeyDown={blockEnterSubmit}
        className="space-y-6"
      >
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">
            Service Information
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="service-date" className={labelClass}>
                Service Date
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

            <div>
              <label htmlFor="preacher" className={labelClass}>
                Preacher's Name
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

            <div className="md:col-span-2">
              <label htmlFor="sermon-title" className={labelClass}>
                Sermon Title
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

            <div className="md:col-span-2">
              <label htmlFor="key-points" className={labelClass}>
                Key Points
              </label>
              <textarea
                id="key-points"
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                placeholder="Write the main points of the sermon..."
                rows={4}
                className={inputClass}
                disabled={saving || reportLoading}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Attendance
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {presentCount} present ({inPersonCount} in person,{' '}
                {onlineCount} online)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Filter by category"
                className="flex overflow-hidden rounded-lg border border-gray-200"
              >
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    aria-pressed={filter === item.id}
                    className={`px-3 py-2 text-sm ${
                      filter === item.id
                        ? 'bg-blue-900 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="relative">
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
                  className={`${smallInputClass} w-48 pl-9`}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 max-h-[32rem] overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-gray-500">
                <tr>
                  <th className="w-20 px-4 py-3 font-medium">Present</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Attendance type</th>
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

                    return (
                      <tr
                        key={person.$id}
                        className={present ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      >
                        <td className="px-4 py-3">
                          <input
                            id={`present-${person.$id}`}
                            type="checkbox"
                            checked={present}
                            onChange={() => togglePresent(person.$id)}
                            disabled={busy}
                            aria-label={`${person.name} was present`}
                            className="h-5 w-5 cursor-pointer accent-blue-900"
                          />
                        </td>

                        <td className="px-4 py-3 font-medium text-gray-800">
                          <label
                            htmlFor={`present-${person.$id}`}
                            className="block cursor-pointer"
                          >
                            {person.name}
                          </label>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs ${
                              isVisitor
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-blue-50 text-blue-800'
                            }`}
                          >
                            {isVisitor ? 'Visitor' : 'Member'}
                          </span>
                        </td>

                        <td className="px-4 py-3">
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
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Not in the list? Add a person
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              The person is saved in Members &amp; Visitors and marked as
              present.
            </p>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="new-name" className="mb-1 block text-xs text-gray-600">
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

              <div>
                <label htmlFor="new-category" className="mb-1 block text-xs text-gray-600">
                  Category
                </label>
                <select
                  id="new-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  disabled={busy}
                  className={smallInputClass}
                >
                  <option value="visitor">Visitor</option>
                  <option value="member">Member</option>
                </select>
              </div>

              <div>
                <label htmlFor="new-presence" className="mb-1 block text-xs text-gray-600">
                  Attendance type
                </label>
                <select
                  id="new-presence"
                  value={newPresence}
                  onChange={(e) => setNewPresence(e.target.value)}
                  disabled={busy}
                  className={smallInputClass}
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
                className="flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus size={16} />
                {adding ? 'Adding...' : 'Add person'}
              </button>
            </div>
          </div>
        </section>

        {message && (
          <p
            role="status"
            className={`rounded-lg p-4 text-sm ${
              messageType === 'error'
                ? 'bg-red-50 text-red-800'
                : messageType === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-blue-50 text-blue-900'
            }`}
          >
            {message}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Saving report...' : 'Save report'}
          </button>
        </div>
      </form>
    </div>
  )
}