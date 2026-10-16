
import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Save, X, Check } from 'lucide-react'

import { getMembers, createMember } from '../lib/membersService'
import {
  getOrCreateService,
  createAttendance,
} from '../lib/attendanceService'

export default function SundayReport() {
  const [serviceDate, setServiceDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [preacher, setPreacher] = useState('')
  const [sermonTitle, setSermonTitle] = useState('')
  const [keyPoints, setKeyPoints] = useState('')

  const [churchMembers, setChurchMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [attendees, setAttendees] = useState([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [attendanceType, setAttendanceType] = useState('In person')
  const [visitorName, setVisitorName] = useState('')

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('In person')

  const inputClass =
    'w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-600'

  const labelClass = 'mb-2 block text-sm font-medium text-gray-700'

  async function loadChurchMembers() {
    setMembersLoading(true)

    try {
      const data = await getMembers()
      setChurchMembers(data)
    } catch (error) {
      console.error('Could not load church members:', error)
      setMessage('Could not load members. Please check Appwrite permissions.')
      setMessageType('error')
    } finally {
      setMembersLoading(false)
    }
  }

  useEffect(() => {
    loadChurchMembers()
  }, [])

  function showMessage(text, type = 'info') {
    setMessage(text)
    setMessageType(type)
  }

  async function addAttendee() {
    setMessage('')

    let member

    if (selectedMemberId === 'visitor') {
      if (!visitorName.trim()) {
        showMessage('Please enter the visitor name.', 'error')
        return
      }

      try {
        member = await createMember({
          name: visitorName.trim(),
          person_type: 'visitor',
        })

        setChurchMembers((current) => [...current, member])
        setSelectedMemberId(member.$id)
        setVisitorName('')
      } catch (error) {
        console.error('Could not create visitor:', error)
        showMessage(
          error.message || 'Could not save the visitor to Appwrite.',
          'error'
        )
        return
      }
    } else {
      member = churchMembers.find(
        (person) => person.$id === selectedMemberId
      )

      if (!member) {
        showMessage('Please select a member or visitor.', 'error')
        return
      }
    }

    const alreadyAdded = attendees.some(
      (person) => person.memberId === member.$id
    )

    if (alreadyAdded) {
      showMessage(`${member.name} has already been added.`, 'error')
      return
    }

    setAttendees((current) => [
      ...current,
      {
        id: `${member.$id}-${Date.now()}`,
        memberId: member.$id,
        name: member.name,
        type: attendanceType,
        isVisitor: member.person_type === 'visitor',
      },
    ])

    setSelectedMemberId('')
    setVisitorName('')
    setAttendanceType('In person')
    showMessage(`${member.name} added to the attendance list.`, 'success')
  }

  function startEditing(person) {
    setEditingId(person.id)
    setEditName(person.name)
    setEditType(person.type)
    setMessage('')
  }

  function cancelEditing() {
    setEditingId(null)
    setEditName('')
    setEditType('In person')
  }

  function saveEdit(id) {
    if (!editName.trim()) {
      showMessage('The attendee name cannot be empty.', 'error')
      return
    }

    setAttendees((current) =>
      current.map((person) =>
        person.id === id
          ? {
              ...person,
              name: editName.trim(),
              type: editType,
            }
          : person
      )
    )

    cancelEditing()
    showMessage('Attendance details updated.', 'success')
  }

  function removeAttendee(id) {
    setAttendees((current) =>
      current.filter((person) => person.id !== id)
    )

    if (editingId === id) {
      cancelEditing()
    }

    showMessage('Attendee removed from this report.', 'info')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!preacher.trim() || !sermonTitle.trim()) {
      showMessage(
        "Please complete the preacher's name and sermon title.",
        'error'
      )
      return
    }

    if (attendees.length === 0) {
      showMessage(
        'Please add at least one attendee before preparing the report.',
        'error'
      )
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const serviceId = await getOrCreateService({
        serviceDate,
        preacherName: preacher,
        sermonTitle,
        keyPoints,
      })

      let savedCount = 0
      const errors = []

      for (const person of attendees) {
        try {
          await createAttendance({
            serviceId,
            memberId: person.memberId,
            presenceType: person.type,
          })
          savedCount++
        } catch (error) {
          console.error(
            `Could not save attendance for ${person.name}:`,
            error
          )
          errors.push(person.name)
        }
      }

      if (errors.length > 0) {
        showMessage(
          `Service saved. ${savedCount} attendance record(s) saved. Could not save: ${errors.join(', ')}. Please check the Appwrite permissions and try again.`,
          'error'
        )
      } else {
        showMessage(
          `Report saved successfully! ${savedCount} attendance record(s) saved.`,
          'success'
        )
      }
    } catch (error) {
      console.error('Could not save Sunday report:', error)
      showMessage(
        error.message || 'Could not save the report. Please try again.',
        'error'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Sunday Report
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Record the details of your Sunday service.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-5 text-lg font-semibold text-gray-900">
            Service Information
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className={labelClass}>Service Date</label>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Preacher's Name</label>
              <input
                value={preacher}
                onChange={(e) => setPreacher(e.target.value)}
                placeholder="Enter preacher's name"
                className={inputClass}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Sermon Title</label>
              <input
                value={sermonTitle}
                onChange={(e) => setSermonTitle(e.target.value)}
                placeholder="Enter the sermon title"
                className={inputClass}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Key Points</label>
              <textarea
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                placeholder="Write the main points of the sermon..."
                rows={4}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Attendance
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {attendees.length} attendee(s) added
            </p>
          </div>

          <div className="grid items-end gap-4 md:grid-cols-[2fr_1fr]">
            <div>
              <label className={labelClass}>Select a Member</label>
              <select
                value={selectedMemberId}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value)
                  setMessage('')
                }}
                className={inputClass}
                disabled={membersLoading || saving}
              >
                <option value="">
                  {membersLoading ? 'Loading members...' : 'Choose a member...'}
                </option>

                {churchMembers.map((member) => (
                  <option key={member.$id} value={member.$id}>
                    {member.name}
                    {member.person_type === 'visitor' ? ' (Visitor)' : ''}
                  </option>
                ))}

                <option value="visitor">+ Add a new visitor</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Attendance Type</label>
              <select
                value={attendanceType}
                onChange={(e) => setAttendanceType(e.target.value)}
                className={inputClass}
                disabled={saving}
              >
                <option>In person</option>
                <option>Online</option>
              </select>
            </div>
          </div>

          {selectedMemberId === 'visitor' && (
            <div className="mt-4">
              <label className={labelClass}>Visitor's Name</label>
              <input
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Enter visitor's full name"
                className={inputClass}
                disabled={saving}
              />
            </div>
          )}

          <button
            type="button"
            onClick={addAttendee}
            disabled={membersLoading || saving}
            className="mt-4 flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={18} />
            Add Attendee
          </button>

          <div className="mt-6 space-y-3">
            {attendees.map((person) => (
              <div
                key={person.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                {editingId === person.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>
                        Correct Name
                      </label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputClass}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        Attendance Type
                      </label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        className={inputClass}
                      >
                        <option>In person</option>
                        <option>Online</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(person.id)}
                        className="flex items-center gap-2 rounded-lg bg-blue-900 px-3 py-2 text-sm text-white hover:bg-blue-800"
                      >
                        <Check size={16} />
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <X size={16} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-800">
                        {person.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-800">
                          {person.type}
                        </span>
                        <span className="text-xs text-gray-500">
                          {person.isVisitor ? 'Visitor' : 'Church member'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(person)}
                        aria-label={`Edit ${person.name}`}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => removeAttendee(person.id)}
                        aria-label={`Delete ${person.name}`}
                        className="flex items-center gap-1 rounded-lg border border-red-100 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {attendees.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No attendees added yet. Select a member above to begin.
              </p>
            )}
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
            disabled={saving || membersLoading}
            className="flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-3 font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Saving report...' : 'Prepare Report'}
          </button>
        </div>
      </form>
    </div>
  )
}
