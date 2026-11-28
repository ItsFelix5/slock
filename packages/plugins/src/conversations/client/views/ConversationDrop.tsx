import { service } from "@slock/core/solid";
import { createSignal, onSettled, Show } from "solid-js";
import { draggedConversationId } from "../api/conversationDrag";
import { dropZone } from "./dropZone";

import "./ConversationDrop.css";

export default function ConversationDrop() {
  const conversations = service("conversations");
  const panes = service("shell.panes");
  const [zone, setZone] = createSignal<ReturnType<typeof dropZone> | null>(null);

  const targetOf = (event: DragEvent) => {
    const id = draggedConversationId(event);
    if (!(id && event.target instanceof Element)) return;
    const element = event.target.closest<HTMLElement>("[data-pane]");
    const paneId = element?.dataset.pane;
    if (!(element && paneId && panes.currentPanes().some((pane) => pane.id === paneId))) return;
    return { id, paneId, zone: dropZone(element.getBoundingClientRect(), event.clientX) };
  };

  const claim = (event: DragEvent) => {
    const target = targetOf(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    return target;
  };

  const clear = () => void setZone(null);
  const over = (event: DragEvent) => void setZone(claim(event)?.zone ?? null);
  const drop = (event: DragEvent) => {
    const target = claim(event);
    clear();
    if (target) conversations.openAtPane(target.id, target.paneId, target.zone.side);
  };
  const leave = (event: DragEvent) => {
    if (!event.relatedTarget) clear();
  };

  onSettled(() => {
    const listeners = [
      ["dragover", over],
      ["drop", drop],
      ["dragleave", leave],
      ["dragend", clear],
    ] as const;
    for (const [type, listener] of listeners) document.addEventListener(type, listener, true);
    return () => {
      for (const [type, listener] of listeners) document.removeEventListener(type, listener, true);
    };
  });

  return (
    <Show when={zone()}>
      {(rect) => (
        <div
          class="conversation-drop"
          style={{
            height: `${rect().height}px`,
            left: `${rect().left}px`,
            top: `${rect().top}px`,
            width: `${rect().width}px`,
          }}
        />
      )}
    </Show>
  );
}
