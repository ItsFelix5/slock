import { errorResponse, jsonResponse } from "../../http/jsonResponse.ts";
import { type Route, route } from "../router.ts";

type UserStatus = "eligible" | "over_18" | "banned" | "unverified";
type Lookup = "identity" | "hackatime";
type LookupFailure = { lookup: Lookup; reason: string };

const USER_ID_RE = /^[UW][A-Z0-9]+$/;
const FETCH_TIMEOUT_MS = 8_000;

async function fetchJson(lookup: Lookup, url: string): Promise<any> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${lookup} responded ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchTrustFactor(id: string): Promise<any> {
  const res = await fetch(`https://hackatime.hackclub.com/api/v1/users/${id}/trust_factor`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`hackatime responded ${res.status} ${res.statusText}`);
  return res.json();
}

function failure(lookup: Lookup, error: unknown): LookupFailure {
  const message = error instanceof Error ? error.message : String(error);
  return { lookup, reason: message.slice(0, 240) };
}

export const userStatusRoutes: Route[] = [
  route("GET", "/api/user-status/:id", async (ctx) => {
    if (!ctx.creds) return errorResponse("not configured", 401);
    const { id } = ctx.params;
    if (!USER_ID_RE.test(id)) return errorResponse("invalid_user", 400);

    const [identityResult, hackatimeResult] = await Promise.allSettled([
      fetchJson("identity", `https://identity.hackclub.com/api/external/check?slack_id=${id}`),
      fetchTrustFactor(id),
    ]);
    const failures = [
      ...(identityResult.status === "rejected" ? [failure("identity", identityResult.reason)] : []),
      ...(hackatimeResult.status === "rejected"
        ? [failure("hackatime", hackatimeResult.reason)]
        : []),
    ];
    if (identityResult.status !== "fulfilled" || hackatimeResult.status !== "fulfilled") {
      return errorResponse("user_status_unavailable", 502, { failures });
    }

    const identity = identityResult.value;
    const hackatime = hackatimeResult.value;

    let status: UserStatus = "unverified";
    if (hackatime?.trust_value === 1) status = "banned";
    else if (identity?.result === "verified_eligible") status = "eligible";
    else if (identity?.result === "verified_but_over_18") status = "over_18";

    return jsonResponse({ ok: true, status }, ctx.creds, ctx.acceptEncoding);
  }),
];
