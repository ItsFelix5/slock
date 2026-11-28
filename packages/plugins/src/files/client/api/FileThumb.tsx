import { safeMediaUrl } from "@slock/blockkit";
import type { SlackFile } from "@slock/types";
import { Icon, imageSrc } from "@slock/ui";
import { Show } from "solid-js";
import { fileIconName } from "./fileSummary";

export default function FileThumb(props: {
  file: SlackFile;
  iconClass: string;
  iconSize: number;
  imageClass: string;
}) {
  return (
    <Show
      fallback={
        <span class={`${props.iconClass} flex-center`}>
          <Icon name={fileIconName(props.file)} size={props.iconSize} />
        </span>
      }
      when={props.file.isImage ? safeMediaUrl(props.file.thumbUrl) : undefined}
    >
      {(thumb) => (
        <img
          alt=""
          class={props.imageClass}
          decoding="async"
          loading="lazy"
          src={imageSrc(thumb())}
        />
      )}
    </Show>
  );
}
