import { formatSlackDate } from "@slock/blockkit";
import type { ComposerEditor, DateValue } from "../../../composer/client/api";
import DatePicker from "../api/DatePicker";
import type { DateTarget } from "./dateAt";

export function openDatePicker(editor: ComposerEditor, target?: DateTarget) {
  editor.showPopover((close) => (
    <DatePicker
      initial={target?.value}
      onClose={close}
      onSelect={(timestamp, format) => {
        const quill = editor.quill();
        if (!quill) return;
        const value: DateValue = { fallback: formatSlackDate(timestamp), format, ts: timestamp };
        if (target) {
          quill.deleteText(target.index, 1);
          quill.insertEmbed(target.index, "date", value);
          return;
        }
        close();
        const index = quill.getSelection(true)?.index ?? quill.getLength();
        quill.insertEmbed(index, "date", value);
        quill.insertText(index + 1, " ");
        quill.setSelection(index + 2, 0);
        quill.focus();
      }}
    />
  ));
}
