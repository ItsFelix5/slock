import { service } from "@slock/core/solid";
import type { MemeSource } from "../api";

const env = service("env");

export async function fetchSource(source: MemeSource, signal: AbortSignal): Promise<Blob> {
  for (const url of source.urls) {
    try {
      const response = await env.fetch(url, { signal });
      if (response.ok) return await response.blob();
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  throw new Error("This image couldn't be loaded.");
}
