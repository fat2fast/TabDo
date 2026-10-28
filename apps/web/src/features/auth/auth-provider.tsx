import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { UserProfile } from '@tabdo/types'
import { supabase } from '../../lib/supabase'
import { advanceWriteIdentity, runGuardedWrite, setSessionWritesBlocked } from '../../lib/write-safety'
import type { AuthContextValue } from './types'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const profileRef = useRef<UserProfile | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [sessionVerification, setSessionVerification] = useState<'ready' | 'checking' | 'error'>('ready')
  const reconcileRef = useRef<() => void>(() => {})
  const [identityGeneration, setIdentityGeneration] = useState(0)
  const currentIdentity = useRef<string | null>(null)
  const currentSession = useRef<Session | null>(null)
  const generation = useRef(0)
  const profileRequest = useRef(0)
  const logoutBlocked = useRef(false)
  const logoutSequence = useRef(0)
  const logoutPending = useRef(false)

  const fetchProfile = useCallback(async (userId: string, isSilent = false) => {
    if (currentIdentity.current !== userId) return null
    const request = ++profileRequest.current
    const identity = generation.current
    const isCurrent = () => generation.current === identity && currentIdentity.current === userId && profileRequest.current === request
    if (!isSilent) {
      setIsProfileLoading(true)
    }
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
        isActive: data.is_active ?? true,
        mustChangePassword: data.must_change_password ?? false,
        locale: (data.locale as 'vi' | 'en') || 'vi',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
      if (isCurrent()) {
        profileRef.current = userProfile
        setProfile(userProfile)
      }
      return userProfile
    } catch (err: any) {
      const msg = err?.message || 'Không thể tải thông tin hồ sơ.'
      if (isCurrent() && !(profileRef.current?.id === userId && !navigator.onLine)) {
        profileRef.current = null
        setProfileError(msg)
        setProfile(null)
      }
      return null
    } finally {
      if (isCurrent()) {
        setIsProfileLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    let revision = 0

    const transition = (next: Session | null, refresh = false, signedIn = false) => {
      const nextId = next?.user?.id ?? null
      const changed = currentIdentity.current !== nextId
      if (nextId && (changed || (signedIn && next?.access_token !== currentSession.current?.access_token)) && (logoutBlocked.current || logoutPending.current)) {
        logoutSequence.current += 1
        logoutPending.current = false
        logoutBlocked.current = false
      }
      currentSession.current = next
      if (changed) {
        advanceWriteIdentity()
        currentIdentity.current = nextId
        generation.current += 1
        profileRequest.current += 1
        setIdentityGeneration(generation.current)
        profileRef.current = null
        setProfile(null)
        setProfileError(null)
        setIsProfileLoading(Boolean(nextId))
      }
      setSession(next)
      setSessionWritesBlocked(false)
      setSessionVerification('ready')
      if (!next) logoutBlocked.current = false
      if (!logoutBlocked.current) setAuthError(null)
      setUser(next?.user ?? null)
      setIsAuthLoading(false)
      if (nextId && (changed || refresh)) {
        const requestedGeneration = generation.current
        queueMicrotask(() => {
          if (mounted && generation.current === requestedGeneration) void fetchProfile(nextId, !changed)
        })
      }
    }

    const reconcile = () => {
      const startRevision = ++revision
      if (currentIdentity.current) {
        advanceWriteIdentity()
        setSessionWritesBlocked(true)
        setSessionVerification('checking')
      }
      void supabase.auth.getSession().then(({ data, error }) => {
        if (!mounted || revision !== startRevision) return
        if (error) throw error
        transition(data.session)
      }).catch(() => {
        if (!mounted || revision !== startRevision) return
        setIsAuthLoading(false)
        if (currentIdentity.current) setSessionVerification('error')
        else setAuthError('Không thể xác minh phiên đăng nhập. Vui lòng thử lại.')
      })
    }
    reconcileRef.current = reconcile

    // Initial session load
    reconcile()

    // Auth state subscriber
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return
        revision += 1
        transition(currentSession, event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION', event === 'SIGNED_IN')
      }
    )

    const onVisible = () => { if (document.visibilityState === 'visible') reconcile() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', reconcile)
    window.addEventListener('online', reconcile)

    return () => {
      mounted = false
      generation.current += 1
      currentIdentity.current = null
      currentSession.current = null
      advanceWriteIdentity()
      setSessionWritesBlocked(false)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', reconcile)
      window.removeEventListener('online', reconcile)
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await runGuardedWrite(() => supabase.auth.signInWithPassword({ email, password }))
      if (error) {
        return { error: new Error(error.message) }
      }
      logoutBlocked.current = false
      setAuthError(null)
      return { error: null }
    } catch (err: any) {
      return { error: new Error(err?.message || 'Đăng nhập thất bại') }
    }
  }, [])

  const signOut = useCallback(async () => {
    if (logoutPending.current) return
    logoutPending.current = true
    const operation = ++logoutSequence.current
    const ownsOperation = () => logoutSequence.current === operation
    const signingOutIdentity = currentIdentity.current
    logoutBlocked.current = true
    advanceWriteIdentity()
    generation.current += 1
    profileRequest.current += 1
    setIdentityGeneration(generation.current)
    setAuthError('Đang đăng xuất...')
    try {
      const result = await supabase.auth.signOut()
      if (!ownsOperation()) return
      let current = await supabase.auth.getSession()
      if (!ownsOperation()) return
      if (current.error) throw current.error
      if ((currentIdentity.current && currentIdentity.current !== signingOutIdentity) || (current.data.session && current.data.session.user.id !== signingOutIdentity)) {
        throw new Error('Phiên đăng nhập đã thay đổi trong lúc đăng xuất.')
      }
      if (current.data.session && result.error) {
        await supabase.auth.signOut({ scope: 'local' })
        if (!ownsOperation()) return
        current = await supabase.auth.getSession()
        if (!ownsOperation()) return
        if (current.error) throw current.error
      }
      if (currentIdentity.current && currentIdentity.current !== signingOutIdentity) throw new Error('Phiên đăng nhập đã thay đổi trong lúc đăng xuất.')
      if (current.data.session) throw new Error('Không thể xóa phiên đăng nhập trên thiết bị này.')
      currentIdentity.current = null
      currentSession.current = null
      generation.current += 1
      profileRequest.current += 1
      setIdentityGeneration(generation.current)
      setSession(null)
      setUser(null)
      profileRef.current = null
      setProfile(null)
      setProfileError(null)
      setIsProfileLoading(false)
      logoutBlocked.current = false
      setAuthError(null)
    } catch {
      if (ownsOperation()) setAuthError('Không thể xác nhận đăng xuất trên thiết bị này. Vui lòng thử lại.')
    } finally {
      if (ownsOperation()) logoutPending.current = false
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user && generation.current === identityGeneration && currentIdentity.current === user.id) {
      await fetchProfile(user.id)
    }
  }, [user, identityGeneration, fetchProfile])

  const value: AuthContextValue = {
    session,
    user,
    profile,
    isAuthLoading,
    isProfileLoading,
    profileError,
    authError,
    sessionVerification,
    retrySession: () => { if (logoutBlocked.current) void signOut(); else reconcileRef.current() },
    identityGeneration,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useOptionalAuth() {
  return useContext(AuthContext)
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
