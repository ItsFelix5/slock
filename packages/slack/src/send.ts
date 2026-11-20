import { service } from "@slock/core/solid";
import { networkError } from "./error";

const env = service("env");

export async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  try {
    return await env.fetch(path, init);
  } catch (cause) {
    throw networkError(cause);
  }
}
