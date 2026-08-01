// The divider is already visible at the bottom when the newest message is the
// only unread one. Returning -1 in that case lets the initial landing use the
// exact browser bottom instead of scheduling a second virtualizer scroll to
// the final row, which can visibly nudge an already-correct viewport as that
// row is measured.
export function resolveUnreadLandingIndex(dividerIndex: number, messageCount: number): number {
  return dividerIndex >= 0 && dividerIndex < messageCount - 1 ? dividerIndex : -1;
}
