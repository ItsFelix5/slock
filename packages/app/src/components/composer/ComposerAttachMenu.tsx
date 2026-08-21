import { IconButton, Menu, MenuItem } from "@slock/ui";

export default function ComposerAttachMenu(props: {
  onFilesSelected: (files: FileList) => void;
  onInsertDate: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  let fileInputRef: HTMLInputElement | undefined;
  let plusClickTimer: ReturnType<typeof setTimeout> | undefined;

  const handlePlusClick = () => {
    if (plusClickTimer) {
      clearTimeout(plusClickTimer);
      plusClickTimer = undefined;
      return;
    }
    plusClickTimer = setTimeout(() => {
      plusClickTimer = undefined;
      props.onOpenChange(true);
    }, 220);
  };
  const handlePlusDblClick = () => {
    if (plusClickTimer) {
      clearTimeout(plusClickTimer);
      plusClickTimer = undefined;
    }
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
        <MenuItem
          icon="attachment"
          onClick={() => {
            props.onOpenChange(false);
            fileInputRef?.click();
          }}
        >
          Attach file
        </MenuItem>
        <MenuItem
          icon="calendar"
          onClick={() => {
            props.onOpenChange(false);
            props.onInsertDate();
          }}
        >
          Insert date
        </MenuItem>
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
