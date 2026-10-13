
import { Users, CalendarDays, ChartNoAxesColumn, UserRoundPlus } from 'lucide-react'

const metrics = [
  { label: 'Total services', icon: CalendarDays },
  { label: 'Average attendance', icon: ChartNoAxesColumn },
  { label: 'Members', icon: Users },
  { label: 'Visitors', icon: UserRoundPlus },
]

export default function Statistics() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#142D4E]">
          Attendance Statistics
        </h1>
        <p className="mt-1 text-slate-500">
          Understand attendance over time.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, icon: Icon }) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-5">
            <Icon size={24} className="text-blue-600" />
            <p className="mt-4 text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-[#142D4E]">—</p>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-[#142D4E]">Attendance by week</h2>
        <p className="mt-2 text-sm text-slate-500">
          The attendance chart will appear here once real service records are available.
        </p>
        <div className="mt-6 flex h-48 items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400">
          Chart area
        </div>
      </div>
    </section>
  )
}
