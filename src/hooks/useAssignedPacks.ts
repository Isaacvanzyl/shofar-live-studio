import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface PackItem {
  id: string
  pack_id: string
  type: 'lowerthird' | 'screen' | 'ticker'
  name: string
  data: Record<string, unknown>
}

export interface Pack {
  id: string
  name: string
  description: string | null
  items: PackItem[]
}

export function useAssignedPacks(type: PackItem['type']) {
  const { profile } = useAuth()
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.org_id) { setLoading(false); return }

    const load = async () => {
      setLoading(true)
      const { data: assignments } = await supabase
        .from('org_pack_assignments')
        .select('pack_id')
        .eq('org_id', profile.org_id)

      if (!assignments?.length) { setPacks([]); setLoading(false); return }

      const packIds = assignments.map(a => a.pack_id)

      const { data: packsData } = await supabase
        .from('preset_packs')
        .select('id, name, description')
        .in('id', packIds)
        .order('created_at')

      const { data: items } = await supabase
        .from('preset_items')
        .select('*')
        .in('pack_id', packIds)
        .eq('type', type)

      const result: Pack[] = (packsData ?? []).map(p => ({
        ...p,
        items: (items ?? []).filter(i => i.pack_id === p.id),
      })).filter(p => p.items.length > 0)

      setPacks(result)
      setLoading(false)
    }

    load()
  }, [profile?.org_id, type])

  return { packs, loading }
}
