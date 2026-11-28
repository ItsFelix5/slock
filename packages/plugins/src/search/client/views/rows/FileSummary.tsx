import { EmojiText } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import FileThumb from "@slock/plugins/files/client/api/FileThumb";
import {
  fileKindLabel,
  formatFileDate,
  isCanvasFile,
} from "@slock/plugins/files/client/api/fileSummary";
import { mentionText } from "@slock/plugins/users/client/api";
import type { SlackFile } from "@slock/types";
import { formatSize } from "@slock/ui";

const usersStore = service("users");

export default function FileSummary(props: { file: SlackFile }) {
  const meta = () => {
    const { file } = props;
    return [
      fileKindLabel(file),
      file.userId ? usersStore.userById(file.userId)?.name : undefined,
      isCanvasFile(file) || !file.size ? "" : formatSize(file.size),
      formatFileDate(file.created),
    ]
      .filter(Boolean)
      .join(" · ");
  };
  return (
    <>
      <FileThumb
        file={props.file}
        iconClass="search-row-icon"
        iconSize={16}
        imageClass="search-row-thumb"
      />
      <span class="truncate">
        <EmojiText text={mentionText(props.file.title || props.file.name)} />
      </span>
      <span class="search-row-meta text-dim truncate">{meta()}</span>
    </>
  );
}
