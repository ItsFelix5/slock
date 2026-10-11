import { service } from "@slock/core/solid";
import type { ChannelDetails } from "@slock/types";
import { createCopyFeedback, Icon } from "@slock/ui";
import { Show } from "solid-js";
import { getChannelLink } from "../../../slack/client/api";

const feedback = service("feedback");

export default function ChannelCopyRows(props: { details: ChannelDetails }) {
  const d = () => props.details;
  const [copiedKey, copy] = createCopyFeedback(1200, () => {
    feedback.flash(d().id, "Couldn't copy to the clipboard.", "error");
  });

  return (
    <div class="channel-details-copy-list flex-col">
      <Show when={d().email}>
        {(email) => (
          <button
            class="channel-details-copy-row btn-reset flex-align-center"
            onClick={() => copy(email(), "email")}
            type="button"
          >
            <Icon name="email-filled" size={15} />
            <span class="channel-details-copy-value truncate grow">{email()}</span>
            <Icon name={copiedKey() === "email" ? "check" : "copy"} size={14} />
          </button>
        )}
      </Show>
      <button
        class="channel-details-copy-row btn-reset flex-align-center"
        onClick={async () => {
          const link = await getChannelLink(d().id);
          if (link) copy(link, "link");
        }}
        type="button"
      >
        <Icon name="link" size={15} />
        <span class="channel-details-copy-value truncate grow">Copy link to channel</span>
        <Icon name={copiedKey() === "link" ? "check" : "copy"} size={14} />
      </button>
      <button
        class="channel-details-copy-row btn-reset flex-align-center"
        onClick={() => copy(d().id, "id")}
        type="button"
      >
        <Icon name="info" size={15} />
        <span class="channel-details-copy-value truncate grow">Channel ID: {d().id}</span>
        <Icon name={copiedKey() === "id" ? "check" : "copy"} size={14} />
      </button>
    </div>
  );
}
