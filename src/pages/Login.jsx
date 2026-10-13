
import { Church } from 'lucide-react'

export default function Login() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Church size={42} className="text-[#142D4E]" />
          <h1 className="mt-3 text-2xl font-bold text-[#142D4E]">
            ChurchReport
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to manage your church reports.
          </p>
        </div>

        <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Secure access for authorized church users
        </p>
      </section>
    </main>
  )
}
