type UnreadLandingViewport = {
  unreadContentHeight: number | undefined;
  viewportHeight: number;
};

// When everything from the divider to the newest message is shorter than the
// viewport, forcing the divider to the top leaves a large, unnatural gap
// below the unread tail. Landing at the ordinary bottom position already
// shows all of it in that case. A tail taller than the viewport still lands
// at the divider so the reader sees its beginning rather than its end.
export function resolveUnreadLandingIndex(
  dividerIndex: number,
  messageCount: number,
  viewport?: UnreadLandingViewport,
): number {
  if (dividerIndex < 0 || dividerIndex >= messageCount) return -1;
  const unreadFitsViewport =
    viewport?.unreadContentHeight !== undefined &&
    viewport.unreadContentHeight <= viewport.viewportHeight;
  return unreadFitsViewport ? -1 : dividerIndex;
}
