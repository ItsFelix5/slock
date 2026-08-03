export const SLACK_OPERATIONS = new Set([
  "activity.feed",
  "apps.actions.v2.execute",
  "apps.profile.get",
  "blocks.actions",
  "chat.command",
  "client.appCommands",
  "commands.list",
  "dnd.endSnooze",
  "dnd.setSnooze",
  "search.autocomplete",
  "search.messages",
  "users.prefs.set",
]);

// Empty until Phase 19 removes this passthrough route entirely — every edge
// method (channels/info, users/list, users/info, usergroups/info) is now
// served by its own purpose-built route instead.
export const SLACK_EDGE_OPERATIONS = new Set<string>([]);
