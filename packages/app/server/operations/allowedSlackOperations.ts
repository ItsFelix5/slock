export const SLACK_OPERATIONS = new Set(["activity.feed", "chat.command", "commands.list"]);

// Empty until Phase 19 removes this passthrough route entirely — every edge
// method (channels/info, users/list, users/info, usergroups/info) is now
// served by its own purpose-built route instead.
export const SLACK_EDGE_OPERATIONS = new Set<string>([]);
