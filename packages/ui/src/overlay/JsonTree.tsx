import { For, Show } from "solid-js";
import "./JsonTree.css";

const LABEL_KEYS = ["kind", "type", "name", "id", "threadId", "anchor", "versionId", "html"];
const MAX_LABEL = 80;

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

function Branch(props: { name: string; value: object; depth: number; openDepth: number }) {
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
            <Entry depth={props.depth + 1} name={key} openDepth={props.openDepth} value={child} />
          )}
        </For>
      </div>
    </details>
  );
}

function Entry(props: { name: string; value: unknown; depth: number; openDepth: number }) {
  return (
    <Show
      fallback={
        <div class="json-tree-row">
          <span class="json-tree-key">{props.name}</span>
          {": "}
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
          depth={props.depth}
          name={props.name}
          openDepth={props.openDepth}
          value={branch()}
        />
      )}
    </Show>
  );
}

export default function JsonTree(props: { value: unknown; openDepth?: number }) {
  return (
    <div class="json-tree">
      <Entry depth={0} name="root" openDepth={props.openDepth ?? 2} value={props.value} />
    </div>
  );
}
