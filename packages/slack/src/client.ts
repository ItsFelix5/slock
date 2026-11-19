import type { ApiReply } from "@slock/types";
import { isAuthError, slackErrorOf } from "./error";
import { sendRequest } from "./send";
import { forceReauth, isConfigured } from "./session/account";

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

async function request<T extends object>(
  method: string,
  path: string,
  requestBody?: unknown,
): Promise<ApiReply<T>> {
  const res = await sendRequest(path, {
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
  const res = await sendRequest(path, {
    body: file,
    headers: file.type ? { "content-type": file.type } : undefined,
    method: "POST",
  });
  return readResponse<T>(res);
}
