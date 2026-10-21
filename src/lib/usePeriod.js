import { useCallback, useMemo, useState } from 'react'

import {
  CUSTOM_PERIOD_ID,
  PERIODS,
  resolveRange,
  toInputDate,
} from './periods'

// State of a period selector: one of the preset periods, or a custom
// period typed by the user ("Other period...").
//
// `range` keeps the same identity until the selection changes, so it is safe
// to use it in useMemo dependencies.
//
// Returns { periodId, selectPeriod, isCustom, customStart, customEnd,
//           setCustomStart, setCustomEnd, range }
// where range is { valid, start, end, label } or { valid: false, message }.
export function usePeriod(defaultId = PERIODS[0].id) {
  const [periodId, setPeriodId] = useState(defaultId)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const range = useMemo(
    () => resolveRange(periodId, customStart, customEnd),
    [periodId, customStart, customEnd]
  )

  const selectPeriod = useCallback(
    (id) => {
      // Start the custom dates from the period that was selected before, so that the user can tweak it.
      if (id === CUSTOM_PERIOD_ID && periodId !== CUSTOM_PERIOD_ID && range.valid) {
        setCustomStart(toInputDate(range.start))
        setCustomEnd(toInputDate(range.end))
      }

      setPeriodId(id)
    },
    [periodId, range]
  )

  return {
    periodId,
    selectPeriod,
    isCustom: periodId === CUSTOM_PERIOD_ID,
    customStart,
    customEnd,
    setCustomStart,
    setCustomEnd,
    range,
  }
}