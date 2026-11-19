import { createSignal, type JSX, Show, splitProps } from "solid-js";
import { imageSrc } from "../mediaSrc";

export default function HideBrokenImage(
  props: JSX.ImgHTMLAttributes<HTMLImageElement> & { src: string },
) {
  const [local, rest] = splitProps(props, ["src"]);
  const [brokenSrc, setBrokenSrc] = createSignal<string>();
  return (
    <Show when={local.src !== brokenSrc()}>
      <img {...rest} onError={() => setBrokenSrc(local.src)} src={imageSrc(local.src)} />
    </Show>
  );
}
