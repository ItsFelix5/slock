// biome-ignore-all lint/performance/noBarrelFile: This is the API package's public entry point.
// biome-ignore-all lint/performance/noReExportAll: The API surface intentionally aggregates endpoint modules.
export * from "./endpoints/account";
export * from "./endpoints/activity";
export * from "./endpoints/apps";
export * from "./endpoints/bootstrap";
export * from "./endpoints/channels";
export * from "./endpoints/content";
export * from "./endpoints/drafts";
export * from "./endpoints/messages";
export * from "./endpoints/messages/threads";
export * from "./endpoints/preferences";
export { HIDE_SUBTYPES, mapMessage, parseBadgeCounts } from "./mappers";
export {
  fileProxyUrl,
  getCachedWorkspaceDomain,
  getWorkspaceDomain,
  isConfigured,
  logout,
  submitAuthRequest,
  userProfileUrl,
} from "./relay";
export * from "./usergroups";
