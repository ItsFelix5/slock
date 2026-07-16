import { Show } from "solid-js";
import "./TypingIndicator.css";

export interface TypingIndicatorProps {
  names: string[];
}

function label(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are typing…`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing…`;
}

export default function TypingIndicator(props: TypingIndicatorProps) {
  return (
    <Show when={props.names.length > 0}>
      <div class="typing-indicator">
        <span class="typing-indicator-dots">
          <span />
          <span />
          <span />
        </span>
        <span class="typing-indicator-label truncate">{label(props.names)}</span>
      </div>
    </Show>
  );
}
