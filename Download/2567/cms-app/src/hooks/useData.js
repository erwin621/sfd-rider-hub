import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  MOCK_VISITS, MOCK_WATCHLIST, MOCK_EXPENSES,
  MOCK_TECHNICIANS, MOCK_SITES,
} from '../data/mockData'

const IS_MOCK = !import.meta.env.VITE_SUPABASE_URL ||
                import.meta.env.VITE_SUPABASE_URL === 'https://placeholder.supabase.co'

let _uid = 1000
const uid = () => `local-${++_uid}`

// ─── useVisits ─────────────────────────────────────────────────────────────
export function useVisits() {
  const [visits, setVisits]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    if (IS_MOCK) {
      setVisits(MOCK_VISITS)
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .order('visit_date', { ascending: false })
    if (error) setError(error.message)
    else setVisits(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const addVisit = useCallback(async (row) => {
    if (IS_MOCK) {
      const item = { ...row, id: uid(), income: Number(row.income) || 0 }
      setVisits(prev => [item, ...prev])
      return { data: item, error: null }
    }
    const { data, error } = await supabase.from('visits').insert(row).select().single()
    if (!error) setVisits(prev => [data, ...prev])
    return { data, error }
  }, [])

  const updateVisit = useCallback(async (id, updates) => {
    if (IS_MOCK) {
      setVisits(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v))
      return { error: null }
    }
    const { data, error } = await supabase.from('visits').update(updates).eq('id', id).select().single()
    if (!error) setVisits(prev => prev.map(v => v.id === id ? data : v))
    return { data, error }
  }, [])

  const deleteVisit = useCallback(async (id) => {
    if (IS_MOCK) {
      setVisits(prev => prev.filter(v => v.id !== id))
      return { error: null }
    }
    const { error } = await supabase.from('visits').delete().eq('id', id)
    if (!error) setVisits(prev => prev.filter(v => v.id !== id))
    return { error }
  }, [])

  return { visits, loading, error, addVisit, updateVisit, deleteVisit, refetch: fetch }
}

// ─── useWatchlist ──────────────────────────────────────────────────────────
export function useWatchlist() {
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (IS_MOCK) { setWatchlist(MOCK_WATCHLIST); setLoading(false); return }
    supabase.from('watchlist').select('*').eq('resolved', false)
      .then(({ data }) => { setWatchlist(data || []); setLoading(false) })
  }, [])

  const addItem = useCallback(async (row) => {
    if (IS_MOCK) {
      const item = { ...row, id: uid(), resolved: false }
      setWatchlist(prev => [item, ...prev])
      return { data: item, error: null }
    }
    const { data, error } = await supabase.from('watchlist').insert(row).select().single()
    if (!error) setWatchlist(prev => [data, ...prev])
    return { data, error }
  }, [])

  const resolveItem = useCallback(async (id) => {
    if (IS_MOCK) {
      setWatchlist(prev => prev.filter(w => w.id !== id))
      return { error: null }
    }
    const { error } = await supabase.from('watchlist')
      .update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', id)
    if (!error) setWatchlist(prev => prev.filter(w => w.id !== id))
    return { error }
  }, [])

  const deleteItem = useCallback(async (id) => {
    if (IS_MOCK) { setWatchlist(prev => prev.filter(w => w.id !== id)); return { error: null } }
    const { error } = await supabase.from('watchlist').delete().eq('id', id)
    if (!error) setWatchlist(prev => prev.filter(w => w.id !== id))
    return { error }
  }, [])

  return { watchlist, loading, addItem, resolveItem, deleteItem }
}

// ─── useExpenses ───────────────────────────────────────────────────────────
export function useExpenses() {
  const [expenses, setExpenses] = useState(MOCK_EXPENSES)

  useEffect(() => {
    if (IS_MOCK) return
    supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setExpenses(data[0]) })
  }, [])

  const saveExpenses = useCallback(async (updates) => {
    const updated = { ...expenses, ...updates }
    if (IS_MOCK) { setExpenses(updated); return { error: null } }
    const { error } = await supabase.from('expenses').upsert({ ...updated, id: expenses.id })
    if (!error) setExpenses(updated)
    return { error }
  }, [expenses])

  return { expenses, saveExpenses }
}

// ─── useTechnicians ────────────────────────────────────────────────────────
export function useTechnicians() {
  const [technicians, setTechnicians] = useState(MOCK_TECHNICIANS)

  useEffect(() => {
    if (IS_MOCK) return
    supabase.from('technicians').select('*').eq('active', true)
      .then(({ data }) => { if (data) setTechnicians(data) })
  }, [])

  const addTech = useCallback(async (row) => {
    if (IS_MOCK) {
      const item = { ...row, id: uid(), active: true }
      setTechnicians(prev => [...prev, item])
      return { data: item, error: null }
    }
    const { data, error } = await supabase.from('technicians').insert(row).select().single()
    if (!error) setTechnicians(prev => [...prev, data])
    return { data, error }
  }, [])

  const deleteTech = useCallback(async (id) => {
    if (IS_MOCK) { setTechnicians(prev => prev.filter(t => t.id !== id)); return { error: null } }
    const { error } = await supabase.from('technicians').update({ active: false }).eq('id', id)
    if (!error) setTechnicians(prev => prev.filter(t => t.id !== id))
    return { error }
  }, [])

  return { technicians, addTech, deleteTech }
}

// ─── useSites ──────────────────────────────────────────────────────────────
export function useSites() {
  const [sites, setSites] = useState(MOCK_SITES)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async () => {
    if (IS_MOCK) return
    setLoading(true)
    const { data } = await supabase.from('sites').select('*').order('locality')
    if (data) setSites(data)
    setLoading(false)
  }, [])

  return { sites, loading, refetch }
}
