import { type JSX, splitProps } from "solid-js";

interface InlineActionProps extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, "onClick"> {
  onActivate: (e: Event) => void;
  disabled?: boolean;
}

export default function InlineAction(props: InlineActionProps) {
  const [local, rest] = splitProps(props, ["onActivate", "disabled"]);
  return (
    <span
      {...rest}
      onClick={(e) => local.onActivate(e)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        local.onActivate(e);
      }}
      role="button"
      tabindex={local.disabled ? undefined : 0}
    />
  );
}
