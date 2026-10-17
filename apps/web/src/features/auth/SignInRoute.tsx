import type { ReactElement } from "react";
import { Navigate } from "react-router";
import { useAuthStore } from "../../stores/authStore";
import { AuthPage } from "./AuthPage";
import { useAuthHydrated } from "./useAuthHydrated";

export function SignInRoute(): ReactElement | null {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((state) => state.token);

  if (!hydrated) {
    return null;
  }

  if (token) {
    return <Navigate to="/" replace />;
  }

  return <AuthPage />;
}
