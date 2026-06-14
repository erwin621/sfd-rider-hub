import { X, Check } from 'lucide-react'

// ─── CodeChip — the signature element ─────────────────────────────────────
// Site codes (L4-XXX-XXXXX) rendered in distinctive teal monospace chips
export function CodeChip({ code }) {
  return (
    <span className="font-mono text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded px-1.5 py-0.5 whitespace-nowrap tracking-tight">
      {code}
    </span>
  )
}

// ─── CheckBadge ─────────────────────────────────────────────────────────
export function CheckBadge({ value, label }) {
  if (value === null || value === undefined)
    return <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-400 rounded px-1.5 py-0.5">{label}</span>
  return value
    ? <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-50 text-emerald-600 rounded px-1.5 py-0.5">{label}</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-50 text-red-500 rounded px-1.5 py-0.5">{label}</span>
}

// ─── IssueBadge ──────────────────────────────────────────────────────────
export function IssueBadge({ text }) {
  return (
    <span className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
      {text}
    </span>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:items-center sm:pt-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── Btn ─────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', sm, className = '', type = 'button', disabled }) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'
  const size = sm ? 'text-xs px-3 py-1.5' : 'text-sm px-4 py-2'
  const variants = {
    primary:   'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 focus:ring-slate-300',
    danger:    'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 focus:ring-red-300',
    ghost:     'text-slate-600 hover:bg-slate-100 focus:ring-slate-300',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${size} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────
export function StatCard({ title, value, sub, icon: Icon, color = 'teal' }) {
  const palette = {
    teal:   'bg-teal-50 text-teal-600',
    emerald:'bg-emerald-50 text-emerald-600',
    amber:  'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-600',
    blue:   'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider truncate">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${palette[color]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Form primitives ─────────────────────────────────────────────────────
export function Field({ label, children, error }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-600 uppercase tracking-wider">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Input({ label, error, className = '', ...props }) {
  return (
    <Field label={label} error={error}>
      <input
        className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder:text-slate-300
          ${className}`}
        {...props}
      />
    </Field>
  )
}

export function SelectField({ label, options, error, className = '', ...props }) {
  return (
    <Field label={label} error={error}>
      <select
        className={`w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent ${className}`}
        {...props}
      >
        {options.map(o => (
          <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Checkbox({ label, name, checked, onChange }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all
        ${checked ? 'bg-teal-600 border-teal-600' : 'border-slate-300 bg-white'}`}>
        {checked && <Check size={11} color="white" strokeWidth={3} />}
      </div>
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────
export const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export const peso = (n) => `₱${Number(n || 0).toLocaleString()}`

export const daysSince = (dateStr) => {
  if (!dateStr) return null
  const diff = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00')) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 30)  return `${diff}d ago`
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`
  return `${Math.floor(diff / 365)}y ago`
}
