
export default function Members() {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#142D4E]">
            Members & Visitors
          </h1>
          <p className="mt-1 text-slate-500">
            Manage people in your church community.
          </p>
        </div>
        <button type="button" className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700">
          + Add person
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <input
          type="search"
          placeholder="Search people..."
          className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600"
        />
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-4">Name</th>
                <th className="px-3 py-4">Category</th>
                <th className="px-3 py-4">Attendance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="3" className="px-3 py-8 text-center text-slate-500">
                  No people to display yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
