import { service } from "@slock/core/solid";
import type { Overlay } from "@slock/resource";
import type { UserPrefs } from "@slock/types";
import { createDndSnooze } from "./dnd";
import {
  emojiUseScore as calculateEmojiUseScore,
  frecencyScore as calculateFrecencyScore,
  recentIds as calculateRecentIds,
  usedEmojiNames as calculateUsedEmojiNames,
} from "./lib/frecency";
import { createNotificationPrefs } from "./notificationPrefs";

const env = service("env");

export function createPrefsStore(deps: {
  overlayUserPrefs: (change: (current: UserPrefs) => UserPrefs) => Overlay;
  userPrefs: () => UserPrefs | undefined;
}) {
  return {
    ...createDndSnooze(),
    ...createNotificationPrefs(deps),
    emojiUseScore: (name: string) => calculateEmojiUseScore(deps.userPrefs(), name),
    frecencyScore: (id: string) => calculateFrecencyScore(deps.userPrefs(), id, env.now()),
    recentIds: () => calculateRecentIds(deps.userPrefs()),
    usedEmojiNames: () => calculateUsedEmojiNames(deps.userPrefs()),
  };
}
