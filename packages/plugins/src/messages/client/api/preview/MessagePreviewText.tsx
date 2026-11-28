import { Mrkdwn } from "@slock/blockkit";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import { type PreviewContent, previewBody, previewPlaceholder } from "./previewContent";
import "./MessagePreviewText.css";

export default function MessagePreviewText(props: PreviewContent & { inline?: boolean }) {
  const text = () => previewBody(props).text;
  const placeholder = () => (text() ? undefined : previewPlaceholder(props));
  return (
    <Show fallback={<Mrkdwn inline={props.inline} text={text()} />} when={placeholder()}>
      {(shown) => (
        <span class="message-placeholder">
          <Icon name={shown().icon} size={12} />
          <span class="truncate">
            <Show fallback={shown().label} when={shown().markdown}>
              <Mrkdwn inline text={shown().label.replace(/\s*\n\s*/g, " ")} />
            </Show>
          </span>
        </span>
      )}
    </Show>
  );
}
