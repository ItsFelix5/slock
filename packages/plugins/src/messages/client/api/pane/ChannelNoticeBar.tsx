import { service } from "@slock/core/solid";
import type { ChannelId } from "@slock/types";
import { Button, Icon, InlineFeedback } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import "./ChannelNoticeBar.css";

const feedback = service("feedback");
const titles = service("titles");

export default function ChannelNoticeBar(props: {
  action?: { disabled: boolean; icon: "archive" | "plus"; label: string; onClick: () => void };
  channelId: ChannelId;
  children: JSX.Element;
  subject?: string;
}) {
  return (
    <div class="channel-notice-bar composer-frame surface-popover flex-between">
      <div class="channel-notice-bar-text truncate">
        <strong>{props.subject ?? titles.label(props.channelId)}</strong> {props.children}
      </div>
      <InlineFeedback
        class="channel-notice-bar-feedback truncate"
        feedback={feedback.get(props.channelId)}
        priority={2}
      />
      <Show when={props.action}>
        {(action) => (
          <Button
            class="flex-shrink-0"
            disabled={action().disabled}
            onClick={action().onClick}
            variant="primary"
          >
            <Icon name={action().icon} size={14} />
            {action().label}
          </Button>
        )}
      </Show>
    </div>
  );
}
