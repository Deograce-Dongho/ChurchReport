import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatShortDate } from '../lib/periods'

const COLORS = {
  members: '#0A84C6',
  visitors: '#F97316',
  total: '#94A3B8',
}

const LEGEND = [
  { key: 'members', label: 'Members', color: COLORS.members },
  { key: 'visitors', label: 'Visitors', color: COLORS.visitors },
  { key: 'total', label: 'Total', color: COLORS.total, dashed: true },
]

const numberFormat = new Intl.NumberFormat('en-GB')

function AttendanceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const byKey = Object.fromEntries(
    payload.map((item) => [item.dataKey, item.value ?? 0])
  )

  const rows = [
    { key: 'members', label: 'Members', color: COLORS.members },
    { key: 'visitors', label: 'Visitors', color: COLORS.visitors },
  ]

  return (
    <div className="min-w-40 rounded-xl bg-brand-900 p-3 text-white shadow-xl">
      <p className="mb-2 text-xs font-semibold">
        {formatShortDate(label)}
      </p>

      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-5 text-xs"
          >
            <span className="flex items-center gap-2 text-slate-200">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              {row.label}
            </span>
            <span className="font-semibold">
              {numberFormat.format(byKey[row.key] ?? 0)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-5 border-t border-white/15 pt-2 text-xs">
        <span className="flex items-center gap-2 font-semibold">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: COLORS.total }}
          />
          Total
        </span>
        <span className="font-bold">
          {numberFormat.format(byKey.total ?? 0)}
        </span>
      </div>
    </div>
  )
}

export default function AttendanceChart({
  data = [],
  title = 'Attendance trend',
  subtitle,
  compact = false,
}) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        No attendance data available for this period.
      </div>
    )
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-900/5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-brand-900">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {LEGEND.map((item) => (
            <span
              key={item.key}
              className="flex items-center gap-2 text-xs font-medium text-slate-600"
            >
              {item.dashed ? (
                <span
                  className="h-0 w-3 border-t-2 border-dashed"
                  style={{ borderColor: item.color }}
                />
              ) : (
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {item.label}
            </span>
          ))}

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Last {data.length} services
          </span>
        </div>
      </div>

      <div
        className="w-full min-w-0"
        role="img"
        aria-label={`${title}: members, visitors and total attendance by service date.`}
      >
        <ResponsiveContainer
          width="100%"
          height={compact ? 260 : 320}
        >
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
          >
            <defs>
              <linearGradient
                id="membersFill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={COLORS.members}
                  stopOpacity={0.18}
                />
                <stop
                  offset="100%"
                  stopColor={COLORS.members}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              stroke="#E2E8F0"
              strokeDasharray="3 4"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={compact ? 25 : 35}
            />

            <YAxis
              allowDecimals={false}
              width={36}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip
              content={<AttendanceTooltip />}
              cursor={{
                stroke: '#94A3B8',
                strokeDasharray: '3 3',
              }}
            />

            <Area
              type="monotone"
              dataKey="members"
              name="Members"
              stroke={COLORS.members}
              strokeWidth={2.5}
              fill="url(#membersFill)"
              dot={{ r: 3, fill: COLORS.members, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />

            <Line
              type="monotone"
              dataKey="visitors"
              name="Visitors"
              stroke={COLORS.visitors}
              strokeWidth={2}
              dot={{ r: 2.5, fill: COLORS.visitors, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
              connectNulls={false}
            />

            <Line
              type="monotone"
              dataKey="total"
              name="Total"
              stroke={COLORS.total}
              strokeWidth={1.8}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}