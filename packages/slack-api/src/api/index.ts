// biome-ignore-all lint/performance/noBarrelFile: This is the API package's public entry point.
// biome-ignore-all lint/performance/noReExportAll: The API surface intentionally aggregates endpoint modules.
export * from "./endpoints/account";
export * from "./endpoints/apps";
export * from "./endpoints/bootstrap";
export * from "./endpoints/channels";
export * from "./endpoints/content";
export * from "./endpoints/directory";
export * from "./endpoints/drafts";
export * from "./endpoints/messages";
export * from "./endpoints/preferences";
export { mapMessage, parseBadgeCounts } from "./mappers";
export {
  fileProxyUrl,
  getCachedWorkspaceDomain,
  getConfig,
  getWorkspaceDomain,
  logout,
  submitAuthRequest,
  userProfileUrl,
} from "./relay";
