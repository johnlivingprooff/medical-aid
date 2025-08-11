import React, { createContext, useContext, useEffect, useState } from 'react'
import { me } from '@/lib/auth'

type User = { id: number; username: string; role: string } | null

type AuthContextType = {
  user: User
  loading: boolean
  setUser: (u: User) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    me().then((u) => setUser(u)).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
