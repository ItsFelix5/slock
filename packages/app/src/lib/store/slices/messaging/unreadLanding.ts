type UnreadLandingViewport = {
  unreadRowHeight: number | undefined;
  viewportHeight: number;
};

// When the divider belongs to the final row there is exactly one unread
// message. A short final message is already fully visible at the ordinary
// bottom position, so forcing enough trailing space to put it at the top only
// creates a large, unnatural gap. A message taller than the viewport still
// lands at the divider so the reader sees its beginning rather than its end.
export function resolveUnreadLandingIndex(
  dividerIndex: number,
  messageCount: number,
  viewport?: UnreadLandingViewport,
): number {
  if (dividerIndex < 0 || dividerIndex >= messageCount) return -1;
  const isOnlyUnreadMessage = dividerIndex === messageCount - 1;
  const unreadFitsViewport =
    viewport?.unreadRowHeight !== undefined && viewport.unreadRowHeight <= viewport.viewportHeight;
  return isOnlyUnreadMessage && unreadFitsViewport ? -1 : dividerIndex;
}
