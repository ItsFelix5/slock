export function errorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error || fallback;
  if (error != null) {
    try {
      const message = JSON.stringify(error);
      if (message) return message;
    } catch {}
  }
  return fallback;
}
