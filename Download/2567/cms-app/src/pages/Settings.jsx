import { useState } from 'react'
import { Plus, Trash2, Check, ExternalLink } from 'lucide-react'
import { Modal, Btn, Input, SelectField, Field, peso } from '../components/ui'

export default function Settings({ techniciansHook, expensesHook }) {
  const { technicians, addTech, deleteTech } = techniciansHook
  const { expenses, saveExpenses }           = expensesHook

  // ── Expense form ──────────────────────────────────────────────────────
  const [expForm,  setExpForm]  = useState({
    ca_amount:    expenses.ca_amount,
    motor_amount: expenses.motor_amount,
    gas_amount:   expenses.gas_amount,
    period_label: expenses.period_label,
    period_start: expenses.period_start,
    period_end:   expenses.period_end,
  })
  const [expSaved, setExpSaved] = useState(false)

  const handleExpField = (e) => {
    const { name, value } = e.target
    setExpForm(p => ({ ...p, [name]: value }))
  }

  const handleSaveExp = async () => {
    await saveExpenses({
      ...expForm,
      ca_amount:    Number(expForm.ca_amount)    || 0,
      motor_amount: Number(expForm.motor_amount) || 0,
      gas_amount:   Number(expForm.gas_amount)   || 0,
    })
    setExpSaved(true)
    setTimeout(() => setExpSaved(false), 2500)
  }

  // ── Net income preview ─────────────────────────────────────────────────
  const netPreview = 5500 - (Number(expForm.ca_amount) || 0) - (Number(expForm.motor_amount) || 0)

  // ── User form ─────────────────────────────────────────────────────────
  const [userModal, setUserModal] = useState(false)
  const [userForm,  setUserForm]  = useState({ username:'', display_name:'', role:'technician', bank:'', contact:'' })
  const [deleting,  setDeleting]  = useState(null)

  const handleUserField = (e) => {
    const { name, value } = e.target
    setUserForm(p => ({ ...p, [name]: value }))
  }

  const handleAddUser = async () => {
    if (!userForm.username.trim()) return
    await addTech(userForm)
    setUserForm({ username:'', display_name:'', role:'technician', bank:'', contact:'' })
    setUserModal(false)
  }

  const handleDeleteUser = async () => {
    if (deleting) await deleteTech(deleting)
    setDeleting(null)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configuration, deductions &amp; user management</p>
      </div>

      {/* ── Period & Expense Deductions ───────────────────────────────── */}
      <Section title="Period & Expense Deductions" sub="Used in Reports to compute net income">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Period Label"  name="period_label" value={expForm.period_label} onChange={handleExpField} placeholder="Jun 1–15, 2026" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Period Start" name="period_start" type="date" value={expForm.period_start} onChange={handleExpField} />
            <Input label="Period End"   name="period_end"   type="date" value={expForm.period_end}   onChange={handleExpField} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <Input label="Cash Advance (₱)" name="ca_amount"    type="number" value={expForm.ca_amount}    onChange={handleExpField} min="0" />
          <Input label="Motor Allow. (₱)" name="motor_amount" type="number" value={expForm.motor_amount} onChange={handleExpField} min="0" />
          <Input label="Gas Allow. (₱)"   name="gas_amount"   type="number" value={expForm.gas_amount}   onChange={handleExpField} min="0" />
        </div>

        {/* Net income preview */}
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm">
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Net Income Preview</p>
          <div className="flex items-center gap-2 text-slate-600 flex-wrap">
            <span className="font-semibold text-slate-900">{peso(5500)} income</span>
            <span className="text-slate-400">−</span>
            <span>CA {peso(expForm.ca_amount || 0)}</span>
            <span className="text-slate-400">−</span>
            <span>Motor {peso(expForm.motor_amount || 0)}</span>
            <span className="text-slate-400">=</span>
            <span className={`font-bold text-base ${netPreview >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
              {peso(netPreview)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Based on current period income of ₱5,500</p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Btn onClick={handleSaveExp}>
            {expSaved ? <><Check size={14} /> Saved!</> : 'Save Configuration'}
          </Btn>
          <p className="text-xs text-slate-400">Net = Total Income − CA − Motor</p>
        </div>
      </Section>

      {/* ── Technicians & Users ───────────────────────────────────────── */}
      <Section
        title="Technicians & Users"
        sub="Manage field technicians and admin accounts"
        action={<Btn sm onClick={() => setUserModal(true)}><Plus size={14}/> Add</Btn>}
      >
        <div className="divide-y divide-slate-100 -mx-5">
          {technicians.map(u => (
            <div key={u.id} className="px-5 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-teal-600">
                  {(u.display_name || u.username)[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">{u.display_name || u.username}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    u.role === 'admin'
                      ? 'bg-purple-50 text-purple-600 border border-purple-200'
                      : 'bg-teal-50 text-teal-600 border border-teal-200'
                  }`}>
                    {u.role}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="font-mono text-xs text-slate-400">{u.username}</span>
                  {u.bank    && <span className="text-xs text-slate-400">· {u.bank}</span>}
                  {u.contact && <span className="text-xs text-slate-400">· {u.contact}</span>}
                </div>
              </div>
              <button
                onClick={() => setDeleting(u.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Supabase Setup ────────────────────────────────────────────── */}
      <Section title="Database Connection" sub="Supabase configuration">
        <div className="space-y-3">
          <div className="p-4 bg-slate-900 rounded-xl font-mono text-xs space-y-2">
            <p className="text-slate-500"># .env</p>
            <p><span className="text-teal-400">VITE_SUPABASE_URL</span><span className="text-slate-400">=</span><span className="text-amber-300">https://your-project.supabase.co</span></p>
            <p><span className="text-teal-400">VITE_SUPABASE_ANON_KEY</span><span className="text-slate-400">=</span><span className="text-amber-300">eyJhbGci...</span></p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-sm text-slate-600">
            <p><strong className="text-slate-800">Setup steps:</strong></p>
            <ol className="list-decimal ml-4 space-y-1 text-xs text-slate-500">
              <li>Create a new project at <span className="font-mono text-teal-600">supabase.com</span></li>
              <li>Run <span className="font-mono bg-slate-200 px-1 rounded">supabase/schema.sql</span> in the SQL editor</li>
              <li>Run <span className="font-mono bg-slate-200 px-1 rounded">supabase/seed.sql</span> to import spreadsheet data</li>
              <li>Copy your Project URL and anon key into <span className="font-mono bg-slate-200 px-1 rounded">.env</span></li>
              <li>Restart the dev server: <span className="font-mono bg-slate-200 px-1 rounded">npm run dev</span></li>
            </ol>
          </div>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium">
            Open Supabase Dashboard <ExternalLink size={12} />
          </a>
        </div>
      </Section>

      {/* Add User Modal */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title="Add Technician / User">
        <div className="space-y-4">
          <Input label="Username (login)"   name="username"     value={userForm.username}     onChange={handleUserField} placeholder="EBANOG" />
          <Input label="Display Name"       name="display_name" value={userForm.display_name} onChange={handleUserField} placeholder="Erwin Anog" />
          <SelectField label="Role"         name="role"         value={userForm.role}         onChange={handleUserField} options={['technician','admin']} />
          <Input label="Bank / Payment"     name="bank"         value={userForm.bank}         onChange={handleUserField} placeholder="MARIBANK" />
          <Input label="Contact Number"     name="contact"      value={userForm.contact}      onChange={handleUserField} placeholder="09XXXXXXXXX" />
          <div className="flex gap-3 pt-2">
            <Btn variant="secondary" onClick={() => setUserModal(false)} className="flex-1">Cancel</Btn>
            <Btn onClick={handleAddUser} className="flex-1">Add User</Btn>
          </div>
        </div>
      </Modal>

      {/* Delete User Confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Remove User">
        <div className="text-center space-y-4 py-2">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <Trash2 size={20} className="text-red-500" />
          </div>
          <p className="text-sm text-slate-600">This user will be removed from the system.</p>
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={() => setDeleting(null)} className="flex-1">Cancel</Btn>
            <Btn variant="danger"    onClick={handleDeleteUser}         className="flex-1">Remove</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Section({ title, sub, action, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
