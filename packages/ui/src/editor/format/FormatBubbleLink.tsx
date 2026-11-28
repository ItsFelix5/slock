import { onSettled } from "solid-js";

interface FormatBubbleLinkProps {
  onBlur: () => void;
  onCancel: () => void;
  onSubmit: (url: string) => void;
}

export default function FormatBubbleLink(props: FormatBubbleLinkProps) {
  let input: HTMLInputElement | undefined;
  onSettled(() => input?.focus());

  return (
    <input
      class="text-field format-bubble-link"
      onBlur={props.onBlur}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Enter") props.onSubmit(event.currentTarget.value.trim());
        else props.onCancel();
      }}
      placeholder="Link"
      ref={input}
      type="text"
    />
  );
}
