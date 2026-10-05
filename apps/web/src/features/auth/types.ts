import type { Session, User } from '@supabase/supabase-js'
import type { UserProfile } from '@tabdo/types'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  isAuthLoading: boolean
  isProfileLoading: boolean
  profileError: string | null
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}
