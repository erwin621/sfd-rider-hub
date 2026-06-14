import { useState, useMemo } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import {
  Modal, Btn, Input, SelectField, Checkbox, Field,
  CodeChip, CheckBadge, fmtDate, peso,
} from '../components/ui'
import { CITIES, TECHNICIANS } from '../data/mockData'

const EMPTY_FORM = {
  visited_by: 'EBANOG',
  visit_date: new Date().toISOString().slice(0, 10),
  site_code: '', site_name: '', locality: CITIES[0],
  power_check: false, connectivity_check: false,
  hardware_check: false, cables_check: false,
  remarks: '', income: '',
}

export default function Visits({ visitsHook, techniciansHook }) {
  const { visits, addVisit, updateVisit, deleteVisit } = visitsHook
  const { technicians } = techniciansHook

  const techNames = technicians.map(t => t.username)

  const [search,      setSearch]      = useState('')
  const [filterCity,  setFilterCity]  = useState('')
  const [filterTech,  setFilterTech]  = useState('')
  const [filterCheck, setFilterCheck] = useState('')
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editing,     setEditing]     = useState(null)   // id of visit being edited
  const [deleting,    setDeleting]    = useState(null)   // id to delete
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [errors,      setErrors]      = useState({})
  const [saving,      setSaving]      = useState(false)

  // ── Filtering ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return visits
      .filter(v => {
        const matchQ    = !q || v.site_code.toLowerCase().includes(q) ||
                          v.site_name.toLowerCase().includes(q) ||
                          (v.remarks || '').toLowerCase().includes(q)
        const matchCity = !filterCity  || v.locality    === filterCity
        const matchTech = !filterTech  || v.visited_by  === filterTech
        const matchChk  = !filterCheck ||
          (filterCheck === 'ok'    && v.power_check && v.connectivity_check && v.hardware_check && v.cables_check) ||
          (filterCheck === 'issue' && !v.connectivity_check)
        return matchQ && matchCity && matchTech && matchChk
      })
      .sort((a, b) => b.visit_date.localeCompare(a.visit_date))
  }, [visits, search, filterCity, filterTech, filterCheck])

  // ── Handlers ───────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (v) => {
    setEditing(v.id)
    setForm({ ...v, income: v.income ?? '' })
    setErrors({})
    setModalOpen(true)
  }

  const handleField = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.site_code.trim()) e.site_code = 'Required'
    if (!form.site_name.trim()) e.site_name = 'Required'
    if (!form.visit_date)       e.visit_date = 'Required'
    return e
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    const payload = {
      ...form,
      income: Number(form.income) || 0,
    }
    if (editing) await updateVisit(editing, payload)
    else          await addVisit(payload)
    setSaving(false)
    setModalOpen(false)
  }

  const handleDelete = async () => {
    if (deleting) await deleteVisit(deleting)
    setDeleting(null)
  }

  const totalIncome = useMemo(() =>
    filtered.reduce((s, v) => s + (Number(v.income) || 0), 0), [filtered])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Visits Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} of {visits.length} visits · {filtered.length !== visits.length ? `filtered ` : ''}
            income: {peso(totalIncome)}
          </p>
        </div>
        <Btn onClick={openAdd}><Plus size={16} /> Log Visit</Btn>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            placeholder="Code, site, remarks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-white
              focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-300"
          />
        </div>
        {[
          { val: filterCity,  setter: setFilterCity,  items: CITIES,      placeholder: 'All Cities' },
          { val: filterTech,  setter: setFilterTech,  items: techNames,   placeholder: 'All Techs' },
          { val: filterCheck, setter: setFilterCheck,
            items: [{ value: 'ok', label: 'All OK' }, { value: 'issue', label: 'Connectivity Issue' }],
            placeholder: 'All Status',
          },
        ].map(({ val, setter, items, placeholder }, i) => (
          <select key={i} value={val} onChange={e => setter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white
              focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-700">
            <option value="">{placeholder}</option>
            {items.map(o => (
              <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
                {typeof o === 'string' ? o : o.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Date','Site','City','Tech','Checks','Remarks','Income',''].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 6 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(v.visit_date)}</td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="space-y-0.5">
                      <CodeChip code={v.site_code} />
                      <p className="text-sm font-medium text-slate-800 truncate">{v.site_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{v.locality}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                      {v.visited_by}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {[
                        [v.power_check,         'PWR'],
                        [v.connectivity_check,  'CON'],
                        [v.hardware_check,       'HW'],
                        [v.cables_check,         'CAB'],
                      ].map(([val, lbl]) => <CheckBadge key={lbl} value={val} label={lbl} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px]">
                    <span className="line-clamp-2">{v.remarks || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-teal-600 whitespace-nowrap">
                    {v.income ? peso(v.income) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(v)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleting(v.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState label="No visits match your filters" />}
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-slate-50">
          {filtered.map(v => (
            <div key={v.id} className="px-4 py-4">
              <div className="flex items-start gap-2 justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CodeChip code={v.site_code} />
                    <span className="text-xs text-slate-400">{fmtDate(v.visit_date)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 mt-1">{v.site_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{v.locality} · {v.visited_by}</p>
                  {v.remarks && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{v.remarks}</p>}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {[[v.power_check,'PWR'],[v.connectivity_check,'CON'],[v.hardware_check,'HW'],[v.cables_check,'CAB']].map(
                      ([val, lbl]) => <CheckBadge key={lbl} value={val} label={lbl} />
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {v.income ? <span className="text-sm font-semibold text-teal-600">{peso(v.income)}</span> : null}
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Edit2 size={14} /></button>
                    <button onClick={() => setDeleting(v.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <EmptyState label="No visits found" />}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Visit' : 'Log New Visit'} wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Visit Date"   type="date"   name="visit_date"  value={form.visit_date}  onChange={handleField} error={errors.visit_date} />
          <SelectField label="Technician" name="visited_by" value={form.visited_by} onChange={handleField}
            options={[...new Set([...TECHNICIANS, ...techNames])]} />
          <Input label="Site Code"    type="text"   name="site_code"   value={form.site_code}   onChange={handleField} placeholder="L4-XXX-XXXXX"  error={errors.site_code} />
          <Input label="Site Name"    type="text"   name="site_name"   value={form.site_name}   onChange={handleField} placeholder="Site name"      error={errors.site_name} />
          <SelectField label="City / Locality" name="locality" value={form.locality} onChange={handleField} options={CITIES} />
          <Input label="Income (₱)"   type="number" name="income"      value={form.income}      onChange={handleField} placeholder="0" min="0" />

          <div className="sm:col-span-2">
            <Field label="Site Checks">
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Checkbox label="Power Check"        name="power_check"        checked={!!form.power_check}        onChange={handleField} />
                <Checkbox label="Connectivity Check" name="connectivity_check" checked={!!form.connectivity_check} onChange={handleField} />
                <Checkbox label="Hardware Check"     name="hardware_check"     checked={!!form.hardware_check}     onChange={handleField} />
                <Checkbox label="Cables Check"       name="cables_check"       checked={!!form.cables_check}       onChange={handleField} />
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Remarks">
              <textarea
                name="remarks" value={form.remarks} onChange={handleField} rows={3}
                placeholder="Observations, actions taken, issues found…"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none placeholder:text-slate-300"
              />
            </Field>
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end border-t border-slate-100 pt-5">
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Log Visit'}
          </Btn>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete Visit">
        <div className="text-center space-y-4 py-2">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <Trash2 size={20} className="text-red-500" />
          </div>
          <p className="text-sm text-slate-600">This visit record will be permanently deleted. This cannot be undone.</p>
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancel</Btn>
            <Btn variant="danger"    onClick={handleDelete}             className="flex-1">Delete</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function EmptyState({ label }) {
  return (
    <div className="text-center py-14 text-slate-400">
      <Search size={32} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
