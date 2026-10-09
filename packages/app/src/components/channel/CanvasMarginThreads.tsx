import type { CanvasCommentThread } from "@slock/types";
import { IconButton } from "@slock/ui";
import { createEffect, createSignal, For, on, onCleanup } from "solid-js";
import { isThreadAnnotation } from "../../lib/canvas/canvasQuote";
import ReactionRow from "../messages/parts/ReactionRow";
import "./CanvasMarginThreads.css";

export default function CanvasMarginThreads(props: {
  container: HTMLElement;
  fileId: string;
  onOpen: (thread: CanvasCommentThread) => void;
  onReact: (thread: CanvasCommentThread, name: string) => void;
  threads: CanvasCommentThread[];
}) {
  const [tops, setTops] = createSignal<Record<string, number>>({});
  const visible = () => props.threads.filter((thread) => !thread.archived);
  const [active, setActive] = createSignal<string>();
  let frame = 0;

  function threadOf(mark: HTMLElement) {
    return props.threads.find((t) => isThreadAnnotation(mark.dataset.annotation ?? "", t.threadId));
  }

  function measure() {
    const base = props.container.getBoundingClientRect().top;
    const next: Record<string, number> = {};
    for (const mark of props.container.querySelectorAll<HTMLElement>("[data-annotation]")) {
      const thread = threadOf(mark);
      if (thread && !(thread.threadId in next))
        next[thread.threadId] = mark.getBoundingClientRect().top - base;
    }
    setTops(next);
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }

  createEffect(on(() => props.threads, schedule));

  createEffect(() => {
    const id = active();
    const ranges = [...props.container.querySelectorAll<HTMLElement>("[data-annotation]")]
      .filter((mark) => id && threadOf(mark)?.threadId === id)
      .map((mark) => {
        const range = new Range();
        range.selectNodeContents(mark);
        return range;
      });
    CSS.highlights.set("canvas-thread", new Highlight(...ranges));
  });

  function hoverMark(event: MouseEvent) {
    const mark =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-annotation]")
        : null;
    setActive(mark ? threadOf(mark)?.threadId : undefined);
  }

  function clearActive() {
    setActive(undefined);
  }

  props.container.addEventListener("mouseover", hoverMark);
  props.container.addEventListener("mouseleave", clearActive);

  const resizes = new ResizeObserver(schedule);
  const mutations = new MutationObserver(schedule);
  resizes.observe(props.container);
  mutations.observe(props.container, { characterData: true, childList: true, subtree: true });
  onCleanup(() => {
    props.container.removeEventListener("mouseover", hoverMark);
    props.container.removeEventListener("mouseleave", clearActive);
    CSS.highlights.delete("canvas-thread");
    cancelAnimationFrame(frame);
    resizes.disconnect();
    mutations.disconnect();
  });

  return (
    <div class="canvas-margin-threads">
      <For each={visible()}>
        {(thread) => (
          <div
            class="canvas-margin-thread flex-align-center"
            classList={{ active: active() === thread.threadId }}
            hidden={tops()[thread.threadId] === undefined}
            onMouseEnter={() => setActive(thread.threadId)}
            onMouseLeave={clearActive}
            style={{ top: `${tops()[thread.threadId] ?? 0}px` }}
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
