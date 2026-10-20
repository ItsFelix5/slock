import type { Attachment } from "@slock/types";
import type { Component } from "solid-js";

export type AttachmentImageOverlayProps = { attachment: Attachment };

declare module "@slock/core/types" {
  interface Points {
    "message-media.attachmentOverlay": Component<AttachmentImageOverlayProps>;
  }
}
