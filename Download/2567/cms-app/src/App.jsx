import { useState } from 'react'
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Home, ClipboardList, MapPin, BarChart2,
  Settings, Wifi, Menu, X,
} from 'lucide-react'
import Dashboard   from './pages/Dashboard'
import Visits      from './pages/Visits'
import Sites       from './pages/Sites'
import Reports     from './pages/Reports'
import SettingsPage from './pages/Settings'
import { useVisits, useWatchlist, useExpenses, useTechnicians, useSites } from './hooks/useData'

const NAV = [
  { path: '/',         label: 'Dashboard', icon: Home },
  { path: '/visits',   label: 'Visits',    icon: ClipboardList },
  { path: '/sites',    label: 'Sites',     icon: MapPin },
  { path: '/reports',  label: 'Reports',   icon: BarChart2 },
  { path: '/settings', label: 'Settings',  icon: Settings },
]

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const visitsHook      = useVisits()
  const watchlistHook   = useWatchlist()
  const expensesHook    = useExpenses()
  const techniciansHook = useTechnicians()
  const sitesHook       = useSites()

  const shared = { visitsHook, watchlistHook, expensesHook, techniciansHook, sitesHook }

  const pageTitle = NAV.find(n => n.path === location.pathname)?.label ?? 'Site CMS'

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-slate-950 border-r border-slate-800">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <aside className="relative w-72 bg-slate-950 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <Brand />
              <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>
            <NavItems onClick={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      {/* ── Main ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
        <header className="md:hidden shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-teal-600 rounded flex items-center justify-center">
              <Wifi size={12} color="white" />
            </div>
            <span className="font-semibold text-slate-900 text-sm">{pageTitle}</span>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-8">
            <Routes>
              <Route path="/"         element={<Dashboard   {...shared} />} />
              <Route path="/visits"   element={<Visits      {...shared} />} />
              <Route path="/sites"    element={<Sites       {...shared} />} />
              <Route path="/reports"  element={<Reports     {...shared} />} />
              <Route path="/settings" element={<SettingsPage {...shared} />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Nav ─────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-30 pb-safe">
        {NAV.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${isActive ? 'text-teal-600' : 'text-slate-400'}`
            }>
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center shrink-0">
        <Wifi size={16} color="white" />
      </div>
      <div>
        <p className="text-white text-sm font-bold leading-tight">Site CMS</p>
        <p className="text-slate-500 text-xs">Network Ops · NCR</p>
      </div>
    </div>
  )
}

function NavItems({ onClick }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
      {NAV.map(({ path, label, icon: Icon }) => (
        <NavLink key={path} to={path} end={path === '/'} onClick={onClick}
          className={({ isActive }) =>
            `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`
          }>
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarContent() {
  return (
    <>
      <div className="px-5 py-5 border-b border-slate-800">
        <Brand />
      </div>
      <NavItems />
      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-600 font-mono">Jun 1–15, 2026</p>
        <p className="text-xs text-slate-700 mt-0.5">NCR Metro Manila</p>
      </div>
    </>
  )
}
