import { service } from "@slock/core/solid";
import { Icon, Tooltip } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageHeaderProps } from "../../../messages/client/api";
import "./HeaderMembersButton.css";

const channels = service("channels");
const channelDetails = service("channel-details");

export default function HeaderMembersButton(props: MessageHeaderProps) {
  const memberCount = () => {
    channels.ensureChannelTopic(props.id);
    return channels.channelById(props.id)?.memberCount;
  };
  return (
    <Show when={props.kind === "channel" && memberCount()}>
      {(count) => (
        <Tooltip content="View members">
          <button
            class="channel-header-members-btn btn-reset icon-btn icon-action"
            onClick={() => channelDetails.openChannelDetails(props.id, "members")}
            type="button"
          >
            <Icon name="user-groups" size={16} />
            <span>{count()}</span>
          </button>
        </Tooltip>
      )}
    </Show>
  );
}
