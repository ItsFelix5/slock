import { service } from "@slock/core/solid";
import type { ChannelDetails } from "@slock/types";
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

function stripLeadingHash(name: string): string {
  return name.startsWith("#") ? name.slice(1) : name;
}

export function createChannelDetailsDraft(
  details: () => ChannelDetails | null | undefined,
  refetch: () => unknown,
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
  const [saving, setSaving] = createSignal(false);

  const nameDirty = () => {
    const d = details();
    return !!d && stripLeadingHash(nameInput().trim()) !== d.name;
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
    if (!(id && d) || saving()) return;

    const nextName = stripLeadingHash(nameInput().trim());
    if (!nextName) {
      setNameInput(d.name);
      feedback.flash(id, "Channel name can't be empty.", "error");
      return;
    }
    const nextTopic = topicInput().trim();
    const nextPurpose = purposeInput().trim();

    setSaving(true);
    const [nameOk, topicOk, purposeOk] = await Promise.all([
      nextName === d.name ? true : channelDetails.renameChannelById(id, nextName),
      nextTopic === d.topic ? true : channelDetails.updateChannelTopic(id, nextTopic),
      nextPurpose === d.purpose ? true : channelDetails.updateChannelPurpose(id, nextPurpose),
    ]);
    await refetch();
    setSaving(false);

    if (!nameOk) setNameInput(d.name);
    if (!topicOk) setTopicInput(d.topic);
    if (!purposeOk) setPurposeInput(d.purpose);
    if (nameOk && topicOk && purposeOk) feedback.flash(id, "Channel updated.");
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
