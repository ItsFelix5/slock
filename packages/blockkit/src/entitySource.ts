import type { ConversationFilter } from "@slock/types";
import type { ComboboxOption } from "@slock/ui";

export type EntityKind = "channels" | "conversations" | "users";

export type EntitySource = {
  conversationId(id: string): Promise<string>;
  currentConversation(): string | undefined;
  describe(kind: EntityKind, id: string): ComboboxOption;
  search(
    kind: EntityKind,
    query: string,
    filter?: ConversationFilter,
  ): ComboboxOption[] | Promise<ComboboxOption[]>;
};

declare module "@slock/core/types" {
  interface Points {
    "blockkit.entitySource": EntitySource;
  }
}
