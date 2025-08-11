
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type UserRole = 'user' | 'admin';

interface AuthState {
  email: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (email: string, role: UserRole) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      email: null,
      role: null,
      isAuthenticated: false,
      login: (email, role) => set({ email, role, isAuthenticated: true }),
      logout: () => set({ email: null, role: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
