import type { FileId } from "@slock/types";
import { IconButton, paintHighlight } from "@slock/ui";
import { createEffect, createSignal, For, onSettled } from "solid-js";
import { isThreadAnnotation } from "../../protocol/api";
import type { CanvasCommentsController } from "../lib/canvasComments";
import CommentReactions from "./CommentReactions";
import "./CanvasMarginThreads.css";

interface Mark {
  element: HTMLElement;
  id: string;
}

interface Layout {
  marks: Mark[];
  tops: Record<string, number>;
}

function sameLayout(a: Layout, b: Layout): boolean {
  const keys = Object.keys(a.tops);
  return (
    a.marks.length === b.marks.length &&
    a.marks.every(
      (mark, index) => mark.element === b.marks[index]?.element && mark.id === b.marks[index]?.id,
    ) &&
    keys.length === Object.keys(b.tops).length &&
    keys.every((key) => a.tops[key] === b.tops[key])
  );
}

function stacked(tops: [string, number][], height: number): Record<string, number> {
  let floor = 0;
  return Object.fromEntries(
    tops
      .sort(([, a], [, b]) => a - b)
      .map(([id, top]) => {
        const placed = Math.max(top, floor);
        floor = placed + height;
        return [id, placed];
      }),
  );
}

function painter(name: string) {
  return (marks: Mark[]) =>
    paintHighlight(
      name,
      marks.map(({ element }) => {
        const range = new Range();
        range.selectNodeContents(element);
        return range;
      }),
    );
}

export default function CanvasMarginThreads(props: {
  canReact: boolean;
  comments: CanvasCommentsController;
  container: HTMLElement;
  fileId: FileId;
}) {
  const [layout, setLayout] = createSignal<Layout>({ marks: [], tops: {} });
  const open = () => props.comments.started().filter((thread) => !thread.archived);
  const visible = () => open().filter((thread) => layout().tops[thread.threadId] !== undefined);
  const [active, setActive] = createSignal<string>();
  let frame = 0;

  function markOf(element: Element | null, ids: string[]): Mark | undefined {
    if (!(element instanceof HTMLElement)) return;
    const { annotation } = element.dataset;
    const id = annotation && ids.find((candidate) => isThreadAnnotation(annotation, candidate));
    return id ? { element, id } : undefined;
  }

  function measure() {
    const ids = props.comments.markedIds();
    const marks = [...props.container.querySelectorAll("[data-annotation]")].flatMap(
      (element) => markOf(element, ids) ?? [],
    );
    const base = props.container.getBoundingClientRect().top;
    const withButton = new Set(open().map((thread) => thread.threadId));
    const tops = new Map<string, number>();
    for (const { element, id } of marks) {
      if (withButton.has(id) && !tops.has(id))
        tops.set(id, element.getBoundingClientRect().top - base);
    }
    const row = props.container.querySelector<HTMLElement>(".canvas-margin-thread");
    const next = { marks, tops: stacked([...tops], row?.offsetHeight ?? 0) };
    setLayout((previous) => (sameLayout(previous, next) ? previous : next));
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }

  createEffect(() => [props.comments.markedIds(), open()], schedule);
  createEffect(() => layout().marks, painter("canvas-comment"));
  createEffect(
    () => layout().marks.filter((mark) => mark.id === active()),
    painter("canvas-thread"),
  );

  function hoverMark(event: MouseEvent) {
    const element =
      event.target instanceof Element ? event.target.closest("[data-annotation]") : null;
    const id = markOf(element, props.comments.markedIds())?.id;
    props.container.toggleAttribute("data-over-comment", !!id);
    setActive(id);
  }

  function clearActive() {
    setActive(undefined);
  }

  onSettled(() => {
    const { container } = props;
    container.addEventListener("mouseover", hoverMark);
    container.addEventListener("mouseleave", clearActive);
    const resizes = new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    resizes.observe(container);
    mutations.observe(container, { characterData: true, childList: true, subtree: true });
    return () => {
      container.removeEventListener("mouseover", hoverMark);
      container.removeEventListener("mouseleave", clearActive);
      cancelAnimationFrame(frame);
      resizes.disconnect();
      mutations.disconnect();
    };
  });

  return (
    <div class="canvas-margin-threads">
      <For each={visible()} keyed={(thread) => thread.ts}>
        {(thread) => (
          <div
            class={[
              "canvas-margin-thread flex-align-center",
              { active: active() === thread().threadId },
            ]}
            onFocusIn={() => setActive(thread().threadId)}
            onFocusOut={clearActive}
            onMouseEnter={() => setActive(thread().threadId)}
            onMouseLeave={clearActive}
            style={{ top: `${layout().tops[thread().threadId]}px` }}
          >
            <IconButton
              icon="message"
              label={
                thread().replyCount === 0
                  ? "Open comment"
                  : `Open comment, ${thread().replyCount} ${thread().replyCount === 1 ? "reply" : "replies"}`
              }
              onClick={() => props.comments.openThread(thread())}
              size="sm"
              tone={thread().replyCount > 0 ? "accent" : "dim"}
            />
            <CommentReactions
              canReact={props.canReact}
              comments={props.comments}
              fileId={props.fileId}
              thread={thread()}
            />
          </div>
        )}
      </For>
    </div>
  );
}
