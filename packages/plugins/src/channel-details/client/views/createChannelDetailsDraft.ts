import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { ChannelDetails, ChannelId } from "@slock/types";
import { createSignal } from "solid-js";
import {
  type ChannelDetailsDraft,
  type EditableChannelDetails,
  editableChannelDetails,
  mergeChannelDetailsDraft,
} from "./fieldSave/channelDetailsDraft";

const channelDetails = service("channel-details");
const feedback = service("feedback");

type Draft = { fields: ChannelDetailsDraft; seeded: EditableChannelDetails | undefined };

const EMPTY_DRAFT: Draft = { fields: { name: "", purpose: "", topic: "" }, seeded: undefined };

const saves = defineMutation<{ id: ChannelId; save: () => Promise<void> }>({
  key: ({ id }) => id,
  mode: "single",
  run: ({ save }) => save(),
});

function stripLeadingHash(name: string): string {
  return name.startsWith("#") ? name.slice(1) : name;
}

export function createChannelDetailsDraft(
  details: () => ChannelDetails | null | undefined,
  refetch: (id: ChannelId) => Promise<unknown>,
  groupChat: () => boolean,
) {
  const [draft, setDraft] = createSignal((previous: Draft = EMPTY_DRAFT): Draft => {
    const d = details();
    if (!d) return previous;
    return {
      fields: mergeChannelDetailsDraft(previous.fields, previous.seeded, d),
      seeded: editableChannelDetails(d),
    };
  });
  const nameInput = () => draft().fields.name;
  const topicInput = () => draft().fields.topic;
  const purposeInput = () => draft().fields.purpose;
  const setField = (key: keyof ChannelDetailsDraft) => (value: string) =>
    setDraft((previous) => ({ ...previous, fields: { ...previous.fields, [key]: value } }));
  const setNameInput = setField("name");
  const setTopicInput = setField("topic");
  const setPurposeInput = setField("purpose");
  const saving = () => {
    const id = channelDetails.channelDetailsId();
    return !!id && saves.pending(id);
  };
  const nextName = () => (groupChat() ? nameInput().trim() : stripLeadingHash(nameInput().trim()));

  const nameDirty = () => {
    const d = details();
    return !!d && nextName() !== d.name;
  };
  const topicDirty = () => {
    const d = details();
    return !!d && topicInput().trim() !== d.topic;
  };
  const purposeDirty = () => {
    const d = details();
    return !!d && purposeInput().trim() !== d.purpose;
  };
  const anyDirty = () => nameDirty() || topicDirty() || purposeDirty();

  const discardChanges = () => {
    const d = details();
    if (!d) return;
    setNameInput(d.name);
    setTopicInput(d.topic);
    setPurposeInput(d.purpose);
  };

  const saveChanges = async () => {
    const id = channelDetails.channelDetailsId();
    const d = details();
    if (!(id && d)) return;

    const name = nextName();
    const noun = groupChat() ? "Group chat" : "Channel";
    if (!(name || groupChat())) {
      setNameInput(d.name);
      feedback.flash(id, "Channel name can't be empty.", "error");
      return;
    }
    const nextTopic = topicInput().trim();
    const nextPurpose = purposeInput().trim();

    await saves.run({
      id,
      save: async () => {
        const [nameOk, topicOk, purposeOk] = await Promise.all([
          name === d.name ? true : channelDetails.renameChannelById(id, name),
          nextTopic === d.topic ? true : channelDetails.updateChannelTopic(id, nextTopic),
          nextPurpose === d.purpose ? true : channelDetails.updateChannelPurpose(id, nextPurpose),
        ]);
        await refetch(id);
        if (nameOk && topicOk && purposeOk) feedback.flash(id, `${noun} updated.`);
        if (channelDetails.channelDetailsId() !== id) return;
        if (!nameOk) setNameInput(d.name);
        if (!topicOk) setTopicInput(d.topic);
        if (!purposeOk) setPurposeInput(d.purpose);
      },
    });
  };

  return {
    anyDirty,
    discardChanges,
    name: nameInput,
    purpose: purposeInput,
    saveChanges,
    saving,
    setName: setNameInput,
    setPurpose: setPurposeInput,
    setTopic: setTopicInput,
    topic: topicInput,
  };
}
