import { createBrowserClient } from '@supabase/ssr'
import { env } from './env'
import type { Database } from '@/types/supabase'

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
