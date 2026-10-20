import type { ApiReply } from "@slock/types";
import { forceReauth, isConfigured } from "../session/account";
import { isAuthError } from "./authErrors";

export class ApiError extends Error {
  retryAfterMs?: number;
  constructor(message: string, retryAfter?: string) {
    super(message);
    this.name = "ApiError";
    const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
    if (Number.isFinite(seconds)) this.retryAfterMs = seconds * 1000;
  }
}

function hasError(data: unknown): data is { error: string } {
  return !!(
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "error" in data &&
    typeof data.error === "string"
  );
}

function parseBody(responseBody: string, res: Response) {
  try {
    return JSON.parse(responseBody);
  } catch (error) {
    throw new Error(
      res.ok
        ? "expected a JSON response"
        : responseBody || `request failed with ${res.status} ${res.statusText}`,
      { cause: error },
    );
  }
}

async function readResponse<T extends object>(res: Response): Promise<ApiReply<T>> {
  const responseBody = await res.text();
  const data = parseBody(responseBody, res);
  if (hasError(data) && isAuthError(data.error) && isConfigured()) return forceReauth();
  if (!(res.ok || hasError(data))) {
    throw new Error(`request failed with ${res.status} ${res.statusText}: ${responseBody}`);
  }
  return { ...data, ok: res.ok };
}

async function request<T extends object>(
  method: string,
  path: string,
  requestBody?: unknown,
): Promise<ApiReply<T>> {
  const res = await fetch(path, {
    method,
    ...(requestBody === undefined
      ? {}
      : {
          body: JSON.stringify(requestBody),
          headers: { "content-type": "application/json" },
        }),
  });
  return readResponse<T>(res);
}

export function apiGet<T extends object = object>(path: string): Promise<ApiReply<T>> {
  return request<T>("GET", path);
}
export function apiPost<T extends object = object>(
  path: string,
  body: unknown = {},
): Promise<ApiReply<T>> {
  return request<T>("POST", path, body);
}
export function apiPut<T extends object = object>(
  path: string,
  body: unknown = {},
): Promise<ApiReply<T>> {
  return request<T>("PUT", path, body);
}
export function apiPatch<T extends object = object>(
  path: string,
  body: unknown = {},
): Promise<ApiReply<T>> {
  return request<T>("PATCH", path, body);
}
export function apiDelete<T extends object = object>(
  path: string,
  body?: unknown,
): Promise<ApiReply<T>> {
  return request<T>("DELETE", path, body);
}

export async function apiUpload<T extends object = object>(
  path: string,
  file: File,
): Promise<ApiReply<T>> {
  const res = await fetch(path, {
    body: file,
    headers: file.type ? { "content-type": file.type } : undefined,
    method: "POST",
  });
  return readResponse<T>(res);
}
