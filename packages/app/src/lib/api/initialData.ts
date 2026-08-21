export type InitialData = {
  channels?: any[];
  error?: Record<string, string>;
  ims?: any[];
  mpims?: any[];
  notifications?: any;
  sections?: Record<string, any>;
  self?: any;
  snooze?: { endtime?: number } | null;
  starred?: any[];
  subteams?: { self?: string[] };
  unreads?: any;
  [key: string]: any;
};

let initialDataPromise: Promise<InitialData> | null = null;
const FEED_ROUTE_RE = /^\/(activity|later|search)(?:\/|$)/;

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
