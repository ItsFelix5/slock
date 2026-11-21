import type { TimerHandle } from "@slock/core";
import { service } from "@slock/core/solid";
import type Quill from "@slock/ui/editor/quill";
import { type Accessor, createSignal, onSettled } from "solid-js";
import {
  headingElement,
  type OutlineItem,
  type OutlineSource,
  outlineFromDom,
  titleItem,
} from "../lib/canvasOutline";

const env = service("env");

const OUTLINE_DELAY_MS = 250;

export function useCanvasOutline(options: {
  onOutline: (source: OutlineSource | null) => void;
  quill: Accessor<Quill | undefined>;
  title: Accessor<string>;
  titleElement: Accessor<HTMLTextAreaElement | undefined>;
}) {
  const [headings, setHeadings] = createSignal<OutlineItem[]>([]);
  let timer: TimerHandle | undefined;

  onSettled(() => {
    options.onOutline({
      element: (index) => {
        if (index === 0) return options.titleElement() ?? null;
        const quill = options.quill();
        return quill ? headingElement(quill.root, index) : null;
      },
      items: () => [titleItem(options.title()), ...headings()],
    });
    return () => {
      env.clearTimeout(timer);
      options.onOutline(null);
    };
  });

  return {
    load: (quill: Quill) => setHeadings(outlineFromDom(quill.root)),
    schedule() {
      env.clearTimeout(timer);
      timer = env.setTimeout(() => {
        const quill = options.quill();
        if (quill) setHeadings(outlineFromDom(quill.root));
      }, OUTLINE_DELAY_MS);
    },
  };
}
