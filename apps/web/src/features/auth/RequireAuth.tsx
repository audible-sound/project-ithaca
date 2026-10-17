import type { ReactElement } from "react";
import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "../../stores/authStore";
import { useAuthHydrated } from "./useAuthHydrated";

export function RequireAuth(): ReactElement | null {
  const hydrated = useAuthHydrated();
  const token = useAuthStore((state) => state.token);

  if (!hydrated) {
    return null;
  }

  if (!token) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
}
