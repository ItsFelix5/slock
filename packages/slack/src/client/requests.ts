import type { ApiReply } from "@slock/types";
import { isAuthError, slackErrorOf } from "../error";
import { forceReauth, isConfigured } from "./account";
import { sendRequest } from "./send";

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
  } catch (cause) {
    throw slackErrorOf(
      {
        fallback: res.ok
          ? "expected a JSON response"
          : responseBody || `request failed with ${res.status} ${res.statusText}`,
        status: res.status,
      },
      { cause },
    );
  }
}

async function readResponse<T extends object>(res: Response): Promise<ApiReply<T>> {
  const responseBody = await res.text();
  const data = parseBody(responseBody, res);
  if (hasError(data) && isAuthError(data.error) && isConfigured()) return forceReauth();
  if (!(res.ok || hasError(data))) {
    throw slackErrorOf({
      fallback: `request failed with ${res.status} ${res.statusText}: ${responseBody}`,
      status: res.status,
    });
  }
  return { ...data, ok: res.ok };
}

const KEEPALIVE_MAX_BYTES = 60_000;

type RequestOptions = { keepalive?: boolean; signal?: AbortSignal };

async function request<T extends object>(
  method: string,
  path: string,
  requestBody?: unknown,
  { keepalive = false, signal }: RequestOptions = {},
): Promise<ApiReply<T>> {
  const body = requestBody === undefined ? undefined : JSON.stringify(requestBody);
  const res = await sendRequest(path, {
    keepalive: keepalive && new Blob([body ?? ""]).size <= KEEPALIVE_MAX_BYTES,
    method,
    signal,
    ...(body === undefined ? {} : { body, headers: { "content-type": "application/json" } }),
  });
  return readResponse<T>(res);
}

export function apiGet<T extends object = object>(
  path: string,
  signal?: AbortSignal,
): Promise<ApiReply<T>> {
  return request<T>("GET", path, undefined, { signal });
}
export function apiPost<T extends object = object>(
  path: string,
  body: unknown = {},
  signal?: AbortSignal,
): Promise<ApiReply<T>> {
  return request<T>("POST", path, body, { signal });
}
export function apiPut<T extends object = object>(
  path: string,
  body: unknown = {},
  options?: Pick<RequestOptions, "keepalive">,
): Promise<ApiReply<T>> {
  return request<T>("PUT", path, body, options);
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
  options?: Pick<RequestOptions, "keepalive">,
): Promise<ApiReply<T>> {
  return request<T>("DELETE", path, body, options);
}

export async function apiUpload<T extends object = object>(
  path: string,
  file: File,
): Promise<ApiReply<T>> {
  const res = await sendRequest(path, {
    body: file,
    headers: file.type ? { "content-type": file.type } : undefined,
    method: "POST",
  });
  return readResponse<T>(res);
}
