import { formatSlackDate } from "@slock/blockkit";
import type Quill from "quill";
import { createSignal } from "solid-js";
import { type DateTarget, type DateValue, dateAt } from "./dateEmbed";

export function useDateEdit(getQuill: () => Quill | undefined) {
  const [picker, setPicker] = createSignal<{ target?: DateTarget }>();

  const select = (timestamp: number, format: string) => {
    const target = picker()?.target;
    setPicker(undefined);
    const quill = getQuill();
    if (!quill) return;
    const value: DateValue = { fallback: formatSlackDate(timestamp), format, ts: timestamp };
    if (target) {
      quill.deleteText(target.index, 1);
      quill.insertEmbed(target.index, "date", value);
      quill.setSelection(target.index + 1, 0);
    } else {
      const index = quill.getSelection(true)?.index ?? quill.getLength();
      quill.insertEmbed(index, "date", value);
      quill.insertText(index + 1, " ");
      quill.setSelection(index + 2, 0);
    }
    quill.focus();
  };

  return {
    bind(quill: Quill) {
      const onClick = (event: MouseEvent) => {
        const chip = event.target instanceof Element ? event.target.closest(".bk-date") : null;
        const blot = chip && quill.scroll.find(chip);
        const target = blot ? dateAt(quill, quill.getIndex(blot)) : undefined;
        if (target) setPicker({ target });
      };
      quill.root.addEventListener("click", onClick);
      return () => quill.root.removeEventListener("click", onClick);
    },
    close: () => setPicker(undefined),
    open: () => setPicker({}),
    picker,
    select,
  };
}
