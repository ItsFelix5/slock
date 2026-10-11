export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (error != null) {
    try {
      const message = JSON.stringify(error);
      if (message) return message;
    } catch {}
  }
  return fallback;
}
