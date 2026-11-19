import { networkError } from "./error";

export async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch (cause) {
    throw networkError(cause);
  }
}
