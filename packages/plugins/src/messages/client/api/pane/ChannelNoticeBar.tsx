import { service } from "@slock/core/solid";
import type { ChannelId } from "@slock/types";
import { Button, Icon, type IconName, InlineFeedback } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import "./ChannelNoticeBar.css";

const feedback = service("feedback");
const titles = service("titles");

export interface NoticeAction {
  disabled: boolean;
  icon: IconName;
  label: string;
  onClick: () => void;
}

export default function ChannelNoticeBar(props: {
  action?: NoticeAction;
  channelId: ChannelId;
  children: JSX.Element;
  subject?: string;
}) {
  return (
    <div class="channel-notice-bar composer-frame surface-popover flex-between">
      <div class="channel-notice-bar-text truncate">
        {props.subject ?? titles.label(props.channelId)} {props.children}
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
