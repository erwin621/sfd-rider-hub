import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing env vars. Running in mock/offline mode.')
}

export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseKey  || 'placeholder-key',
  { auth: { persistSession: true } }
)

/** Generic error handler — returns { data, error } like Supabase */
export async function safe(promise) {
  try {
    const res = await promise
    return res
  } catch (err) {
    console.error('[Supabase error]', err)
    return { data: null, error: err }
  }
}
