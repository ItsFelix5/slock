import type { Channel } from "@slock/slack-api";

// Some channels arrive without a human-readable name (shared/external channels,
// or ones we can only see by id) — channelById already kicks off a background
// Flaron lookup for those, but this covers the gap before it resolves (or if
// Flaron doesn't know the id either). Fall back to a shareable Flaron permalink
// for public channels, and to the bare id only when even that wouldn't resolve
// (private channels we can't publicly link).
export function channelDisplayName(
  channel: Pick<Channel, "id" | "name" | "private"> | undefined,
  fallbackId?: string,
): string {
  const name = channel?.name?.trim();
  if (name) return name;
  const id = channel?.id ?? fallbackId ?? "";
  return id;
}
