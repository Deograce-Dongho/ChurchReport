
export default function SundayReport() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#142D4E]">
          Sunday Service Report
        </h1>
        <p className="mt-1 text-slate-500">
          Create and manage the weekly service report.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-semibold">Service information</h2>
          <div className="space-y-4">
            <label className="block text-sm">
              Service date
              <input type="date" className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
            </label>
            <label className="block text-sm">
              Preacher name
              <input placeholder="Enter preacher's name" className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
            </label>
            <label className="block text-sm">
              Sermon title
              <input placeholder="Enter sermon title" className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
            </label>
            <label className="block text-sm">
              Sermon key points
              <textarea rows="4" placeholder="Write the main message..." className="mt-2 w-full rounded-lg border border-slate-300 p-3" />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 font-semibold">Attendance</h2>
          <p className="text-sm text-slate-500">
            Attendees and presence types will be managed here.
          </p>
          <button type="button" className="mt-5 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700">
            + Add attendee
          </button>
        </div>
      </div>

      <button type="button" className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700">
        Save report
      </button>
    </section>
  )
}
