import {
  CUSTOM_PERIOD_ID,
  CUSTOM_PERIOD_LABEL,
  PERIODS,
} from '../lib/periods'

const inputClass =
  'min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-600 disabled:opacity-60 sm:text-sm'

// Two date fields. They sit side by side when there is room and wrap onto
// their own lines on a narrow screen, never wider than their container.
function CustomDates({ period, disabled, idPrefix }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 basis-36">
        <label
          htmlFor={`${idPrefix}-start`}
          className="mb-1 block text-xs text-slate-600"
        >
          From
        </label>
        <input
          id={`${idPrefix}-start`}
          type="date"
          value={period.customStart}
          max={period.customEnd || undefined}
          onChange={(event) => period.setCustomStart(event.target.value)}
          disabled={disabled}
          className={inputClass}
        />
      </div>

      <div className="min-w-0 flex-1 basis-36">
        <label
          htmlFor={`${idPrefix}-end`}
          className="mb-1 block text-xs text-slate-600"
        >
          To
        </label>
        <input
          id={`${idPrefix}-end`}
          type="date"
          value={period.customEnd}
          min={period.customStart || undefined}
          onChange={(event) => period.setCustomEnd(event.target.value)}
          disabled={disabled}
          className={inputClass}
        />
      </div>
    </div>
  )
}

// Period selector shared by Statistics and Members.
//
//   period   : the object returned by usePeriod()
//   variant  : "chips" (buttons) or "select" (drop-down list)
//   idPrefix : unique prefix for the ids of the fields on the page
//   label    : label of the drop-down list (variant "select")
export default function PeriodPicker({
  period,
  variant = 'chips',
  idPrefix = 'period',
  label = 'Period',
  disabled = false,
}) {
  const error = !period.range.valid ? (
    <p
      role="alert"
      className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
    >
      {period.range.message}
    </p>
  ) : null

  if (variant === 'select') {
    return (
      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full sm:w-auto">
            <label
              htmlFor={`${idPrefix}-select`}
              className="mb-1 block text-xs text-slate-600"
            >
              {label}
            </label>
            <select
              id={`${idPrefix}-select`}
              value={period.periodId}
              onChange={(event) => period.selectPeriod(event.target.value)}
              disabled={disabled}
              className={inputClass}
            >
              {PERIODS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
              <option value={CUSTOM_PERIOD_ID}>{CUSTOM_PERIOD_LABEL}</option>
            </select>
          </div>

          {period.isCustom && (
            <div className="min-w-0 sm:w-auto">
              <CustomDates
                period={period}
                disabled={disabled}
                idPrefix={idPrefix}
              />
            </div>
          )}
        </div>

        {error}
      </div>
    )
  }

  const chipClass = (active) =>
    `min-h-11 rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60 ${
      active
        ? 'border-brand-900 bg-brand-900 text-white'
        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
    }`

  return (
    <div className="min-w-0 space-y-3">
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => period.selectPeriod(item.id)}
            disabled={disabled}
            aria-pressed={period.periodId === item.id}
            className={chipClass(period.periodId === item.id)}
          >
            {item.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => period.selectPeriod(CUSTOM_PERIOD_ID)}
          disabled={disabled}
          aria-pressed={period.isCustom}
          className={chipClass(period.isCustom)}
        >
          {CUSTOM_PERIOD_LABEL}
        </button>
      </div>

      {period.isCustom && (
        <div className="max-w-md">
          <CustomDates
            period={period}
            disabled={disabled}
            idPrefix={idPrefix}
          />
        </div>
      )}

      {error}
    </div>
  )
}
