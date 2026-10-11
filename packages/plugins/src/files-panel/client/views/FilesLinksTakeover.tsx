import { service } from "@slock/core/solid";
import { onCleanup } from "solid-js";
import type { MessageHeaderProps } from "../../../messages/client/api";
import FilesLinksPanel from "./FilesLinksPanel";

const filesPanel = service("files-panel");

export default function FilesLinksTakeover(props: MessageHeaderProps) {
  const channelId = props.id;
  onCleanup(
    () => filesPanel.filesLinksChannelId() === channelId && filesPanel.closeFilesLinksPanel(),
  );
  return <FilesLinksPanel />;
}
