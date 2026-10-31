import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'

function toDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function shortDate(value) {
  const date = toDate(value)
  if (!date) return 'Invalid date'

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function monthLabel(value) {
  const date = toDate(value)
  if (!date) return 'Unknown date'

  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

// Service selector that stays usable with hundreds of services:
// - the list has a fixed height and scrolls
// - services are grouped by month
// - a search box filters by title, preacher or date
// - arrows go to the previous / next service without opening the list
//
// `services` must be sorted from newest to oldest.
export default function ServicePicker({
  id,
  services,
  value,
  onChange,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const selectedRef = useRef(null)

  const index = services.findIndex((item) => item.$id === value)
  const selected = index >= 0 ? services[index] : null

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // On open: focus the search box and bring the selected service into view.
  useEffect(() => {
    if (!open) return

    searchRef.current?.focus()
    selectedRef.current?.scrollIntoView({ block: 'center' })
  }, [open])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return services

    return services.filter((item) =>
      `${shortDate(item.service_date)} ${item.service_date ?? ''} ${
        item.sermon_title ?? ''
      } ${item.preacher_name ?? ''}`
        .toLowerCase()
        .includes(needle)
    )
  }, [services, query])

  // [{ label, items }] in the same order as the services
  const groups = useMemo(() => {
    const result = []

    for (const item of filtered) {
      const label = monthLabel(item.service_date)
      const last = result[result.length - 1]

      if (last && last.label === label) last.items.push(item)
      else result.push({ label, items: [item] })
    }

    return result
  }, [filtered])

  function choose(item) {
    onChange(item.$id)
    setOpen(false)
    setQuery('')
  }

  function toggle() {
    if (disabled) return
    setOpen((current) => !current)
    setQuery('')
  }

  // Older = next in the list, newer = previous.
  const newer = index > 0 ? services[index - 1] : null
  const older = index >= 0 && index < services.length - 1 ? services[index + 1] : null

  const arrowClass =
    'flex min-h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div ref={rootRef} className="relative flex w-full gap-1.5 sm:w-auto">
      <button
        type="button"
        aria-label="Older service"
        title="Older service"
        onClick={() => older && onChange(older.$id)}
        disabled={disabled || !older}
        className={arrowClass}
      >
        <ChevronLeft size={18} />
      </button>

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        disabled={disabled}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none hover:border-slate-400 focus:border-brand-600 disabled:opacity-60 sm:w-72 sm:flex-none"
      >
        <span className="min-w-0">
          {selected ? (
            <>
              <span className="block truncate font-medium text-slate-900">
                {selected.sermon_title || 'Untitled'}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {shortDate(selected.service_date)}
              </span>
            </>
          ) : (
            <span className="text-slate-500">No reports yet</span>
          )}
        </span>

        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <button
        type="button"
        aria-label="Newer service"
        title="Newer service"
        onClick={() => newer && onChange(newer.$id)}
        disabled={disabled || !newer}
        className={arrowClass}
      >
        <ChevronRight size={18} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:left-auto sm:right-0 sm:w-96">
          <div className="border-b border-slate-200 p-2">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && filtered[0]) {
                    event.preventDefault()
                    choose(filtered[0])
                  }
                }}
                placeholder="Search title, preacher or date..."
                className="min-h-10 w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-base outline-none focus:border-brand-600 sm:text-sm"
              />
            </div>
          </div>

          <ul role="listbox" className="max-h-72 overflow-y-auto overscroll-contain">
            {groups.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500">
                No service found.
              </li>
            )}

            {groups.map((group) => (
              <li key={group.label} role="presentation">
                <p className="sticky top-0 z-10 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </p>

                <ul role="presentation">
                  {group.items.map((item) => {
                    const isSelected = item.$id === value

                    return (
                      <li
                        key={item.$id}
                        ref={isSelected ? selectedRef : null}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <button
                          type="button"
                          onClick={() => choose(item)}
                          className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brand-50 ${
                            isSelected ? 'bg-brand-50' : ''
                          }`}
                        >
                          <span className="w-20 shrink-0 text-xs text-slate-500">
                            {shortDate(item.service_date)}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate ${
                              isSelected
                                ? 'font-semibold text-brand-900'
                                : 'text-slate-800'
                            }`}
                          >
                            {item.sermon_title || 'Untitled'}
                          </span>
                          {isSelected && (
                            <Check size={16} className="shrink-0 text-brand-600" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>

          <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
            {filtered.length === services.length
              ? `${services.length} services`
              : `${filtered.length} of ${services.length} services`}
          </p>
        </div>
      )}
    </div>
  )
}