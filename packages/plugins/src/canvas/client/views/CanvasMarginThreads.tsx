import type { CanvasCommentThread, FileId } from "@slock/types";
import { IconButton } from "@slock/ui";
import { createEffect, createSignal, For, onSettled } from "solid-js";
import ReactionRow from "../../../reactions/client/api/ReactionRow";
import { isThreadAnnotation } from "../api/canvasQuote";
import "./CanvasMarginThreads.css";

function sameTops(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export default function CanvasMarginThreads(props: {
  container: HTMLElement;
  fileId: FileId;
  onOpen: (thread: CanvasCommentThread) => void;
  onReact: (thread: CanvasCommentThread, name: string) => void;
  threads: CanvasCommentThread[];
}) {
  const [tops, setTops] = createSignal<Record<string, number>>({});
  const visible = () =>
    props.threads.filter((thread) => !thread.archived && tops()[thread.threadId] !== undefined);
  const [active, setActive] = createSignal<string>();
  let frame = 0;

  function threadOf(mark: HTMLElement, threads: CanvasCommentThread[]) {
    return threads.find((t) => isThreadAnnotation(mark.dataset.annotation ?? "", t.threadId));
  }

  function measure() {
    const base = props.container.getBoundingClientRect().top;
    const next: Record<string, number> = {};
    for (const mark of props.container.querySelectorAll<HTMLElement>("[data-annotation]")) {
      const thread = threadOf(mark, props.threads);
      if (thread && !(thread.threadId in next))
        next[thread.threadId] = mark.getBoundingClientRect().top - base;
    }
    setTops((previous) => (sameTops(previous, next) ? previous : next));
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }

  createEffect(() => props.threads, schedule);

  createEffect(
    () => ({ container: props.container, id: active(), threads: props.threads }),
    ({ container, id, threads }) => {
      const ranges = [...container.querySelectorAll<HTMLElement>("[data-annotation]")]
        .filter((mark) => id && threadOf(mark, threads)?.threadId === id)
        .map((mark) => {
          const range = new Range();
          range.selectNodeContents(mark);
          return range;
        });
      CSS.highlights.set("canvas-thread", new Highlight(...ranges));
    },
  );

  function hoverMark(event: MouseEvent) {
    const mark =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-annotation]")
        : null;
    setActive(mark ? threadOf(mark, props.threads)?.threadId : undefined);
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
      CSS.highlights.delete("canvas-thread");
      cancelAnimationFrame(frame);
      resizes.disconnect();
      mutations.disconnect();
    };
  });

  return (
    <div class="canvas-margin-threads">
      <For each={visible()}>
        {(thread) => (
          <div
            class={[
              "canvas-margin-thread flex-align-center",
              { active: active() === thread.threadId },
            ]}
            onFocusIn={() => setActive(thread.threadId)}
            onFocusOut={clearActive}
            onMouseEnter={() => setActive(thread.threadId)}
            onMouseLeave={clearActive}
            style={{ top: `${tops()[thread.threadId]}px` }}
          >
            <IconButton
              icon="message"
              label={
                thread.replyCount === 0
                  ? "Open comment"
                  : `Open comment, ${thread.replyCount} ${thread.replyCount === 1 ? "reply" : "replies"}`
              }
              onClick={() => props.onOpen(thread)}
              size="sm"
              tone={thread.replyCount > 0 ? "accent" : "dim"}
            />
            {thread.reactions.length > 0 && (
              <ReactionRow
                allowAdd
                feedbackKey={props.fileId}
                onToggle={(name) => props.onReact(thread, name)}
                reactions={thread.reactions}
              />
            )}
          </div>
        )}
      </For>
    </div>
  );
}
