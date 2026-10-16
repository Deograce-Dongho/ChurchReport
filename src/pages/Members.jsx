
import { useEffect, useMemo, useState } from 'react'
import {
  getMembers,
  createMember,
  updateMember,
  deleteMember,
} from '../lib/membersService'

const PAGE_SIZE = 25

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  person_type: 'member',
}

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

  useEffect(() => {
    loadMembers()
  }, [])

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase()

    return members.filter((person) =>
      [
        person.name,
        person.email,
        person.phone,
        person.person_type,
      ].some((value) =>
        String(value ?? '').toLowerCase().includes(term)
      )
    )
  }, [members, search])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMembers.length / PAGE_SIZE)
  )

  const visibleMembers = filteredMembers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

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

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#142D4E]">
            Members & Visitors
          </h1>
          <p className="mt-1 text-slate-500">
            Manage people in your church community.
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
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 sm:max-w-md"
          />

          <span className="text-sm text-slate-500">
            {filteredMembers.length} people
          </span>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-4">Name</th>
                <th className="px-3 py-4">Email</th>
                <th className="px-3 py-4">Phone</th>
                <th className="px-3 py-4">Category</th>
                <th className="px-3 py-4">Status</th>
                <th className="px-3 py-4">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    Loading people...
                  </td>
                </tr>
              ) : visibleMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    {search
                      ? 'No matching people found.'
                      : 'No people to display yet. Click "+ Add person" to begin.'}
                  </td>
                </tr>
              ) : (
                visibleMembers.map((person) => (
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
                    <td className="whitespace-nowrap px-3 py-4">
                      <button
                        type="button"
                        onClick={() => openEditForm(person)}
                        className="mr-3 font-medium text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(person)}
                        className="font-medium text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
            {filteredMembers.length > 0 &&
              ` · Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                page * PAGE_SIZE,
                filteredMembers.length
              )} of ${filteredMembers.length}`}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
