import { resolveRunContainer } from "./containerPath";
import type { DocModel, InlineRun, LinkRun } from "./docModel";
import { createId } from "./docModel";
import type { CaretContext } from "./editorHandle";
import { deleteRange, getRunsInRange, type Range, resolveOffsetInRuns } from "./range";

export interface TextOpsDeps<A> {
  getDoc: () => DocModel<A>;
  getSelection: () => Range | null;
  setSelection: (range: Range | null) => void;
  pushHistory: () => void;
  commit: (doc: DocModel<A>) => void;
  getCaretContext: () => CaretContext | null;
}

/** `replaceTriggerRange` and `applyLinkToSelection` — pulled out of `createEditorStore` since
 * both are just "delete a range, splice runs in at what's left" wired to different range sources
 * (a caret-relative trigger span vs. an arbitrary selection). */
export function createTextOps<A>(deps: TextOpsDeps<A>) {
  const { getDoc, getSelection, setSelection, pushHistory, commit, getCaretContext } = deps;

  const insertRunsReplacingRange = (range: Range, runs: InlineRun<A>[]): void => {
    pushHistory();
    const { doc: cleared, caret } = deleteRange(getDoc(), range);
    const caretContainerPath = caret.path.slice(0, -1);
    const clearedRuns = resolveRunContainer(cleared.blocks, caretContainerPath);
    if (!clearedRuns) {
      commit(cleared);
      return;
    }
    const runIndex = clearedRuns.length ? caret.path[caret.path.length - 1] : 0;
    clearedRuns.splice(runIndex, 0, ...runs);
    const lastInserted = runs[runs.length - 1];
    const newOffset = lastInserted.kind === "atom" ? 0 : lastInserted.text.length;
    const newPath = [...caretContainerPath, runIndex + runs.length - 1];
    commit(cleared);
    setSelection({
      anchor: { offset: newOffset, path: newPath },
      focus: { offset: newOffset, path: newPath },
    });
  };

  const replaceTriggerRange = (start: number, runsArg: InlineRun<A> | InlineRun<A>[]): void => {
    const selection = getSelection();
    if (!selection) return;
    const containerPath = selection.focus.path.slice(0, -1);
    const containerRuns = resolveRunContainer(getDoc().blocks, containerPath);
    if (!containerRuns) return;
    const from = resolveOffsetInRuns(containerRuns, start);
    const to = resolveOffsetInRuns(containerRuns, getCaretContext()?.caretOffset ?? start);
    const range: Range = {
      anchor: { offset: from.charOffset, path: [...containerPath, from.runIndex] },
      focus: { offset: to.charOffset, path: [...containerPath, to.runIndex] },
    };
    insertRunsReplacingRange(range, Array.isArray(runsArg) ? runsArg : [runsArg]);
  };

  const applyLinkToSelection = (url: string): void => {
    const selection = getSelection();
    if (!selection) return;
    const spans = getRunsInRange(getDoc(), selection).filter((s) => s.run.kind !== "atom");
    const label = spans
      .map((s) => (s.run as { text: string }).text.slice(s.startOffset, s.endOffset))
      .join("");
    if (!label) return;
    const link: LinkRun = { id: createId(), kind: "link", marks: [], text: label, url };
    insertRunsReplacingRange(selection, [link]);
  };

  return { applyLinkToSelection, replaceTriggerRange };
}
