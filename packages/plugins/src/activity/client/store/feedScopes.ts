import { createStore } from "solid-js";

export const MAIN_SCOPE = "";

type ScopeState = { cursor?: string; hasMore: boolean };

export function scopeKey(types?: string, unreadOnly?: boolean): string {
  if (!(types || unreadOnly)) return MAIN_SCOPE;
  return `${types ?? ""}${unreadOnly ? "|unread" : ""}`;
}

export function hasMoreAfter(
  page: { entries: readonly unknown[]; nextCursor?: string },
  newest: boolean,
): boolean {
  return !!page.nextCursor && (newest || page.entries.length > 0);
}

export function createFeedScopes() {
  const [scopes, setScopes] = createStore<Record<string, ScopeState>>({});

  return {
    cursor: (key: string) => scopes[key]?.cursor,
    hasMore: (key: string) => scopes[key]?.hasMore ?? true,
    loaded: () => scopes[MAIN_SCOPE] !== undefined,
    record(
      key: string,
      page: { entries: readonly unknown[]; nextCursor?: string },
      newest = false,
    ) {
      setScopes((draft) => {
        draft[key] = { cursor: page.nextCursor, hasMore: hasMoreAfter(page, newest) };
      });
    },
  };
}
