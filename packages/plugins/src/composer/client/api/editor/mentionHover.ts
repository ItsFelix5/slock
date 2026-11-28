import { useHoverIntent } from "@slock/ui";
import type Quill from "@slock/ui/editor/quill";
import { createSignal } from "solid-js";
import { type MentionTarget, mentionTarget } from "./mentionTarget";

export type MentionHoverState = { anchorEl: HTMLElement; target: MentionTarget };

function closestMention(target: EventTarget | null): HTMLElement | undefined {
  return target instanceof Element
    ? (target.closest<HTMLElement>(".bk-mention[data-kind]") ?? undefined)
    : undefined;
}

export function createMentionHoverController() {
  const hoverIntent = useHoverIntent();
  const [state, setState] = createSignal<MentionHoverState | undefined>((previous) =>
    hoverIntent.open() ? previous : undefined,
  );
  let hoverEl: HTMLElement | undefined;

  const handleMouseOver = (event: MouseEvent) => {
    const node = closestMention(event.target);
    if (!node || node === hoverEl) return;
    hoverEl = node;
    const target = mentionTarget(node.dataset.kind, node.dataset.id);
    if (!target) return;
    setState({ anchorEl: node, target });
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
    quill.root.addEventListener("pointerdown", hoverIntent.close);
    return () => {
      quill.root.removeEventListener("mouseover", handleMouseOver);
      quill.root.removeEventListener("mouseout", handleMouseOut);
      quill.root.removeEventListener("pointerdown", hoverIntent.close);
      hoverEl = undefined;
      hoverIntent.close();
    };
  };

  return { bind, hoverIntent, state };
}
