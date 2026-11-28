export type Handler = (
  req: Request,
  url: URL,
) => Response | undefined | Promise<Response | undefined>;

const CORS = {
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, PUT, DELETE",
  "access-control-allow-origin": "*",
};

/**
 * Features are tried in order and the first one that returns a response wins.
 * Clients authenticate with a bearer header, never cookies, so any origin may call us.
 */
export function createFetch(features: Handler[]) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS, status: 204 });
    const url = new URL(req.url);
    for (const feature of features) {
      const res = await feature(req, url);
      if (!res) continue;
      for (const [name, value] of Object.entries(CORS)) res.headers.set(name, value);
      return res;
    }
    return new Response(null, { headers: CORS, status: 404 });
  };
}
