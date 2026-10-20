import { useAuthStore } from "./authStore";

export const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type RequestStatus = "idle" | "loading" | "ready" | "error";

export function authToken(): string | null {
  return useAuthStore.getState().token;
}

export async function readJson<T>(
  res: Response,
): Promise<T | { message: string }> {
  try {
    return (await res.json()) as T;
  } catch {
    return { message: "Failed to reach API" };
  }
}
