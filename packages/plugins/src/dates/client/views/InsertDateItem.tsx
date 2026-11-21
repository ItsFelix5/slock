import type { ComposerAttachProps } from "@slock/plugins/composer/client/api";
import { MenuItem } from "@slock/ui";
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
