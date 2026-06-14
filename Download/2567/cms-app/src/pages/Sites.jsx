import { useState, useMemo } from 'react'
import { Search, Check, Plus, Trash2, AlertTriangle, MapPin } from 'lucide-react'
import { Modal, Btn, Input, SelectField, CodeChip, IssueBadge, fmtDate, daysSince } from '../components/ui'
import { CITIES } from '../data/mockData'

const EMPTY_WATCH = { site_code:'', site_name:'', locality: CITIES[0], issue:'' }

export default function Sites({ sitesHook, watchlistHook }) {
  const { sites }                         = sitesHook
  const { watchlist, addItem, resolveItem, deleteItem } = watchlistHook

  const [tab,        setTab]        = useState('sites')
  const [search,     setSearch]     = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [watchModal, setWatchModal] = useState(false)
  const [watchForm,  setWatchForm]  = useState(EMPTY_WATCH)

  // ── Filter sites ──────────────────────────────────────────────────────
  const filteredSites = useMemo(() => {
    const q = search.toLowerCase()
    return sites.filter(s =>
      (!cityFilter || s.locality === cityFilter) &&
      (!q || s.code.toLowerCase().includes(q) || s.site_name.toLowerCase().includes(q))
    )
  }, [sites, search, cityFilter])

  // ── Filter watchlist ──────────────────────────────────────────────────
  const filteredWatch = useMemo(() => {
    const q = search.toLowerCase()
    return watchlist.filter(w =>
      (!cityFilter || w.locality === cityFilter) &&
      (!q || w.site_code.toLowerCase().includes(q) || w.site_name.toLowerCase().includes(q) || w.issue.toLowerCase().includes(q))
    )
  }, [watchlist, search, cityFilter])

  // ── City counts for badge ─────────────────────────────────────────────
  const watchByCityCount = useMemo(() => {
    const map = {}
    watchlist.forEach(w => { map[w.locality] = (map[w.locality] || 0) + 1 })
    return map
  }, [watchlist])

  // ── Recency color ─────────────────────────────────────────────────────
  const recencyClass = (dateStr) => {
    if (!dateStr) return 'text-slate-300'
    const diff = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00')) / 86400000)
    if (diff <= 7)  return 'text-emerald-600'
    if (diff <= 30) return 'text-teal-600'
    if (diff <= 90) return 'text-amber-500'
    return 'text-red-500'
  }

  const handleWatchField = (e) => {
    const { name, value } = e.target
    setWatchForm(p => ({ ...p, [name]: value }))
  }

  const handleAddWatch = async () => {
    if (!watchForm.site_code.trim() || !watchForm.issue.trim()) return
    await addItem({ ...watchForm, date_added: new Date().toISOString().slice(0, 10) })
    setWatchForm(EMPTY_WATCH)
    setWatchModal(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sites</h1>
          <p className="text-sm text-slate-500 mt-0.5">Master site registry · NCR Metro Manila</p>
        </div>
        {tab === 'watchlist' && (
          <Btn onClick={() => { setWatchForm(EMPTY_WATCH); setWatchModal(true) }}>
            <Plus size={16} /> Add Issue
          </Btn>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          ['sites',     `All Sites (${sites.length})`],
          ['watchlist', `Watchlist (${watchlist.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            placeholder={tab === 'sites' ? 'Search code or name…' : 'Search issue, code, name…'}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white
              focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-300"
          />
        </div>
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700">
          <option value="">All Cities</option>
          {CITIES.map(c => (
            <option key={c} value={c}>
              {c}{watchByCityCount[c] ? ` (${watchByCityCount[c]} issues)` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* ── ALL SITES tab ─────────────────────────────────────────────── */}
      {tab === 'sites' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Code','Site Name','City','Last Visit'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSites.map(s => (
                  <tr key={s.code} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3"><CodeChip code={s.code} /></td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-800">{s.site_name}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{s.locality}</td>
                    <td className="px-4 py-3">
                      {s.last_visit ? (
                        <div>
                          <span className={`text-xs font-medium ${recencyClass(s.last_visit)}`}>
                            {daysSince(s.last_visit)}
                          </span>
                          <span className="text-xs text-slate-400 ml-1.5">{fmtDate(s.last_visit)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 italic">Not visited</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSites.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <MapPin size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No sites match your filters</p>
              </div>
            )}
          </div>

          {/* Mobile */}
          <div className="sm:hidden divide-y divide-slate-50">
            {filteredSites.map(s => (
              <div key={s.code} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CodeChip code={s.code} />
                    <p className="text-sm font-medium text-slate-800 mt-1">{s.site_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.locality}</p>
                  </div>
                  {s.last_visit && (
                    <span className={`text-xs font-medium shrink-0 ${recencyClass(s.last_visit)}`}>
                      {daysSince(s.last_visit)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {filteredSites.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">No sites found</div>
            )}
          </div>
        </div>
      )}

      {/* ── WATCHLIST tab ─────────────────────────────────────────────── */}
      {tab === 'watchlist' && (
        <div className="space-y-3">
          {filteredWatch.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-16 text-slate-400">
              <Check size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">All clear — no open issues</p>
              <p className="text-xs mt-1 text-slate-300">
                {search || cityFilter ? 'Try clearing your filters' : 'Add items when sites need attention'}
              </p>
            </div>
          ) : (
            filteredWatch.map(w => (
              <WatchCard key={w.id} item={w} onResolve={resolveItem} onDelete={deleteItem} />
            ))
          )}
        </div>
      )}

      {/* Add Watchlist Item Modal */}
      <Modal open={watchModal} onClose={() => setWatchModal(false)} title="Add to Watchlist">
        <div className="space-y-4">
          <Input   label="Site Code"    name="site_code" value={watchForm.site_code} onChange={handleWatchField} placeholder="L4-XXX-XXXXX" />
          <Input   label="Site Name"    name="site_name" value={watchForm.site_name} onChange={handleWatchField} placeholder="Site name" />
          <SelectField label="City / Locality" name="locality" value={watchForm.locality} onChange={handleWatchField} options={CITIES} />
          <Input   label="Issue / Reason" name="issue" value={watchForm.issue}     onChange={handleWatchField} placeholder="e.g. OFFLINE, DEFECTIVE AP" />
          <div className="flex gap-3 pt-2">
            <Btn variant="secondary" onClick={() => setWatchModal(false)} className="flex-1">Cancel</Btn>
            <Btn onClick={handleAddWatch} className="flex-1">Add to Watchlist</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function WatchCard({ item, onResolve, onDelete }) {
  const issueColor = (issue) => {
    if (issue.includes('OFFLINE'))   return 'bg-red-50 text-red-600 border-red-200'
    if (issue.includes('DEFECTIVE')) return 'bg-orange-50 text-orange-600 border-orange-200'
    if (issue.includes('RELOCAT'))   return 'bg-purple-50 text-purple-600 border-purple-200'
    if (issue.includes('INSPECT'))   return 'bg-blue-50 text-blue-600 border-blue-200'
    return 'bg-amber-50 text-amber-600 border-amber-200'
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-slate-200 transition-colors">
      <div className="flex items-start gap-3 justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <CodeChip code={item.site_code} />
            <span className={`text-xs font-semibold rounded-full border px-2.5 py-0.5 ${issueColor(item.issue)}`}>
              {item.issue}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-2">{item.site_name}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <AlertTriangle size={11} />
            <span>{item.locality}</span>
            <span>·</span>
            <span>Added {fmtDate(item.date_added)}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onResolve(item.id)}
            className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200
              rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition-colors font-medium">
            <Check size={12} /> Resolved
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
