// Regularity levels, from the most to the least regular.
// Rate = services attended / services held in the selected period.
export const LEVELS = [
  { id: 'faithful', label: 'Faithful', rule: '75% or more', badge: 'bg-green-100 text-green-800' },
  { id: 'regular', label: 'Regular', rule: '50 to 74%', badge: 'bg-brand-100 text-brand-800' },
  { id: 'occasional', label: 'Occasional', rule: '25 to 49%', badge: 'bg-amber-100 text-amber-800' },
  { id: 'rare', label: 'Rare', rule: 'Less than 25%', badge: 'bg-orange-100 text-orange-800' },
  { id: 'absent', label: 'Never present', rule: '0%', badge: 'bg-red-100 text-red-800' },
]

export const LEVELS_BY_ID = Object.fromEntries(
  LEVELS.map((level) => [level.id, level])
)

export function getLevelId(attended, total) {
  if (!attended || !total) return 'absent'

  const rate = attended / total

  if (rate >= 0.75) return 'faithful'
  if (rate >= 0.5) return 'regular'
  if (rate >= 0.25) return 'occasional'
  return 'rare'
}
