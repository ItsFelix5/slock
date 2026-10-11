import { service } from "@slock/core/solid";
import type { ChannelDetails } from "@slock/types";
import { Icon } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { channelIconName } from "../../../channels/client/api";
import MrkdwnComposer from "../../../composer/client/api/MrkdwnComposer";

const usersStore = service("users");

export default function ChannelAboutFields(props: {
  details: ChannelDetails;
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
          Channel name
        </label>
        <div class="channel-details-name-wrap flex-align-center">
          <span class="channel-details-name-prefix flex-align-center">
            <Icon name={channelIconName(d().private, d().archived)} size={13} />
          </span>
          <input
            class="text-field"
            disabled={props.saving}
            id="channel-details-name"
            onInput={(e) => props.onName(e.currentTarget.value)}
            data-commit-on-enter
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
      <Show when={createdLine()}>
        <p class="channel-details-meta">{createdLine()}</p>
      </Show>
    </>
  );
}
