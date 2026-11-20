import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import IconButton from "../../button/IconButton";
import { createCopyFeedback } from "../../feedback/copyFeedback";
import "./JsonTree.css";

const LABEL_KEYS = ["kind", "type", "name", "id", "threadId", "anchor", "versionId", "html"];
const MAX_LABEL = 80;

type Decorate = (value: string) => JSX.Element | undefined;

function isBranch(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function labelOf(value: object): string {
  const fields = new Map(Object.entries(value));
  const parts = LABEL_KEYS.flatMap((key) => {
    const part = fields.get(key);
    return typeof part === "string" || typeof part === "number" ? [String(part)] : [];
  });
  return parts.slice(0, 3).join(" ").slice(0, MAX_LABEL);
}

function summary(value: object): string {
  return Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`;
}

function shown(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function toggle(branch: HTMLDetailsElement, event: MouseEvent) {
  event.preventDefault();
  const open = !branch.open;
  branch.open = open;
  if (event.ctrlKey || event.metaKey) {
    for (const nested of branch.querySelectorAll("details")) nested.open = open;
  } else if (!open) {
    for (const nested of branch.querySelectorAll("details")) nested.open = false;
  }
}

type EntryProps = {
  name: string;
  value: unknown;
  depth: number;
  openDepth: number;
  decorate?: Decorate;
};

function Branch(props: EntryProps & { value: object }) {
  let branch!: HTMLDetailsElement;
  return (
    <details class="json-tree-branch" open={props.depth < props.openDepth} ref={branch}>
      <summary class="json-tree-row" onClick={(event) => toggle(branch, event)}>
        <span class="json-tree-key">{props.name}</span>{" "}
        <span class="json-tree-summary">{summary(props.value)}</span>
        <Show when={labelOf(props.value)}>
          {(label) => (
            <>
              {" "}
              <span class="json-tree-label">{label()}</span>
            </>
          )}
        </Show>
      </summary>
      <div class="json-tree-children">
        <For each={Object.entries(props.value).filter(([, child]) => child !== undefined)}>
          {([key, child]) => (
            <Entry
              decorate={props.decorate}
              depth={props.depth + 1}
              name={key}
              openDepth={props.openDepth}
              value={child}
            />
          )}
        </For>
      </div>
    </details>
  );
}

function Entry(props: EntryProps) {
  return (
    <Show
      fallback={
        <div class="json-tree-row">
          <span class="json-tree-key">{props.name}</span>:{" "}
          {typeof props.value === "string" && props.decorate?.(props.value)}
          <span
            class={`json-tree-value json-tree-${props.value === null ? "null" : typeof props.value}`}
          >
            {shown(props.value)}
          </span>
        </div>
      }
      when={isBranch(props.value) && props.value}
    >
      {(branch) => (
        <Branch
          decorate={props.decorate}
          depth={props.depth}
          name={props.name}
          openDepth={props.openDepth}
          value={branch()}
        />
      )}
    </Show>
  );
}

export function CopyJsonButton(props: { value: unknown }) {
  const [copiedKey, copy] = createCopyFeedback();
  return (
    <IconButton
      icon={copiedKey() === "json" ? "check" : "copy"}
      label="Copy all"
      onClick={() => void copy(JSON.stringify(props.value, null, 2) ?? "", "json")}
      size="sm"
    />
  );
}

export default function JsonTree(props: {
  value: unknown;
  openDepth?: number;
  decorate?: Decorate;
}) {
  return (
    <div class="json-tree">
      <Entry
        decorate={props.decorate}
        depth={0}
        name="root"
        openDepth={props.openDepth ?? 2}
        value={props.value}
      />
    </div>
  );
}
