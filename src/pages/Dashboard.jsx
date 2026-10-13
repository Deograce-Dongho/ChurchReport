
import { Link } from 'react-router-dom'
import { FileText, Users, ChartNoAxesColumn, Printer } from 'lucide-react'

const shortcuts = [
  {
    title: 'Sunday Report',
    description: 'Create the weekly service report.',
    path: '/sunday-report',
    icon: FileText,
  },
  {
    title: 'Members & Visitors',
    description: 'Manage your church community.',
    path: '/members',
    icon: Users,
  },
  {
    title: 'Statistics',
    description: 'Review attendance trends.',
    path: '/statistics',
    icon: ChartNoAxesColumn,
  },
  {
    title: 'Print Report',
    description: 'Preview and print reports.',
    path: '/print-report',
    icon: Printer,
  },
]

export default function Dashboard() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#142D4E]">
          Welcome to ChurchReport
        </h1>
        <p className="mt-2 text-slate-500">
          Manage your Sunday services in one place.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {shortcuts.map(({ title, description, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="rounded-xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Icon size={28} className="text-blue-600" />
            <h2 className="mt-4 font-semibold text-[#142D4E]">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
