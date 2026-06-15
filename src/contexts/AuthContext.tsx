import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface Profile {
  id: string
  org_id: string | null
  role: 'admin' | 'operator'
  display_name: string | null
}

export interface Org {
  id: string
  name: string
  slug: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  org: Org | null
  loading: boolean
  isAdmin: boolean
  // Prefix a channel name with this org's id
  channelKey: (channel: string) => string
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, org_id, role, display_name')
    .eq('id', userId)
    .single()
  return data as Profile | null
}

async function fetchOrg(orgId: string): Promise<Org | null> {
  const { data } = await supabase
    .from('orgs')
    .select('id, name, slug')
    .eq('id', orgId)
    .single()
  return data as Org | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfileAndOrg(u: User) {
    const p = await fetchProfile(u.id)
    setProfile(p)
    if (p?.org_id) {
      const o = await fetchOrg(p.org_id)
      setOrg(o)
    } else {
      setOrg(null)
    }
  }

  async function refreshProfile() {
    if (user) await loadProfileAndOrg(user)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) await loadProfileAndOrg(s.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        await loadProfileAndOrg(s.user)
      } else {
        setProfile(null)
        setOrg(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = profile?.role === 'admin'

  function channelKey(channel: string): string {
    if (!profile?.org_id) return channel
    return `${profile.org_id}:${channel}`
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user, session, profile, org, loading, isAdmin,
      channelKey, signIn, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
