import type { SignInResponse } from "@ithaca/shared";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apiUrl, readJson } from "./api";
import type { RequestStatus } from "./api";

type AuthStore = {
  message: string | null;
  token: string | null;
  name: string | null;
  userId: string | null;
  status: RequestStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      message: null,
      token: null,
      name: null,
      userId: null,
      status: "idle",
      signIn: async (email, password) => {
        set({
          status: "loading",
          message: null,
          token: null,
          name: null,
          userId: null,
        });

        try {
          const res = await fetch(`${apiUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await readJson<SignInResponse>(res);
          const token = "token" in data ? (data.token ?? null) : null;
          set({
            message: data.message,
            token,
            name:
              res.ok && token && "name" in data ? (data.name ?? null) : null,
            userId:
              res.ok && token && "userId" in data ? (data.userId ?? null) : null,
            status: res.ok ? "ready" : "error",
          });
        } catch (err) {
          set({
            message: err instanceof Error ? err.message : "Failed to reach API",
            token: null,
            name: null,
            userId: null,
            status: "error",
          });
        }
      },
      signOut: () => {
        set({
          message: null,
          token: null,
          name: null,
          userId: null,
          status: "idle",
        });
      },
    }),
    {
      name: "ithaca-auth",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        name: state.name,
        userId: state.userId,
      }),
    },
  ),
);
