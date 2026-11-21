export function errorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error || fallback;
  if (error == null) return fallback;
  try {
    return JSON.stringify(error) || fallback;
  } catch {
    return fallback;
  }
}
