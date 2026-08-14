import type { Component } from "solid-js";
import { createEffect, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";
import Popover from "../overlay/Popover";
import type { InlineRun, LinkRun } from "./docModel";
import type { EditorHandle } from "./editorHandle";
import LinkEditPanel from "./LinkEditPanel";
import { pathKey } from "./selection";

export type AtomRenderers = Record<string, Component<{ data: unknown }>>;

/** Solid's JSX text-child insertion sets `el.textContent = value` on first mount, and setting
 * `textContent` to `""` leaves the element with zero child nodes (DOM spec, not a Solid quirk).
 * A run that starts empty (every fresh paragraph) then has nothing for the browser to place a
 * caret in or type into — the browser ends up creating a stray sibling text node instead, which
 * this component then can't find via `data-rt-path`. Managing one persistent Text node's `.data`
 * directly, instead of going through Solid's JSX child, keeps a real (if empty) node around from
 * the start and never tears it down on the empty-to-non-empty transition. */
function bindLeafText(el: HTMLElement, text: () => string) {
  const node = document.createTextNode(text());
  el.appendChild(node);
  createEffect(() => {
    const value = text();
    if (node.data !== value) node.data = value;
  });
}

/** Text/link runs render as a single flat span with `bk-rt-*` classes — the exact classnames
 * `RichText.tsx`'s `RichTextLeaf` uses for a sent message — rather than nested `<strong>/<em>`
 * tags, so styling is guaranteed identical by construction and contenteditable only ever deals
 * with one text node per run (no nested-element caret ambiguity). */
export default function RunView<A>(props: {
  run: InlineRun<A>;
  path: number[];
  atomRenderers: AtomRenderers;
  editor: EditorHandle<A>;
}) {
  const run = () => props.run;
  if (run().kind === "atom") {
    const atomRun = () => run() as { atomType: string; data: unknown };
    return (
      <span
        contentEditable={false}
        data-rt-atom="true"
        data-rt-path={pathKey(props.path)}
        class="rt-atom"
      >
        <Dynamic component={props.atomRenderers[atomRun().atomType]} data={atomRun().data} />
      </span>
    );
  }

  const marks = () => (run() as { marks: string[] }).marks;
  const text = () => (run() as { text: string }).text;
  const classList = () => ({
    "bk-rt-bold": marks().includes("bold"),
    "bk-rt-code": marks().includes("code"),
    "bk-rt-italic": marks().includes("italic"),
    "bk-rt-strike": marks().includes("strike"),
  });

  if (run().kind === "link") {
    const [editing, setEditing] = createSignal(false);
    const link = () => run() as LinkRun;
    return (
      <Popover
        onClose={() => setEditing(false)}
        open={editing()}
        panelClass="rt-link-panel-anchor"
        trigger={
          <span
            class="bk-rt-text bk-link rt-link"
            classList={classList()}
            data-rt-path={pathKey(props.path)}
            data-rt-url={link().url}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setEditing(true);
            }}
            ref={(el) => bindLeafText(el, text)}
          />
        }
      >
        <LinkEditPanel
          initialText={link().text}
          initialUrl={link().url}
          onCancel={() => setEditing(false)}
          onRemove={() => {
            props.editor.setLinkAtPath(props.path, null);
            setEditing(false);
          }}
          onSave={(data) => {
            props.editor.setLinkAtPath(props.path, data);
            setEditing(false);
          }}
        />
      </Popover>
    );
  }

  return (
    <span
      class="bk-rt-text"
      classList={classList()}
      data-rt-path={pathKey(props.path)}
      ref={(el) => bindLeafText(el, text)}
    />
  );
}
