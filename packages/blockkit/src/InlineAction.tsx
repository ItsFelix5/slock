import type { JSX } from "@solidjs/web";
import { omit, Show } from "solid-js";
import { useInertTokens } from "./context";

interface InlineActionProps extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, "onClick"> {
  onActivate: (e: Event) => void;
  disabled?: boolean;
}

export default function InlineAction(props: InlineActionProps) {
  const rest = omit(props, "onActivate", "disabled");
  const inert = useInertTokens();
  return (
    <Show fallback={<span {...rest} />} when={!inert}>
      <span
        {...rest}
        onClick={(e) => props.onActivate(e)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          props.onActivate(e);
        }}
        role="button"
        tabindex={props.disabled ? undefined : 0}
      />
    </Show>
  );
}
