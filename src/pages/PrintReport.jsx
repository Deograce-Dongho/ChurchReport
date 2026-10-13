
import { Printer } from 'lucide-react'

export default function PrintReport() {
  function handlePrint() {
    window.print()
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#142D4E]">
            Print Report
          </h1>
          <p className="mt-1 text-slate-500">
            Preview and print a Sunday service report.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
        >
          <Printer size={18} />
          Print report
        </button>
      </div>

      <article className="mx-auto max-w-3xl space-y-5 rounded-xl border border-slate-200 bg-white p-8">
        <header className="border-b border-slate-200 pb-5">
          <h2 className="text-2xl font-bold text-[#142D4E]">Church Name</h2>
          <p className="mt-1 text-slate-500">Sunday Service Report</p>
        </header>

        <div>
          <h3 className="font-semibold">Service information</h3>
          <p className="mt-2 text-sm text-slate-600">Date: —</p>
          <p className="mt-1 text-sm text-slate-600">Preacher: —</p>
          <p className="mt-1 text-sm text-slate-600">Sermon title: —</p>
        </div>

        <div>
          <h3 className="font-semibold">Sermon key points</h3>
          <p className="mt-2 text-sm text-slate-600">No report selected.</p>
        </div>

        <div>
          <h3 className="font-semibold">Attendance summary</h3>
          <p className="mt-2 text-sm text-slate-600">In person: —</p>
          <p className="mt-1 text-sm text-slate-600">Online: —</p>
          <p className="mt-1 text-sm text-slate-600">Total: —</p>
        </div>
      </article>
    </section>
  )
}
