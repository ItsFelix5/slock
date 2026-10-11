import { service } from "@slock/core/solid";
import { focusPaneById, IconButton } from "@slock/ui";
import { usePaneView } from "../../../conversations/client/api/paneView";
import type { MessageHeaderProps } from "../../../messages/client/api";

const filesPanel = service("files-panel");

export default function FilesLinksButton(props: MessageHeaderProps) {
  const { paneId } = usePaneView();
  const isOpen = () => filesPanel.filesLinksChannelId() === props.id;
  const toggle = () => {
    if (isOpen()) filesPanel.closeFilesLinksPanel();
    else filesPanel.openFilesLinksPanel(props.id);
    queueMicrotask(() => focusPaneById(paneId));
  };
  return (
    <IconButton
      active={isOpen()}
      class="channel-header-btn"
      icon="search"
      onClick={toggle}
      size="md"
    />
  );
}
