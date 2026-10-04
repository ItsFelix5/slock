import { jsonHeaders, parseCredentials, teamIdFromRoute } from "../../auth.ts";
import { type Route, route } from "../router.ts";

export const sessionRoutes: Route[] = [
  route("POST", "session", async (ctx) => {
    const parsed = parseCredentials(await ctx.body.json());
    if (!parsed.ok) throw new Error(parsed.error);
    const { credentials } = parsed;
    const headers = new Headers(jsonHeaders);
    headers.append(
      "set-cookie",
      `slock_creds=${encodeURIComponent(JSON.stringify(credentials))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=34560000; Secure`,
    );
    headers.append(
      "set-cookie",
      `slock_info=${encodeURIComponent(
        JSON.stringify({
          domain: credentials.domain,
          teamId: teamIdFromRoute(credentials.route),
        }),
      )}; SameSite=Strict; Path=/; Max-Age=34560000`,
    );
    return new Response(JSON.stringify({}), { headers });
  }),

  route("DELETE", "session", () => {
    const headers = new Headers(jsonHeaders);
    headers.append("set-cookie", "slock_creds=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
    headers.append("set-cookie", "slock_info=; SameSite=Strict; Path=/; Max-Age=0");
    return new Response(JSON.stringify({ ok: true }), { headers });
  }),
];
