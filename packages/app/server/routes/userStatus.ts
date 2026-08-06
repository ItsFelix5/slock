import { errorResponse, jsonResponse } from "../http/jsonResponse.ts";
import { type Route, route } from "./router.ts";

type UserStatus = "eligible" | "over_18" | "banned" | "unverified";

const USER_ID_RE = /^[UW][A-Z0-9]+$/;
const FETCH_TIMEOUT_MS = 8_000;

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
}

export const userStatusRoutes: Route[] = [
  // Proxies Hack Club's identity/Hackatime trust lookups server-side — the
  // browser can't call these directly (no CORS), and routing them through
  // here keeps the two hardcoded external hosts out of client code.
  route("GET", "/api/user-status/:id", async (ctx) => {
    if (!ctx.creds) return errorResponse("not configured", 401);
    const { id } = ctx.params;
    if (!USER_ID_RE.test(id)) return errorResponse("invalid_user", 400);

    let identity: any;
    let hackatime: any;
    try {
      [identity, hackatime] = await Promise.all([
        fetchJson(`https://identity.hackclub.com/api/external/check?slack_id=${id}`),
        fetchJson(`https://hackatime.hackclub.com/api/v1/users/${id}/trust_factor`),
      ]);
    } catch {
      return errorResponse("user_status_unavailable", 502);
    }

    let status: UserStatus = "unverified";
    if (hackatime?.trust_value === 1) status = "banned";
    else if (identity?.result === "verified_eligible") status = "eligible";
    else if (identity?.result === "verified_but_over_18") status = "over_18";

    return jsonResponse({ ok: true, status }, ctx.creds, ctx.acceptEncoding);
  }),
];
