import { MenuItem } from "@slock/ui";
import type { ComposerAttachProps } from "../../../composer/client/api";
import type { Gif } from "../store";
import GifPicker from "./GifPicker";

async function gifFile(gif: Gif) {
  const response = await fetch(gif.media ?? gif.preview);
  if (!response.ok) throw new Error(`GIF returned ${response.status}`);
  return new File([await response.blob()], "tenor.gif", { type: "image/gif" });
}

export default function InsertGifItem(props: ComposerAttachProps) {
  return (
    <MenuItem
      icon="gif"
      onClick={() => {
        props.close();
        props.showPopover((close) => (
          <GifPicker
            onClose={close}
            onSelect={async (gif) => {
              close();
              props.addFiles([await gifFile(gif)]);
            }}
          />
        ));
      }}
    >
      Attach GIF
    </MenuItem>
  );
}
