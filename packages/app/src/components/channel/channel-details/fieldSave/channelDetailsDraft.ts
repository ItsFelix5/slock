import type { ChannelDetails } from "@slock/slack-api";

export type ChannelDetailsDraft = Pick<ChannelDetails, "name" | "purpose" | "topic">;
export type EditableChannelDetails = ChannelDetailsDraft & Pick<ChannelDetails, "id">;

function channelDetailsDraft(details: ChannelDetails): ChannelDetailsDraft {
  return { name: details.name, purpose: details.purpose, topic: details.topic };
}

export function editableChannelDetails(details: ChannelDetails): EditableChannelDetails {
  return { id: details.id, ...channelDetailsDraft(details) };
}

export function mergeChannelDetailsDraft(
  current: ChannelDetailsDraft,
  previousServer: EditableChannelDetails | undefined,
  nextServer: ChannelDetails,
): ChannelDetailsDraft {
  if (!previousServer || previousServer.id !== nextServer.id)
    return channelDetailsDraft(nextServer);
  return {
    name: current.name === previousServer.name ? nextServer.name : current.name,
    purpose: current.purpose === previousServer.purpose ? nextServer.purpose : current.purpose,
    topic: current.topic === previousServer.topic ? nextServer.topic : current.topic,
  };
}
