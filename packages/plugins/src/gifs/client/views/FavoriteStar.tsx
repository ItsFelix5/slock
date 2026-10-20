import { service } from "@slock/core/solid";
import { IconButton } from "@slock/ui";
import { Show } from "solid-js";
import type { AttachmentImageOverlayProps } from "../../../message-media/client/api/imageOverlay";
import { attachmentGif } from "../lib/attachmentGif";

const gifs = service("gifs");

export default function FavoriteStar(props: AttachmentImageOverlayProps) {
  return (
    <Show when={attachmentGif(props.attachment)}>
      {(gif) => (
        <IconButton
          active={gifs.isFavorite(gif())}
          icon={gifs.isFavorite(gif()) ? "star-filled" : "star"}
          label={gifs.isFavorite(gif()) ? "Remove from favorites" : "Add to favorites"}
          onClick={() => gifs.toggleFavorite(gif())}
          size="sm"
        />
      )}
    </Show>
  );
}
