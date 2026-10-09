import type { SlackFile, SlackFileShare } from "@slock/types";
import { createCopyFeedback, IconButton, Overlay, PanelHeader, useEscapeClose } from "@slock/ui";
import { Show } from "solid-js";
import { actionFeedback } from "../../../lib/feedback";
import { createFileDetailQuery } from "../../../lib/fileDetailQuery";
import { jumpToFilesLinksMessage } from "../../../lib/filesLinksPanel";
import FileDetailAccess from "./FileDetailAccess";
import FileDetailFacts from "./FileDetailFacts";
import FileDetailPreview from "./FileDetailPreview";
import FileTitle from "./FileTitle";
import "./FileDetailModal.css";

export default function FileDetailModal(props: { file: SlackFile; onClose: () => void }) {
  useEscapeClose(props.onClose);
  const detail = createFileDetailQuery(() => props.file.id);
  const file = () => detail.data?.file ?? props.file;
  const [copied, copy] = createCopyFeedback(1500, () =>
    actionFeedback.flash(props.file.id, "Couldn't copy the link.", "error"),
  );

  const openShare = (share: SlackFileShare) => {
    props.onClose();
    jumpToFilesLinksMessage(share.channelId, share.ts, share.threadTs);
  };

  return (
    <Overlay ariaLabel={file().title || file().name} onClose={props.onClose}>
      <div class="file-detail-card">
        <PanelHeader onClose={props.onClose}>
          <div class="file-detail-header flex-align-center">
            <FileTitle
              editable={detail.data?.editable ?? false}
              file={file()}
              onRenamed={() => void detail.refetch()}
            />
            <Show when={file().permalink}>
              {(link) => (
                <IconButton
                  icon={copied() ? "check" : "link"}
                  iconSize={14}
                  label="Copy link"
                  onClick={() => void copy(link(), "link")}
                  size="sm"
                />
              )}
            </Show>
          </div>
        </PanelHeader>
        <div class="file-detail-body flex-col">
          <FileDetailPreview
            content={detail.data?.content}
            failed={detail.isError}
            file={file()}
            onClose={props.onClose}
          />
          <FileDetailFacts detail={detail.data} file={file()} />
          <Show when={detail.data}>
            {(loaded) => (
              <FileDetailAccess
                detail={loaded()}
                file={file()}
                onChanged={() => void detail.refetch()}
                onOpenShare={openShare}
              />
            )}
          </Show>
        </div>
      </div>
    </Overlay>
  );
}
