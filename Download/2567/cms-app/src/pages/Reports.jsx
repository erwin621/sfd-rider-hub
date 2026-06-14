import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { peso } from '../components/ui'

const TEAL   = '#0D9488'
const SLATE  = '#CBD5E1'
const EMERALD= '#10B981'
const AMBER  = '#F59E0B'

export default function Reports({ visitsHook, expensesHook }) {
  const { visits }     = visitsHook
  const { expenses }   = expensesHook

  // ── Financials ─────────────────────────────────────────────────────────
  const totalIncome = useMemo(() =>
    visits.reduce((s, v) => s + (Number(v.income) || 0), 0), [visits])

  const totalDeductions = expenses.ca_amount + expenses.motor_amount
  const netIncome       = totalIncome - totalDeductions
  const gasAllowance    = expenses.gas_amount
  const avgPerVisit     = visits.length ? Math.round(totalIncome / visits.length) : 0

  // ── Check rates ─────────────────────────────────────────────────────────
  const checkRates = useMemo(() => {
    const total = visits.length || 1
    const rate = (key) => Math.round(visits.filter(v => v[key] === true).length / total * 100)
    return {
      power:        rate('power_check'),
      connectivity: rate('connectivity_check'),
      hardware:     rate('hardware_check'),
      cables:       rate('cables_check'),
    }
  }, [visits])

  // ── Daily income ────────────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map = {}
    visits.forEach(v => {
      const d = v.visit_date
      if (!map[d]) map[d] = { date: d, income: 0, visits: 0 }
      map[d].income += Number(v.income) || 0
      map[d].visits++
    })
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      }))
  }, [visits])

  // ── City breakdown ──────────────────────────────────────────────────────
  const cityData = useMemo(() => {
    const map = {}
    visits.forEach(v => {
      const c = v.locality.replace(' City', '')
      if (!map[c]) map[c] = { city: c, income: 0, visits: 0 }
      map[c].income += Number(v.income) || 0
      map[c].visits++
    })
    return Object.values(map).sort((a, b) => b.income - a.income)
  }, [visits])

  // ── Technician breakdown ────────────────────────────────────────────────
  const techData = useMemo(() => {
    const map = {}
    visits.forEach(v => {
      if (!map[v.visited_by]) map[v.visited_by] = { tech: v.visited_by, visits: 0, income: 0 }
      map[v.visited_by].visits++
      map[v.visited_by].income += Number(v.income) || 0
    })
    return Object.values(map).sort((a, b) => b.visits - a.visits)
  }, [visits])

  // ── Connectivity by city ────────────────────────────────────────────────
  const connectivityData = useMemo(() => {
    const map = {}
    visits.forEach(v => {
      const c = v.locality.replace(' City', '')
      if (!map[c]) map[c] = { city: c, ok: 0, fail: 0 }
      if (v.connectivity_check === true)  map[c].ok++
      if (v.connectivity_check === false) map[c].fail++
    })
    return Object.values(map).filter(d => d.ok + d.fail > 0).sort((a, b) => (b.ok + b.fail) - (a.ok + a.fail))
  }, [visits])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">{expenses.period_label} · EBANOG</p>
      </div>

      {/* ── Financial Summary Card ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-6 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-300 mb-5">
          Financial Summary — {expenses.period_label}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[
            { label: 'Total Income',   value: peso(totalIncome),       note: `${visits.length} visits` },
            { label: 'Less Cash Adv.', value: `−${peso(expenses.ca_amount)}`,   note: 'Deduction', neg: true },
            { label: 'Less Motor',     value: `−${peso(expenses.motor_amount)}`,note: 'Deduction', neg: true },
            { label: 'Net Income',     value: peso(netIncome),          note: 'Take-home', accent: true },
          ].map(({ label, value, note, neg, accent }) => (
            <div key={label} className={`rounded-xl p-3 ${accent ? 'bg-white/20' : 'bg-white/10'}`}>
              <p className="text-xs text-teal-300">{label}</p>
              <p className={`text-xl font-bold mt-0.5 ${neg ? 'text-red-300' : 'text-white'}`}>{value}</p>
              <p className="text-xs text-teal-400 mt-0.5">{note}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-white/20 flex flex-wrap gap-x-5 gap-y-1 text-xs text-teal-300">
          <span>Gas Allowance: {peso(gasAllowance)}</span>
          <span>·</span>
          <span>Avg per Visit: {peso(avgPerVisit)}</span>
          <span>·</span>
          <span>Total Deductions: {peso(totalDeductions)}</span>
        </div>
      </div>

      {/* ── Check Pass Rates ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Power',        rate: checkRates.power,        color: 'bg-teal-500'   },
          { label: 'Connectivity', rate: checkRates.connectivity,  color: 'bg-emerald-500'},
          { label: 'Hardware',     rate: checkRates.hardware,      color: 'bg-blue-500'   },
          { label: 'Cables',       rate: checkRates.cables,        color: 'bg-purple-500' },
        ].map(({ label, rate, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs font-medium text-slate-500">{label} Check</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{rate}%</p>
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${rate}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-1">Pass rate</p>
          </div>
        ))}
      </div>

      {/* ── Daily Income & Visits chart ───────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <p className="text-sm font-semibold text-slate-800 mb-1">Daily Income &amp; Visit Count</p>
        <p className="text-xs text-slate-400 mb-4">Bars = income (₱), Line = number of visits</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dailyData} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="income"  tick={{ fontSize: 10 }} tickFormatter={v => `₱${v}`} />
            <YAxis yAxisId="visits"  orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
              formatter={(v, n) => n === 'income' ? [peso(v), 'Income'] : [v, 'Visits']}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar  yAxisId="income" dataKey="income" fill={TEAL}  radius={[4,4,0,0]} name="income" />
            <Line yAxisId="visits" type="monotone" dataKey="visits" stroke={AMBER} strokeWidth={2.5}
              dot={{ fill: AMBER, r: 4, strokeWidth: 0 }} name="visits" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Income by City ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Income by City</p>
        </div>
        <div className="divide-y divide-slate-50">
          {cityData.map((c, i) => (
            <div key={c.city} className="px-5 py-3.5 flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-300 w-5 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-800">{c.city}</p>
                  <div className="text-right">
                    <p className="text-sm font-bold text-teal-600">{peso(c.income)}</p>
                    <p className="text-xs text-slate-400">{c.visits} visit{c.visits !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full"
                    style={{ width: `${totalIncome ? Math.round(c.income / totalIncome * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Connectivity by City ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <p className="text-sm font-semibold text-slate-800 mb-4">Connectivity Status by City</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={connectivityData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="city" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="ok"   fill={EMERALD} radius={[3,3,0,0]} name="Online"  stackId="a" />
            <Bar dataKey="fail" fill="#FCA5A5" radius={[3,3,0,0]} name="Offline" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Technician Breakdown ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Technician Breakdown</p>
        </div>
        <div className="divide-y divide-slate-50">
          {techData.map(t => (
            <div key={t.tech} className="px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-teal-600 font-mono">{t.tech[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 font-mono">{t.tech}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-400">{t.visits} visits</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs text-slate-400">
                    {visits.length ? Math.round(t.visits / visits.length * 100) : 0}% of total
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-teal-600">{peso(t.income)}</p>
                <p className="text-xs text-slate-400">earned</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
