import type { JSX } from "@solidjs/web";

export default function LinkButton(props: { children: JSX.Element; href: string; style?: string }) {
  return (
    <a
      class={`bk-button bk-button--${props.style ?? "default"}`}
      href={props.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {props.children}
    </a>
  );
}
