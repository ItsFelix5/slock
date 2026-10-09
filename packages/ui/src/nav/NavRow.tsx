import { type JSX, splitProps } from "solid-js";

export interface NavRowProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClick"> {
  onActivate: () => void;
}

export default function NavRow(props: NavRowProps) {
  const [local, rest] = splitProps(props, ["class", "onActivate", "onKeyDown"]);
  return (
    <div
      {...rest}
      class={`btn-reset ${local.class ?? ""}`}
      data-nav-row
      onClick={() => local.onActivate()}
      onKeyDown={(e) => {
        if (typeof local.onKeyDown === "function") local.onKeyDown(e);
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        local.onActivate();
      }}
      role="button"
    />
  );
}
