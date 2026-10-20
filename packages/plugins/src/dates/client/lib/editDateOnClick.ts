import type { BindEditor } from "../../../composer/client/api";
import { dateAt } from "./dateAt";
import { openDatePicker } from "./openDatePicker";

export const editDateOnClick: BindEditor = (quill, editor) => {
  const onClick = (event: MouseEvent) => {
    const chip = event.target instanceof Element ? event.target.closest(".bk-date") : null;
    const blot = chip && quill.scroll.find(chip);
    const target = blot ? dateAt(quill, quill.getIndex(blot)) : undefined;
    if (target) openDatePicker(editor, target);
  };
  quill.root.addEventListener("click", onClick);
  return () => quill.root.removeEventListener("click", onClick);
};
