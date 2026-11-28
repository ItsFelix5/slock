import type { JSX } from "@solidjs/web";
import { createSignal, omit, Show } from "solid-js";
import { imageSrc } from "../mediaSrc";

export default function HideBrokenImage(
  props: JSX.ImgHTMLAttributes<HTMLImageElement> & { fallback?: JSX.Element; src: string },
) {
  const rest = omit(props, "fallback", "src");
  const [brokenSrc, setBrokenSrc] = createSignal<string>();
  return (
    <Show fallback={props.fallback} when={props.src !== brokenSrc()}>
      <img {...rest} onError={() => setBrokenSrc(props.src)} src={imageSrc(props.src)} />
    </Show>
  );
}
