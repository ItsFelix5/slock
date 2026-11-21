import type { ComposerAttachProps } from "@slock/plugins/composer/client/api";
import { MenuItem } from "@slock/ui";

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
