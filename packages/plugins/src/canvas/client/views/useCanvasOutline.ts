import { deepEqual } from "@slock/core";
import { useDebouncer } from "@slock/core/solid";
import type Quill from "@slock/ui/editor/quill";
import { type Accessor, createSignal, onSettled } from "solid-js";
import {
  headingElements,
  type OutlineItem,
  type OutlineSource,
  outlineFromDom,
  titleItem,
} from "../lib/canvasOutline";

const OUTLINE_DELAY_MS = 250;

export function useCanvasOutline(options: {
  onOutline: (source: OutlineSource | null) => void;
  quill: Accessor<Quill | undefined>;
  title: Accessor<string>;
  titleElement: Accessor<HTMLTextAreaElement | undefined>;
}) {
  const [headings, setHeadings] = createSignal<OutlineItem[]>([], { equals: deepEqual });
  const refresh = useDebouncer(() => {
    const quill = options.quill();
    if (quill) setHeadings(outlineFromDom(quill.root));
  }, OUTLINE_DELAY_MS);

  onSettled(() => {
    options.onOutline({
      elements: () => {
        const quill = options.quill();
        const headings = quill ? headingElements(quill.root) : [];
        return [options.titleElement() ?? null, ...headings];
      },
      items: () => [titleItem(options.title()), ...headings()],
    });
    return () => options.onOutline(null);
  });

  return {
    load: (quill: Quill) => setHeadings(outlineFromDom(quill.root)),
    schedule: () => refresh.schedule(),
  };
}
