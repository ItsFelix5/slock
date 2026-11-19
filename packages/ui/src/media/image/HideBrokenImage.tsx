import type { JSX } from "@solidjs/web";
import { createSignal, omit, Show } from "solid-js";
import { imageSrc } from "../mediaSrc";

export default function HideBrokenImage(
  props: JSX.ImgHTMLAttributes<HTMLImageElement> & { src: string },
) {
  const rest = omit(props, "src");
  const [brokenSrc, setBrokenSrc] = createSignal<string>();
  return (
    <Show when={props.src !== brokenSrc()}>
      <img {...rest} onError={() => setBrokenSrc(props.src)} src={imageSrc(props.src)} />
    </Show>
  );
}
