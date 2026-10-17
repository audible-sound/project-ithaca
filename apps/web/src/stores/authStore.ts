import type { SignInResponse } from "@ithaca/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type AuthStatus = "idle" | "loading" | "ready" | "error";

type AuthStore = {
  message: string | null;
  token: string | null;
  name: string | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      message: null,
      token: null,
      name: null,
      status: "idle",
      signIn: async (email, password) => {
        set({ status: "loading", message: null, token: null, name: null });

        try {
          const res = await fetch(`${apiUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = (await res.json()) as SignInResponse;
          const token = data.token ?? null;
          set({
            message: data.message,
            token,
            name: res.ok && token ? (data.name ?? null) : null,
            status: res.ok ? "ready" : "error",
          });
        } catch (err) {
          set({
            message: err instanceof Error ? err.message : "Failed to reach API",
            token: null,
            name: null,
            status: "error",
          });
        }
      },
      signOut: () => {
        set({ message: null, token: null, name: null, status: "idle" });
      },
    }),
    {
      name: "ithaca-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ token: state.token, name: state.name }),
    },
  ),
);
