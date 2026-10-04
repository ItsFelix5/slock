import { useHoverIntent } from "@slock/ui";
import type Quill from "quill";
import { createEffect, createSignal } from "solid-js";
import { isMentionKind, type MentionValue } from "./quillMentions";

export interface MentionHoverState {
  anchorEl: HTMLElement;
  kind: MentionValue["kind"];
  id: string;
}

function closestMention(target: EventTarget | null): HTMLElement | undefined {
  return target instanceof Element
    ? (target.closest<HTMLElement>(".bk-mention[data-kind]") ?? undefined)
    : undefined;
}

export function createMentionHoverController() {
  const hoverIntent = useHoverIntent();
  const [state, setState] = createSignal<MentionHoverState | undefined>(undefined);
  let hoverEl: HTMLElement | undefined;

  createEffect(() => {
    if (!hoverIntent.open()) setState(undefined);
  });

  const handleMouseOver = (event: MouseEvent) => {
    const node = closestMention(event.target);
    if (!node || node === hoverEl) return;
    hoverEl = node;
    const { kind, id } = node.dataset;
    if (kind === "special" || !isMentionKind(kind) || !id) return;
    setState({ anchorEl: node, id, kind });
    hoverIntent.scheduleOpen();
  };

  const handleMouseOut = (event: MouseEvent) => {
    if (!hoverEl || closestMention(event.target) !== hoverEl) return;
    if (event.relatedTarget instanceof Node && hoverEl.contains(event.relatedTarget)) return;
    hoverEl = undefined;
    hoverIntent.scheduleClose();
  };

  const bind = (quill: Quill) => {
    quill.root.addEventListener("mouseover", handleMouseOver);
    quill.root.addEventListener("mouseout", handleMouseOut);
    return () => {
      quill.root.removeEventListener("mouseover", handleMouseOver);
      quill.root.removeEventListener("mouseout", handleMouseOut);
      hoverEl = undefined;
      hoverIntent.close();
    };
  };

  return { bind, hoverIntent, state };
}
