import { service } from "@slock/core/solid";
import type { MessageHeaderProps } from "@slock/plugins/messages/client/api";
import { onCleanup } from "solid-js";
import FilesLinksPanel from "./FilesLinksPanel";

const filesPanel = service("files-panel");

export default function FilesLinksTakeover(props: MessageHeaderProps) {
  const channelId = props.id;
  onCleanup(
    () => filesPanel.filesLinksChannelId() === channelId && filesPanel.closeFilesLinksPanel(),
  );
  return <FilesLinksPanel />;
}
