// biome-ignore-all lint/style/useNamingConvention: Slack payloads preserve Slack's wire field names.

import {
  namedSlackAssetResponse,
  slackAssetResponse,
  slackUploadResponse,
  uploadCapability,
} from "./assets.ts";
import { authResponse, type Credentials, jsonHeaders, logoutResponse } from "./auth.ts";
import { emojiImageUrl, emojiListResponse } from "./emoji.ts";
import { jsonResponse } from "./http/jsonResponse.ts";
import { bootstrapResponse } from "./operations/bootstrap.ts";
import { accountRoutes } from "./routes/account.ts";
import { activityRoutes } from "./routes/activity.ts";
import { appRoutes } from "./routes/apps.ts";
import { canvasRoutes } from "./routes/canvases.ts";
import { channelDirectoryRoutes } from "./routes/channelDirectory.ts";
import { channelRoutes } from "./routes/channels.ts";
import { commandRoutes } from "./routes/commands.ts";
import { conversationViewRoutes } from "./routes/conversationView.ts";
import { draftRoutes } from "./routes/drafts.ts";
import { messageActionRoutes } from "./routes/messageActions.ts";
import { messageRoutes } from "./routes/messages.ts";
import { preferenceRoutes } from "./routes/preferences.ts";
import { matchRoute, type Route } from "./routes/router.ts";
import { searchRoutes } from "./routes/search.ts";
import { sectionRoutes } from "./routes/sections.ts";
import { threadRoutes } from "./routes/threads.ts";
import { usergroupRoutes } from "./routes/usergroups.ts";
import { userStatusRoutes } from "./routes/userStatus.ts";
import { callSlack } from "./slackClient.ts";

// Purpose-built routes, one group per resource area.
// channelDirectoryRoutes comes before channelRoutes so its literal
// "/api/channels/browse" and "/api/channels/lookup" paths match before
// channelRoutes' "/api/channels/:id" catch-all would otherwise swallow them
// as a channel id.
const ROUTES: Route[] = [
  ...messageActionRoutes,
  ...messageRoutes,
  ...threadRoutes,
  ...conversationViewRoutes,
  ...channelDirectoryRoutes,
  ...channelRoutes,
  ...sectionRoutes,
  ...canvasRoutes,
  ...draftRoutes,
  ...accountRoutes,
  ...usergroupRoutes,
  ...appRoutes,
  ...searchRoutes,
  ...preferenceRoutes,
  ...activityRoutes,
  ...commandRoutes,
  ...userStatusRoutes,
];

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
    return bootstrapResponse(creds, acceptEncoding, searchParams.get("sections") === "true");
  }
  if (method === "GET" && pathname === "/api/emoji") {
    return emojiListResponse(creds, callSlack, acceptEncoding);
  }
  if (method === "GET" && pathname.startsWith("/api/emoji/")) {
    const name = decodeURIComponent(pathname.slice("/api/emoji/".length));
    const url = await emojiImageUrl(name, creds, callSlack);
    const res = await namedSlackAssetResponse(url, creds, acceptEncoding);
    res.headers.append("vary", "Cookie");
    return res;
  }
  if (method === "GET" && pathname.startsWith("/api/assets/")) {
    return slackAssetResponse(pathname.slice("/api/assets/".length), creds, acceptEncoding);
  }
  if (method === "POST" && pathname === "/api/files/reserve") {
    const params = (await body.json()) as Record<string, string>;
    if (!(params.filename && params.length)) {
      return new Response(JSON.stringify({ error: "invalid_file" }), {
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
      return new Response(
        JSON.stringify({ error: reservation.error ?? "file reservation failed" }),
        {
          headers: jsonHeaders,
          status: 502,
        },
      );
    }
    const capability = uploadCapability(reservation.upload_url, creds);
    if (!capability) {
      return new Response(JSON.stringify({ error: "invalid_upload_url" }), {
        headers: jsonHeaders,
        status: 502,
      });
    }
    return new Response(
      JSON.stringify({ file_id: reservation.file_id, upload_token: capability }),
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
    const data = await callSlack(
      "files.completeUploadExternal",
      (await body.json()) as Record<string, string>,
      creds,
    );
    if (!data.ok)
      return jsonResponse(
        { error: data.error ?? "file upload failed" },
        creds,
        acceptEncoding,
        502,
      );
    return jsonResponse({}, creds, acceptEncoding);
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
