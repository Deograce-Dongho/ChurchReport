const TONES = {
  brand: 'text-brand-600 hover:bg-brand-50',
  red: 'text-red-600 hover:bg-red-50',
}

// Icon-only button with a tooltip shown on mouse hover and keyboard focus.
//
//   label   : accessible name read by screen readers ("Edit Marie Dupont")
//   tooltip : short text shown on hover ("Edit")
//
// The tooltip is purely visual (aria-hidden): the aria-label already names
// the button, and touch screens have no hover.
export default function IconButton({
  label,
  tooltip,
  onClick,
  tone = 'brand',
  disabled = false,
  children,
}) {
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`peer inline-flex h-11 w-11 items-center justify-center rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone] ?? TONES.brand}`}
      >
        {children}
      </button>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100"
      >
        {tooltip}
      </span>
    </span>
  )
}
