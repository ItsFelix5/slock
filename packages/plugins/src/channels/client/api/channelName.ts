const MAX_CHANNEL_NAME_LENGTH = 80;
const INVALID_CHANNEL_NAME_CHARS = /[^\p{L}\p{N}_-]/gu;

export function normalizeChannelName(input: string): string {
  return input
    .toLocaleLowerCase()
    .replace(/\s+/g, "-")
    .replace(INVALID_CHANNEL_NAME_CHARS, "")
    .slice(0, MAX_CHANNEL_NAME_LENGTH);
}
