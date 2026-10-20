import type { Attachment } from "@slock/types";
import type { Gif } from "../store";

export function attachmentGif(attachment: Attachment): Gif | undefined {
  const preview = attachment.imageUrl;
  if (!preview) return;
  return { preview, url: attachment.fromUrl ?? preview };
}
