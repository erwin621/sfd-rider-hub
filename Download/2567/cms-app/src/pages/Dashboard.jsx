import { useMemo } from 'react'
import { MapPin, Wifi, AlertTriangle, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { StatCard, CodeChip, fmtDate, peso } from '../components/ui'

export default function Dashboard({ visitsHook, watchlistHook, expensesHook }) {
  const { visits } = visitsHook
  const { watchlist } = watchlistHook
  const { expenses } = expensesHook

  // ── KPIs ──────────────────────────────────────────────────────────────
  const totalIncome = useMemo(() =>
    visits.reduce((s, v) => s + (Number(v.income) || 0), 0), [visits])

  const netIncome = totalIncome - expenses.ca_amount - expenses.motor_amount

  const connectivityRate = useMemo(() => {
    const checked = visits.filter(v => v.connectivity_check !== null && v.connectivity_check !== undefined)
    if (!checked.length) return 0
    return Math.round(checked.filter(v => v.connectivity_check).length / checked.length * 100)
  }, [visits])

  // ── Charts ────────────────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const map = {}
    visits.forEach(v => {
      const d = v.visit_date
      if (!map[d]) map[d] = { date: d, count: 0 }
      map[d].count++
    })
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label: new Date(d.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      }))
  }, [visits])

  const cityData = useMemo(() => {
    const map = {}
    visits.forEach(v => { map[v.locality] = (map[v.locality] || 0) + 1 })
    return Object.entries(map)
      .map(([name, count]) => ({ name: name.replace(' City', ''), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 9)
  }, [visits])

  const recent = useMemo(() =>
    [...visits].sort((a, b) => b.visit_date.localeCompare(a.visit_date)).slice(0, 6),
  [visits])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">{expenses.period_label} · NCR Coverage</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Sites Visited"   value={visits.length}                   sub="This period"            icon={MapPin}       color="teal"   />
        <StatCard title="Connectivity"    value={`${connectivityRate}%`}           sub="Pass rate"              icon={Wifi}         color={connectivityRate >= 70 ? 'emerald' : 'amber'} />
        <StatCard title="Watchlist"       value={watchlist.length}                 sub="Need attention"         icon={AlertTriangle} color="red"   />
        <StatCard title="Net Income"      value={peso(netIncome)}                  sub={`Gross ${peso(totalIncome)}`} icon={TrendingUp} color="blue" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily visits */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm font-semibold text-slate-800 mb-4">Daily Visits</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                formatter={v => [v, 'Visits']}
              />
              <Line
                type="monotone" dataKey="count" stroke="#0D9488" strokeWidth={2.5}
                dot={{ fill: '#0D9488', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sites by city */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm font-semibold text-slate-800 mb-4">Sites by City</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={cityData} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 40 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={68} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}
                formatter={v => [v, 'Visits']}
              />
              <Bar dataKey="count" fill="#0D9488" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Visits */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Recent Visits</p>
          <span className="text-xs text-slate-400">{visits.length} total</span>
        </div>
        <div className="divide-y divide-slate-50">
          {recent.map(v => (
            <div key={v.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50/60 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin size={14} className="text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CodeChip code={v.site_code} />
                  <span className="text-sm font-medium text-slate-800 truncate">{v.site_name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-slate-400">{fmtDate(v.visit_date)}</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs font-mono text-slate-500">{v.visited_by}</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs text-slate-400">{v.locality}</span>
                  {v.remarks && (
                    <>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-500 truncate max-w-[200px]">{v.remarks}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-xs font-semibold text-teal-600 shrink-0">
                {v.income ? peso(v.income) : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Watchlist Preview */}
      {watchlist.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              Sites Needing Attention ({watchlist.length})
            </p>
          </div>
          <div className="space-y-2.5">
            {watchlist.slice(0, 4).map(w => (
              <div key={w.id} className="flex items-center gap-3 flex-wrap">
                <CodeChip code={w.site_code} />
                <span className="text-sm text-amber-900 flex-1 min-w-0 truncate">{w.site_name}</span>
                <span className="text-xs bg-amber-200 text-amber-700 rounded-full px-2 py-0.5 shrink-0">
                  {w.issue}
                </span>
              </div>
            ))}
            {watchlist.length > 4 && (
              <p className="text-xs text-amber-600 pt-1">+{watchlist.length - 4} more on the Watchlist tab</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
