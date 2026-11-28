import { RELAY_BOT_ID } from "@slock/slack";
import type { Message, User } from "@slock/types";

export function isMyRelayedMessage(
  msg: Pick<Message, "botId" | "botName">,
  user: Pick<User, "name" | "originalName"> | undefined,
): boolean {
  return msg.botId === RELAY_BOT_ID && !!user && msg.botName === (user.originalName ?? user.name);
}
