import { Slot, useDebouncer } from "@slock/core/solid";
import { IconButton, Menu } from "@slock/ui";
import type { ComposerEditor } from "../api";

export default function ComposerAttachMenu(props: {
  onFilesSelected: (files: FileList | File[]) => void;
  editor: ComposerEditor;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  let fileInputRef: HTMLInputElement | undefined;
  const openMenu = useDebouncer(() => props.onOpenChange(true), 220);

  const handlePlusClick = () => {
    if (openMenu.pending()) openMenu.cancel();
    else openMenu.schedule();
  };
  const handlePlusDblClick = () => {
    openMenu.cancel();
    fileInputRef?.click();
  };

  return (
    <>
      <Menu
        class="composer-plus-menu"
        onClose={() => props.onOpenChange(false)}
        open={props.open}
        panelClass="menu-panel composer-tools-menu"
        trigger={
          <IconButton
            circular
            icon="plus"
            onClick={handlePlusClick}
            onDblClick={handlePlusDblClick}
            size="md"
          />
        }
      >
        <Slot
          addFiles={props.onFilesSelected}
          close={() => props.onOpenChange(false)}
          quill={props.editor.quill}
          showPopover={props.editor.showPopover}
          pickFiles={() => fileInputRef?.click()}
          point="composer.attach"
        />
      </Menu>
      <input
        class="composer-file-input"
        multiple
        onChange={(e) => {
          if (e.currentTarget.files) props.onFilesSelected(e.currentTarget.files);
          e.currentTarget.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />
    </>
  );
}
