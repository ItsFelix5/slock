import { service } from "@slock/core/solid";
import { usePaneView } from "@slock/plugins/conversations/client/api/paneView";
import type { MessageHeaderProps } from "@slock/plugins/messages/client/api";
import { focusPaneById, IconButton } from "@slock/ui";

const filesPanel = service("files-panel");

export default function FilesLinksButton(props: MessageHeaderProps) {
  const { paneId } = usePaneView();
  const isOpen = () => filesPanel.filesLinksChannelId() === props.id;
  const toggle = () => {
    if (isOpen()) filesPanel.closeFilesLinksPanel();
    else filesPanel.openFilesLinksPanel(props.id);
    queueMicrotask(() => focusPaneById(paneId));
  };
  return <IconButton active={isOpen()} class="channel-header-btn" icon="search" onClick={toggle} />;
}
