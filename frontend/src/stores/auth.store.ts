import { create } from "zustand";
import { AuthUser } from "@/types";
import { clearAccessToken, setAccessToken } from "@/lib/api-client";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser, accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user, accessToken) => {
    setAccessToken(accessToken);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    clearAccessToken();
    set({ user: null, isAuthenticated: false });
  },
}));
