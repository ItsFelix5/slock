import { parseChannelId } from "@slock/slack";
import type { ChannelId } from "@slock/types";
import type { JSX } from "@solidjs/web";

const TYPE_PREFIX = "application/x-slock-conversation.";

export function conversationDragSource(id: ChannelId): JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  return {
    draggable: "true",
    onDragStart: (event) => {
      if (!event.dataTransfer) return;
      event.dataTransfer.setData(`${TYPE_PREFIX}${id}`, id);
      event.dataTransfer.effectAllowed = "move";
    },
  };
}

// dragover cannot read drag data, only the type names, which the browser lowercases
export function draggedConversationId(event: DragEvent) {
  const type = event.dataTransfer?.types.find((name) => name.startsWith(TYPE_PREFIX));
  return type ? parseChannelId(type.slice(TYPE_PREFIX.length).toUpperCase()) : undefined;
}
