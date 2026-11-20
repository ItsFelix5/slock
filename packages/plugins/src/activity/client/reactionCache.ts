import type { Message } from "@slock/types";
import type { StoreSetter } from "solid-js";

const MAX_CACHED_REACTION_MESSAGES = 200;

type ReactionMessages = {
  setReactionMessages: StoreSetter<Record<string, Message[]>>;
};

export function createReactionCache(messages: ReactionMessages) {
  return (resolved: Map<string, Message>) => {
    messages.setReactionMessages((cached) => {
      for (const [key, message] of resolved) cached[key] = [message];
      const keys = Object.keys(cached);
      for (const key of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_REACTION_MESSAGES)))
        delete cached[key];
    });
  };
}
