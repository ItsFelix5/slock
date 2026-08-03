// Empty until Phase 19 removes this passthrough route entirely — every
// method has its own purpose-built route now (bootstrap.ts and
// /api/files/complete/reserve call callSlack directly, bypassing this
// allowlist entirely, so it's unaffected by it being empty).
export const SLACK_OPERATIONS = new Set<string>([]);

// Empty until Phase 19 removes this passthrough route entirely — every edge
// method (channels/info, users/list, users/info, usergroups/info) is now
// served by its own purpose-built route instead.
export const SLACK_EDGE_OPERATIONS = new Set<string>([]);
