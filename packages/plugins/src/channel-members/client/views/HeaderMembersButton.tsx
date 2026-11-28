import { service } from "@slock/core/solid";
import type { MessageHeaderProps } from "@slock/plugins/messages/client/api";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import { createHeadcount } from "../headcount";
import "./HeaderMembersButton.css";

const channelDetails = service("channel-details");
const dms = service("dms");

export default function HeaderMembersButton(props: MessageHeaderProps) {
  const headcount = createHeadcount(() => (props.kind === "channel" ? props.id : undefined));
  const peopleCount = () => {
    if (props.kind === "channel") return headcount.people();
    const others = dms.dmById(props.id)?.memberIds;
    return others && others.length + 1;
  };
  return (
    <Show when={peopleCount() !== undefined}>
      <button
        class="channel-header-members-btn btn-reset icon-btn icon-action"
        onClick={() => channelDetails.openChannelDetails(props.id, "members")}
        type="button"
      >
        <Icon name="user-groups" size={16} />
        <span>{peopleCount()}</span>
        <Show when={headcount.online()}>
          {(online) => <span class="channel-header-online">{online()}</span>}
        </Show>
      </button>
    </Show>
  );
}
