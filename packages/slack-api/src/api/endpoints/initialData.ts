// biome-ignore-all lint/style/useNamingConvention: Slack payloads retain their wire field names.
export type InitialData = {
  boot: any;
  counts: any;
  dnd: any;
  prefs: any;
  sections?: any;
};

let initialDataPromise: Promise<InitialData> | null = null;
const FEED_ROUTE_RE = /^\/(activity|later|search)(?:\/|$)/;

// Bootstrap, preferences and DND are separate client resources but one server
// operation. Sharing the promise prevents each resource from issuing its own
// request while still letting each map its own slice of the result.
export function fetchInitialData(): Promise<InitialData> {
  if (initialDataPromise) return initialDataPromise;
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
  const startsInConversationList = !FEED_ROUTE_RE.test(pathname);
  const request = fetch(`/api/bootstrap?sections=${startsInConversationList}`)
    .then((response) => {
      if (!response.ok) throw new Error(`Bootstrap failed (${response.status})`);
      return response.json() as Promise<InitialData>;
    })
    .catch((error) => {
      if (initialDataPromise === request) initialDataPromise = null;
      throw error;
    });
  initialDataPromise = request;
  return request;
}
