import { ImageLightbox } from "@slock/ui";
import { createSignal, onCleanup, Show } from "solid-js";

function Thumbnail(props: { src: string; fullSrc?: string; name: string }) {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <button
        class="composer-file-chip-thumb-button btn-reset"
        onClick={() => setOpen(true)}
        type="button"
      >
        <img alt={props.name} class="composer-file-chip-thumb" src={props.src} />
      </button>
      <Show when={open()}>
        <ImageLightbox
          gallery={[{ alt: props.name, src: props.fullSrc ?? props.src }]}
          index={0}
          onClose={() => setOpen(false)}
          onIndexChange={() => {}}
        />
      </Show>
    </>
  );
}

function LocalThumbnail(props: { file: File }) {
  const url = URL.createObjectURL(props.file);
  onCleanup(() => URL.revokeObjectURL(url));
  return <Thumbnail name={props.file.name} src={url} />;
}

export default function FileChipThumbnail(props: {
  file: File;
  thumbSrc?: string;
  fullSrc?: string;
}) {
  if (props.thumbSrc)
    return <Thumbnail fullSrc={props.fullSrc} name={props.file.name} src={props.thumbSrc} />;
  if (!props.file.type.startsWith("image/")) return null;
  return <LocalThumbnail file={props.file} />;
}
