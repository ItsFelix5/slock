import { MenuItem } from "@slock/ui";
import type { ComposerAttachProps } from "../../../composer/client/api";

export default function AttachFileItem(props: ComposerAttachProps) {
  return (
    <MenuItem
      icon="attachment"
      onClick={() => {
        props.close();
        props.pickFiles();
      }}
    >
      Attach file
    </MenuItem>
  );
}
