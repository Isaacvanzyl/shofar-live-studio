import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function setState(channel: string, state: object) {
  return supabase
    .from('broadcast_state')
    .upsert({ id: channel, state, updated_at: new Date().toISOString() })
}

export async function getState(channel: string) {
  const { data } = await supabase
    .from('broadcast_state')
    .select('state')
    .eq('id', channel)
    .single()
  return data?.state ?? null
}

export function subscribeToState(
  channel: string,
  callback: (state: unknown) => void,
  onConnect?: () => void
) {
  return supabase
    .channel('broadcast_state:' + channel)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'broadcast_state',
        filter: `id=eq.${channel}`,
      },
      (payload) => callback((payload.new as { state: unknown }).state)
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && onConnect) onConnect()
    })
}
