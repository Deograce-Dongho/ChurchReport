import {
  CUSTOM_PERIOD_ID,
  CUSTOM_PERIOD_LABEL,
  PERIODS,
} from '../lib/periods'

const inputClass =
  'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 disabled:opacity-60'

function CustomDates({ period, disabled, idPrefix }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
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

      <div>
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
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
            <CustomDates
              period={period}
              disabled={disabled}
              idPrefix={idPrefix}
            />
          )}
        </div>

        {error}
      </div>
    )
  }

  const chipClass = (active) =>
    `rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
      active
        ? 'border-[#142D4E] bg-[#142D4E] text-white'
        : 'border-slate-300 text-slate-700 hover:bg-slate-50'
    }`

  return (
    <div className="space-y-3">
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
        <CustomDates period={period} disabled={disabled} idPrefix={idPrefix} />
      )}

      {error}
    </div>
  )
}