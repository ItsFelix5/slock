import { service } from "@slock/core/solid";
import { channelIconName } from "@slock/plugins/channels/client/api";
import MrkdwnComposer from "@slock/plugins/composer/client/api/MrkdwnComposer";
import type { ChannelDetails } from "@slock/types";
import { Icon } from "@slock/ui";
import { createMemo, Show } from "solid-js";

const usersStore = service("users");

export default function ChannelAboutFields(props: {
  details: ChannelDetails;
  groupChat: boolean;
  name: string;
  onName: (value: string) => void;
  onPurpose: (value: string) => void;
  onTopic: (value: string) => void;
  purpose: string;
  saving: boolean;
  topic: string;
}) {
  const d = () => props.details;
  const createdLine = createMemo(() => {
    const { created, creatorId } = d();
    if (!created) return null;
    const date = new Date(created * 1000).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const creator = creatorId ? usersStore.userById(creatorId)?.name : undefined;
    return creator ? `Created by ${creator} on ${date}` : `Created on ${date}`;
  });
  return (
    <>
      <div class="channel-details-field flex-col">
        <label class="field-label" for="channel-details-name">
          {props.groupChat ? "Group chat name" : "Channel name"}
        </label>
        <div class="channel-details-name-wrap flex-align-center">
          <Show when={!props.groupChat}>
            <span class="channel-details-name-prefix flex-align-center">
              <Icon name={channelIconName(d().private, d().archived)} size={13} />
            </span>
          </Show>
          <input
            class="text-field grow"
            disabled={props.saving}
            id="channel-details-name"
            onInput={(e) => props.onName(e.currentTarget.value)}
            data-commit-on-enter
            placeholder={props.groupChat ? "Add a name" : undefined}
            type="text"
            value={props.name}
          />
        </div>
      </div>
      <div class="channel-details-field flex-col">
        <label class="field-label" for="channel-details-topic">
          Topic
        </label>
        <MrkdwnComposer
          ariaLabel="Topic"
          ariaBusy={props.saving}
          channelId={d().id}
          disabled={props.saving}
          id="channel-details-topic"
          onInput={props.onTopic}
          placeholder="Add a topic"
          value={props.topic}
        />
      </div>
      <Show when={!props.groupChat}>
        <div class="channel-details-field flex-col">
          <label class="field-label" for="channel-details-purpose">
            Description
          </label>
          <MrkdwnComposer
            ariaLabel="Description"
            ariaBusy={props.saving}
            channelId={d().id}
            disabled={props.saving}
            id="channel-details-purpose"
            multiline
            onInput={props.onPurpose}
            placeholder="Add a description"
            value={props.purpose}
          />
        </div>
      </Show>
      <Show when={createdLine()}>
        <p class="channel-details-meta">{createdLine()}</p>
      </Show>
    </>
  );
}
