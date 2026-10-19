import { useCallback, useEffect, useRef, useState } from 'react'

import { getAttendanceForService } from './attendanceService'

// Number of attendance requests sent at the same time
const BATCH_SIZE = 6

// Loads the attendance of the given services, a few requests at a time.
// Results are kept while the page is open, so changing the period only
// fetches the services that were not loaded yet.
//
// `services` must keep the same identity between renders (use useMemo),
// otherwise the effect restarts on every render.
//
// Returns { attendanceById, ready, error, retry } where attendanceById maps
// serviceId -> [{ rowId, memberId, presenceType }].
export function useServicesAttendance(services) {
  const cacheRef = useRef(new Map())
  const [attendanceById, setAttendanceById] = useState({})
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const missing = services.filter(
      (service) => !cacheRef.current.has(service.$id)
    )

    if (missing.length === 0) return

    let cancelled = false

    async function load() {
      setError('')

      try {
        for (let i = 0; i < missing.length; i += BATCH_SIZE) {
          if (cancelled) return

          const chunk = missing.slice(i, i + BATCH_SIZE)

          const results = await Promise.all(
            chunk.map((service) => getAttendanceForService(service.$id))
          )

          chunk.forEach((service, index) => {
            cacheRef.current.set(service.$id, results[index])
          })

          // The cache stays valid even if this effect was cancelled
          setAttendanceById(Object.fromEntries(cacheRef.current))
        }
      } catch (err) {
        console.error('Could not load attendance:', err)

        if (!cancelled) {
          setError(err.message || 'Could not load the attendance data.')
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [services, retryKey])

  const retry = useCallback(() => setRetryKey((key) => key + 1), [])

  const ready = services.every((service) => attendanceById[service.$id])

  return { attendanceById, ready, error, retry }
}