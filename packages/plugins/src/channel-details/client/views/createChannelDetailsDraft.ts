import { service } from "@slock/core/solid";
import type { ChannelDetails } from "@slock/types";
import { createEffect, createSignal } from "solid-js";
import {
  type EditableChannelDetails,
  editableChannelDetails,
  mergeChannelDetailsDraft,
} from "./fieldSave/channelDetailsDraft";

const channelDetails = service("channel-details");
const feedback = service("feedback");

function stripLeadingHash(name: string): string {
  return name.startsWith("#") ? name.slice(1) : name;
}

export function createChannelDetailsDraft(
  details: () => ChannelDetails | null | undefined,
  refetch: () => unknown,
) {
  const [topicInput, setTopicInput] = createSignal("");
  const [purposeInput, setPurposeInput] = createSignal("");
  const [nameInput, setNameInput] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  let seededDetails: EditableChannelDetails | undefined;
  createEffect(details, (d) => {
    if (!d) return;
    const merged = mergeChannelDetailsDraft(
      { name: nameInput(), purpose: purposeInput(), topic: topicInput() },
      seededDetails,
      d,
    );
    setTopicInput(merged.topic);
    setPurposeInput(merged.purpose);
    setNameInput(merged.name);
    seededDetails = editableChannelDetails(d);
  });

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
