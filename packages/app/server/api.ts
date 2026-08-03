// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.

import {
  namedSlackAssetResponse,
  slackAssetResponse,
  slackUploadResponse,
  uploadCapability,
} from "./assets.ts";
import { authResponse, type Credentials, jsonHeaders, logoutResponse } from "./auth.ts";
import { emojiImageUrl, emojiListResponse } from "./emoji.ts";
import { compressedResponse } from "./http/compressedResponse.ts";
import { flaronChannelResponse } from "./lookup/flaronChannel.ts";
import { SLACK_EDGE_OPERATIONS, SLACK_OPERATIONS } from "./operations/allowedSlackOperations.ts";
import { bootstrapResponse } from "./operations/bootstrap.ts";
import { messageActionRoutes } from "./routes/messageActions.ts";
import { messageRoutes } from "./routes/messages.ts";
import { matchRoute, type Route } from "./routes/router.ts";
import { threadRoutes } from "./routes/threads.ts";
import { callSlack, callSlackEdge } from "./slackClient.ts";

// Purpose-built routes, populated per resource area as operations migrate off
// the generic /api/operations/:method passthrough below.
const ROUTES: Route[] = [...messageActionRoutes, ...messageRoutes, ...threadRoutes];

async function slackOperationResponse(
  method: string,
  params: Record<string, string>,
  creds: Credentials | null,
  acceptEncoding: string | null,
): Promise<Response> {
  const data = await callSlack(method, params, creds);
  return compressedResponse(JSON.stringify(data), jsonHeaders, acceptEncoding);
}
async function slackEdgeOperationResponse(
  method: string,
  params: Record<string, unknown>,
  creds: Credentials | null,
  acceptEncoding: string | null,
): Promise<Response> {
  const data = await callSlackEdge(method, params, creds);
  return compressedResponse(JSON.stringify(data), jsonHeaders, acceptEncoding);
}
export async function routeApiRequest(
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  creds: Credentials | null,
  secure: boolean,
  acceptEncoding: string | null,
  body: {
    json(): Promise<Record<string, unknown>>;
    text(): Promise<string>;
    buffer(): Promise<Uint8Array>;
  },
): Promise<Response | null> {
  const matched = matchRoute(ROUTES, method, pathname);
  if (matched) {
    return matched.route.handler({
      acceptEncoding,
      body,
      creds,
      params: matched.params,
      searchParams,
      secure,
    });
  }
  if (method === "GET" && pathname === "/api/bootstrap") {
    return bootstrapResponse(
      creds,
      callSlack,
      acceptEncoding,
      searchParams.get("sections") === "true",
    );
  }
  if (method === "POST" && pathname.startsWith("/api/operations/")) {
    const slackMethod = pathname.slice("/api/operations/".length);
    if (!SLACK_OPERATIONS.has(slackMethod)) return new Response("not found", { status: 404 });
    return slackOperationResponse(
      slackMethod,
      (await body.json()) as Record<string, string>,
      creds,
      acceptEncoding,
    );
  }
  if (method === "POST" && pathname.startsWith("/api/edge-operations/")) {
    const slackMethod = pathname.slice("/api/edge-operations/".length);
    if (!SLACK_EDGE_OPERATIONS.has(slackMethod)) return new Response("not found", { status: 404 });
    return slackEdgeOperationResponse(slackMethod, await body.json(), creds, acceptEncoding);
  }
  if (method === "GET" && pathname === "/api/emoji") {
    return emojiListResponse(creds, callSlack, acceptEncoding);
  }
  if (method === "GET" && pathname.startsWith("/api/emoji/")) {
    const name = decodeURIComponent(pathname.slice("/api/emoji/".length));
    const url = await emojiImageUrl(name, creds, callSlack);
    const res = await namedSlackAssetResponse(url, creds);
    res.headers.set("vary", "Cookie");
    return res;
  }
  if (method === "GET" && pathname.startsWith("/api/assets/")) {
    return slackAssetResponse(pathname.slice("/api/assets/".length), creds);
  }
  if (method === "POST" && pathname === "/api/files/reserve") {
    const params = (await body.json()) as Record<string, string>;
    if (!(params.filename && params.length)) {
      return new Response(JSON.stringify({ error: "invalid_file", ok: false }), {
        headers: jsonHeaders,
        status: 400,
      });
    }
    const reservation = await callSlack(
      "files.getUploadURLExternal",
      { filename: params.filename, length: params.length },
      creds,
    );
    if (!(reservation.ok && reservation.upload_url && creds)) {
      return new Response(JSON.stringify(reservation), { headers: jsonHeaders });
    }
    const capability = uploadCapability(reservation.upload_url, creds);
    if (!capability) {
      return new Response(JSON.stringify({ error: "invalid_upload_url", ok: false }), {
        headers: jsonHeaders,
        status: 502,
      });
    }
    return new Response(
      JSON.stringify({ file_id: reservation.file_id, ok: true, upload_token: capability }),
      { headers: jsonHeaders },
    );
  }
  if (method === "POST" && pathname.startsWith("/api/files/upload/")) {
    return slackUploadResponse(
      await body.buffer(),
      pathname.slice("/api/files/upload/".length),
      searchParams.get("filename"),
      creds,
    );
  }
  if (method === "POST" && pathname === "/api/files/complete") {
    return slackOperationResponse(
      "files.completeUploadExternal",
      (await body.json()) as Record<string, string>,
      creds,
      acceptEncoding,
    );
  }
  if (method === "GET" && pathname === "/api/channels/discovery") {
    return flaronChannelResponse(searchParams.get("id"));
  }
  if (method === "POST" && pathname === "/api/session") {
    const raw = await body.text();
    if (!raw) return new Response("missing raw", { status: 400 });
    return authResponse(raw, secure);
  }
  if (method === "DELETE" && pathname === "/api/session") {
    return logoutResponse();
  }
  return null;
}
