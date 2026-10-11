import { service } from "@slock/core/solid";
import { createConcurrencyQueue } from "@slock/ui";
import { createSignal } from "solid-js";
import {
  setUsergroupChannels,
  setUsergroupMembers,
  setUsergroupSectionEnabled,
  updateUsergroupProfile,
} from "../../slack/client/api";

const feedback = service("feedback");

const panesStore = service("shell.panes");
const channelsStore = service("channels");

const usergroups = service("usergroups");

export function createUsergroupDetails() {
  const [usergroupDetailsLoading, setUsergroupDetailsLoading] = createSignal(false);
  const [usergroupDetailsLoadError, setUsergroupDetailsLoadError] = createSignal(false);
  const [usergroupMutationPending, setUsergroupMutationPending] = createSignal(false);
  let loadEpoch = 0;
  let pendingMutationCount = 0;
  const runMutation = createConcurrencyQueue(1).run;

  async function loadUsergroupDetails(id: string): Promise<boolean> {
    const epoch = ++loadEpoch;
    setUsergroupDetailsLoading(true);
    setUsergroupDetailsLoadError(false);
    try {
      const details = await usergroups.refreshUsergroupDetails(id);
      if (!details) throw new Error("Pinggroup details are unavailable.");
      return true;
    } catch (err) {
      if (epoch !== loadEpoch) return false;
      setUsergroupDetailsLoadError(true);
      feedback.caught(id, err, "Failed to load pinggroup details.");
      return false;
    } finally {
      if (epoch === loadEpoch) setUsergroupDetailsLoading(false);
    }
  }

  function openUsergroupDetails(id: string) {
    panesStore.openInNewPane({ kind: "usergroup-details", usergroupId: id });
  }

  function closeUsergroupDetails() {
    loadEpoch++;
    setUsergroupDetailsLoading(false);
    setUsergroupDetailsLoadError(false);
    const pane = panesStore.panes().find((p) => p.content?.kind === "usergroup-details");
    if (pane) panesStore.closePane(pane.id);
  }

  function withFeedback(
    id: string,
    fallbackMessage: string,
    action: () => Promise<void>,
  ): Promise<boolean> {
    pendingMutationCount++;
    setUsergroupMutationPending(true);
    return runMutation(async () => {
      try {
        await action();
        const details = await usergroups.refreshUsergroupDetails(id);
        if (!details) throw new Error("Pinggroup details are unavailable.");
        return true;
      } catch (err) {
        feedback.caught(id, err, fallbackMessage);
        return false;
      } finally {
        pendingMutationCount--;
        setUsergroupMutationPending(pendingMutationCount > 0);
      }
    });
  }

  function saveUsergroupProfile(
    id: string,
    patch: { name?: string; handle?: string; description?: string },
  ): Promise<boolean> {
    return withFeedback(id, "Failed to update pinggroup.", () => updateUsergroupProfile(id, patch));
  }

  function addUsergroupMembers(id: string, userIds: string[]): Promise<boolean> {
    return withFeedback(id, "Failed to add members.", () => {
      const current = usergroups.usergroupDetailsById(id)?.memberIds ?? [];
      return setUsergroupMembers(id, [...new Set([...current, ...userIds])]);
    });
  }

  function removeUsergroupMember(id: string, userId: string): Promise<boolean> {
    return withFeedback(id, "Failed to remove member.", () => {
      const current = usergroups.usergroupDetailsById(id)?.memberIds ?? [];
      return setUsergroupMembers(
        id,
        current.filter((memberId) => memberId !== userId),
      );
    });
  }

  function addUsergroupChannels(id: string, channelIds: string[]): Promise<boolean> {
    return withFeedback(id, "Failed to add channels.", () => {
      const current = usergroups.usergroupDetailsById(id)?.channelIds ?? [];
      return setUsergroupChannels(id, [...new Set([...current, ...channelIds])]);
    });
  }

  function removeUsergroupChannel(id: string, channelId: string): Promise<boolean> {
    return withFeedback(id, "Failed to remove channel.", () => {
      const current = usergroups.usergroupDetailsById(id)?.channelIds ?? [];
      return setUsergroupChannels(
        id,
        current.filter((cid) => cid !== channelId),
      );
    });
  }

  function setUsergroupChannelSectionEnabled(id: string, enabled: boolean): Promise<boolean> {
    return withFeedback(
      id,
      enabled ? "Failed to create the group section." : "Failed to remove the group section.",
      () => setUsergroupSectionEnabled(id, enabled),
    ).then(async (updated) => {
      if (updated) await channelsStore.retrySections();
      return updated;
    });
  }

  return {
    addUsergroupChannels,
    addUsergroupMembers,
    closeUsergroupDetails,
    loadUsergroupDetails,
    openUsergroupDetails,
    removeUsergroupChannel,
    removeUsergroupMember,
    saveUsergroupProfile,
    setUsergroupChannelSectionEnabled,
    usergroupDetailsLoadError,
    usergroupDetailsLoading,
    usergroupMutationPending,
  };
}
