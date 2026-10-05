import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { UserProfile } from '@tabdo/types'
import { supabase } from '../../lib/supabase'
import type { AuthContextValue } from './types'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    setIsProfileLoading(true)
    setProfileError(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }

      if (!data) {
        throw new Error('Hồ sơ người dùng không tồn tại.')
      }

      const userProfile: UserProfile = {
        id: data.id,
        role: data.role as 'admin' | 'user',
        displayName: data.display_name,
        timezone: data.timezone,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
      setProfile(userProfile)
      return userProfile
    } catch (err: any) {
      const msg = err?.message || 'Không thể tải thông tin hồ sơ.'
      setProfileError(msg)
      setProfile(null)
      return null
    } finally {
      setIsProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Initial session load
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      setIsAuthLoading(false)

      if (initialSession?.user) {
        fetchProfile(initialSession.user.id)
      } else {
        setProfile(null)
        setProfileError(null)
      }
    }).catch(() => {
      if (!mounted) return
      setIsAuthLoading(false)
    })

    // Auth state subscriber
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setIsAuthLoading(false)

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id)
        } else {
          setProfile(null)
          setProfileError(null)
          setIsProfileLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        return { error: new Error(error.message) }
      }
      return { error: null }
    } catch (err: any) {
      return { error: new Error(err?.message || 'Đăng nhập thất bại') }
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
    setProfileError(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  const value: AuthContextValue = {
    session,
    user,
    profile,
    isAuthLoading,
    isProfileLoading,
    profileError,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
