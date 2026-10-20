import { service } from "@slock/core/solid";
import { MenuItem } from "@slock/ui";
import { For } from "solid-js";
import type { MessageMenuProps } from "../../../messages/client/api";
import { attachmentGif } from "../lib/attachmentGif";

const gifs = service("gifs");

export default function FavoriteMessageItem(props: MessageMenuProps) {
  const images = () =>
    (props.msg.attachments ?? []).flatMap((attachment) => attachmentGif(attachment) ?? []);
  return (
    <For each={images()}>
      {(gif) => (
        <MenuItem
          icon={gifs.isFavorite(gif) ? "unstar" : "star"}
          onClick={() => {
            props.close();
            gifs.toggleFavorite(gif);
          }}
        >
          {gifs.isFavorite(gif) ? "Remove from favorite GIFs" : "Add to favorite GIFs"}
        </MenuItem>
      )}
    </For>
  );
}
