import { create } from 'zustand'
import type { UserInfo } from '@/types'

interface AuthState {
  user: UserInfo | null
  isAuthenticated: boolean
  setUser: (user: UserInfo | null) => void
  logout: () => void
}

const loadUserFromStorage = (): UserInfo | null => {
  try {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

const saveUserToStorage = (user: UserInfo | null) => {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
  } else {
    localStorage.removeItem('user')
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUserFromStorage(),
  isAuthenticated: !!loadUserFromStorage(),
  setUser: (user) => {
    saveUserToStorage(user)
    set({ user, isAuthenticated: !!user })
  },
  logout: () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    set({ user: null, isAuthenticated: false })
  },
}))

