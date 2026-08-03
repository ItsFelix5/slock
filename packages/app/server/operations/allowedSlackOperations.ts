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
  "usergroups.update",
  "usergroups.users.list",
  "usergroups.users.update",
  "users.prefs.set",
]);

export const SLACK_EDGE_OPERATIONS = new Set(["usergroups/info"]);
