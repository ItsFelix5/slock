import Quill from "@slock/ui/editor/quill";
import { BlockEmbed } from "quill/blots/block";
import { flush } from "solid-js";
import { bindFirst } from "../../lib/canvasEditorSetup";
import { isBlockEmbed } from "../../lib/canvasEmbedValues";
import { owningEditor } from "./embedOwner";

const Delta = Quill.import("delta");

type Delta = ReturnType<Quill["getContents"]>;

const recorders = new WeakMap<Quill, Quill["history"]["record"]>();

// Quill re-creates a block embed whose content changed, as one insert replacing the same kind.
function isEmbedChurn({ ops }: Delta, previous: Delta): boolean {
  const [first] = ops;
  const at = typeof first?.retain === "number" ? first.retain : 0;
  const [insertion, deletion, extra] = typeof first?.retain === "number" ? ops.slice(1) : ops;
  const inserted = insertion?.insert;
  if (typeof inserted !== "object" || deletion?.delete !== 1 || extra) return false;
  const replaced = previous.slice(at, at + 1).ops[0]?.insert;
  if (typeof replaced !== "object" || !isBlockEmbed(inserted)) return false;
  return Object.keys(inserted)[0] === Object.keys(replaced)[0];
}

export function withoutHistory(quill: Quill, change: () => void) {
  const { history } = quill;
  history.ignoreChange = true;
  change();
  history.ignoreChange = false;
}

// Edits inside an embed look like churn to its owner, so structural ones are recorded by hand.
export function undoableEmbedChange(node: Element, change: () => void) {
  const owner = owningEditor(node);
  const blot = Quill.find(node, true);
  const record = owner && recorders.get(owner);
  if (!(owner && record && blot instanceof BlockEmbed)) {
    change();
    return;
  }
  const at = owner.getIndex(blot);
  const before = blot.delta();
  change();
  flush();
  const swap = (block: Delta) => new Delta().retain(at).concat(block).delete(1);
  const after = swap(blot.delta());
  const previous = owner.getContents().compose(swap(before));
  owner.history.cutoff();
  record(after, previous);
  owner.history.cutoff();
}

export function forwardHistory(quill: Quill, node: Element) {
  for (const [step, shiftKey] of [
    ["undo", false],
    ["redo", true],
  ] as const) {
    bindFirst(quill, { key: "z", shiftKey, shortKey: true }, () => {
      if (quill.history.stack[step].length > 0) return true;
      owningEditor(node)?.history[step]();
      return false;
    });
  }
}

export function ignoreEmbedChurn(quill: Quill) {
  const { history } = quill;
  const record = history.record.bind(history);
  recorders.set(quill, record);
  history.record = (change, oldDelta) => {
    if (!isEmbedChurn(change, oldDelta)) record(change, oldDelta);
  };
}
