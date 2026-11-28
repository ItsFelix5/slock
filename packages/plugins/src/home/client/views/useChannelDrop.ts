import { service } from "@slock/core/solid";
import { draggedConversationId } from "@slock/plugins/conversations/client/api/conversationDrag";
import { createSignal } from "solid-js";
import type { Category } from "./categories";
import type { useDmSections } from "./useDmSections";

export function useChannelDrop(dmKind: ReturnType<typeof useDmSections>["dmKind"]) {
  const channels = service("channels");
  const dms = service("dms");
  const [overId, setOverId] = createSignal<string | null>(null);

  const moveFor = (event: DragEvent, category: Category | undefined) => {
    const id = draggedConversationId(event);
    const to = category?.placement;
    if (!(id && to)) return;
    const dm = dms.dmById(id);
    if (to.kind === "home" && category.dm !== (dm && dmKind(dm))) return;
    if (
      channels.isSectionStructurePending() ||
      channels.isChannelPlacementPending(id) ||
      channels.isChannelPlacedAt(id, to)
    )
      return;
    return { id, to };
  };

  return {
    drop: (event: DragEvent, category: Category | undefined) => {
      const move = moveFor(event, category);
      if (!move) return;
      event.preventDefault();
      setOverId(null);
      void channels.placeChannel(move.id, move.to);
    },
    isOver: (categoryId: string) => overId() === categoryId,
    leave: (event: DragEvent & { currentTarget: HTMLElement }) => {
      const { currentTarget, relatedTarget } = event;
      if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) return;
      setOverId(null);
    },
    over: (event: DragEvent, category: Category | undefined) => {
      if (!(category && moveFor(event, category))) return;
      event.preventDefault();
      setOverId(category.id);
    },
  };
}
