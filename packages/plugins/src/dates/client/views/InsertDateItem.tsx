import { MenuItem } from "@slock/ui";
import type { ComposerAttachProps } from "../../../composer/client/api";
import { openDatePicker } from "../lib/openDatePicker";

export default function InsertDateItem(props: ComposerAttachProps) {
  return (
    <MenuItem
      icon="calendar"
      onClick={() => {
        props.close();
        openDatePicker(props);
      }}
    >
      Insert date
    </MenuItem>
  );
}
