import { create } from "zustand";
import { AuthUser } from "@/types";
import { clearAccessToken, setAccessToken } from "@/lib/api-client";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setUser: (user: AuthUser, accessToken: string) => void;
  logout: () => void;
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,

  setUser: (user, accessToken) => {
    setAccessToken(accessToken);
    set({ user, isAuthenticated: true, isInitializing: false });
  },

  logout: () => {
    clearAccessToken();
    set({ user: null, isAuthenticated: false, isInitializing: false });
  },

  setInitialized: () => set({ isInitializing: false }),
}));
