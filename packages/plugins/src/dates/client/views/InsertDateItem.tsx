import { MenuItem } from "@slock/ui";
import type { ComposerAttachProps } from "../../../composer/client/api";

export default function InsertDateItem(props: ComposerAttachProps) {
  return (
    <MenuItem
      icon="calendar"
      onClick={() => {
        props.close();
        props.insertDate();
      }}
    >
      Insert date
    </MenuItem>
  );
}
