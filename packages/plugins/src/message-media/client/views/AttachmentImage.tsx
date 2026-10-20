import { Slot } from "@slock/core/solid";
import type { Attachment } from "@slock/types";
import { ConstrainedImage, constrainMediaDimensions } from "@slock/ui";
import { Show } from "solid-js";
import "./AttachmentCard.css";

export default function AttachmentImage(props: { attachment: Attachment; large?: boolean }) {
  const a = props.attachment;
  const dimensions = () =>
    props.large
      ? constrainMediaDimensions(a.imageWidth, a.imageHeight, 360, 320, 360, 180)
      : constrainMediaDimensions(a.imageWidth, a.imageHeight, 240, 200, 240, 160);
  return (
    <Show when={a.imageUrl}>
      {(url) => (
        <ConstrainedImage
          alt=""
          class={`attachment-image${props.large ? " attachment-gif-image" : ""}`}
          height={dimensions().height}
          overlay={<Slot attachment={a} point="message-media.attachmentOverlay" />}
          src={url()}
          width={dimensions().width}
        />
      )}
    </Show>
  );
}
