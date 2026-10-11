import type { createConversations } from "../conversations";
import type { View } from "./types";

export type ConversationKindResolver = (id: string) => "dm" | undefined;

export type ConversationOpenHook = (view: View) => void;

declare module "@slock/core/types" {
  interface Points {
    "conversations.kind": ConversationKindResolver;
    "conversations.opened": ConversationOpenHook;
  }
  interface Services {
    conversations: ReturnType<typeof createConversations>;
  }
}
