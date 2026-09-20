import { authPayloadError, jsonHeaders, teamIdFromRoute } from "../../auth.ts";
import { type Route, route } from "../router.ts";

export const sessionRoutes: Route[] = [
  route("POST", "session", async (ctx) => {
    const parsed = await ctx.body.json();
    const error = authPayloadError(parsed);
    if (error) throw new Error(error);
    const headers = new Headers(jsonHeaders);;
    headers.append("set-cookie", `slock_creds=${encodeURIComponent(JSON.stringify(parsed))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=34560000 Secure`);
    headers.append("set-cookie", `slock_info=${encodeURIComponent(
        JSON.stringify({
          domain: parsed.domain,
          teamId: teamIdFromRoute(parsed.route),
        }),
      )}; SameSite=Strict; Path=/; Max-Age=34560000`);
    return new Response(JSON.stringify({}), { headers });
  }),

  route("DELETE", "session", async () => {
    const headers = new Headers(jsonHeaders);
    headers.append("set-cookie", `slock_creds=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    headers.append("set-cookie", `slock_info=; SameSite=Strict; Path=/; Max-Age=0`);
    return new Response(JSON.stringify({ ok: true }), { headers });
  }),
];
