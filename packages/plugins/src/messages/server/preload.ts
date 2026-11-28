import { FIRST_HISTORY_PAGE_SIZE } from "@slock/slack";

const CHANNEL_PATH = /^\/([CDG][A-Z0-9]+)\/?$/;

export function channelPreloads(pathname: string): string[] {
  const id = CHANNEL_PATH.exec(pathname)?.[1];
  if (!id) return [];
  return [
    `/api/channels/${id}/view`,
    `/api/channels/${id}/messages?limit=${FIRST_HISTORY_PAGE_SIZE}`,
  ];
}
