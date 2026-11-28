export interface AppLink {
  appId: string;
  tab: string | null;
}

export function parseAppLink(href: string): AppLink | undefined {
  const url = URL.parse(href);
  const appId = url?.searchParams.get("id");
  if (url?.protocol !== "slack:" || url.hostname !== "app" || !appId) return;
  return { appId, tab: url.searchParams.get("tab") };
}
