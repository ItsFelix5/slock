import type { Message } from "@slock/types";
import { produce } from "solid-js/store";

const MAX_CACHED_REACTION_MESSAGES = 200;

type ReactionMessages = {
  reactionMessages: Record<string, Message[] | undefined>;
  setReactionMessages: {
    (key: string, messages: Message[]): void;
    (updater: ReturnType<typeof produce<Record<string, Message[] | undefined>>>): void;
  };
};

export function createReactionCache(messages: ReactionMessages) {
  return (resolved: Map<string, Message>) => {
    for (const [key, message] of resolved) messages.setReactionMessages(key, [message]);
    const keys = Object.keys(messages.reactionMessages);
    if (keys.length > MAX_CACHED_REACTION_MESSAGES)
      messages.setReactionMessages(
        produce((cached) => {
          for (const key of keys.slice(0, keys.length - MAX_CACHED_REACTION_MESSAGES))
            delete cached[key];
        }),
      );
  };
}
