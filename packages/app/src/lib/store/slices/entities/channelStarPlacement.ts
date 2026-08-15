import type { ChannelSection } from "@slock/slack-api";
import { updateSectionChannels as apiUpdateSectionChannels, toggleStar } from "@slock/slack-api";
import { createStore } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { ChannelPlacementOutcome } from "./mutations/channelPlacementOutcome";

/** Starring a channel and moving it between sections both mutate the same "which section is a
 * channel in" state on the server, and both need the same pending/rollback shape - kept together
 * rather than duplicated. */
export function createChannelStarPlacement(deps: {
  refreshSections: () => Promise<ChannelSection[] | null | undefined>;
  sections: () => ChannelSection[] | undefined;
  sectionStructurePending: () => boolean;
  setSectionStructurePending: (pending: boolean) => void;
}) {
  const [starredChannelIds, setStarredChannelIds] = createStore<Record<string, boolean>>({});
  const [placementPendingByChannel, setPlacementPendingByChannel] = createStore<
    Record<string, boolean>
  >({});

  function isChannelStarred(channelId: string): boolean {
    return !!starredChannelIds[channelId];
  }

  function isChannelPlacementPending(channelId: string): boolean {
    return !!placementPendingByChannel[channelId];
  }

  async function toggleChannelStar(channelId: string): Promise<ChannelPlacementOutcome> {
    if (isChannelPlacementPending(channelId)) return "failed";
    const currentlyStarred = isChannelStarred(channelId);
    const changesSectionMembership = !currentlyStarred;
    if (changesSectionMembership && deps.sectionStructurePending()) return "failed";
    setPlacementPendingByChannel(channelId, true);
    if (changesSectionMembership) deps.setSectionStructurePending(true);
    setStarredChannelIds(channelId, !currentlyStarred);
    let starUpdated = false;
    try {
      await toggleStar(channelId, currentlyStarred);
      starUpdated = true;
      if (currentlyStarred) return "applied";

      const from = (deps.sections() ?? []).find(
        (section) => section.type === "standard" && section.channelIds.includes(channelId),
      );
      if (
        from &&
        !(await apiUpdateSectionChannels(from.id, {
          removeChannelIds: [channelId],
        }))
      ) {
        actionFeedback.flash(
          channelId,
          "Starred, but couldn't remove the channel from its previous section.",
          "error",
        );
        return "applied-with-warning";
      }
      if (from) await deps.refreshSections();
      return "applied";
    } catch (err) {
      if (starUpdated) {
        console.error("Failed to remove starred channel from its section", err);
        actionFeedback.flash(
          channelId,
          "Starred, but couldn't remove the channel from its previous section.",
          "error",
        );
      } else {
        console.error("Failed to toggle star", err);
        actionFeedback.flash(channelId, "Failed to update star.", "error");
        setStarredChannelIds(channelId, currentlyStarred);
        return "failed";
      }
      return "applied-with-warning";
    } finally {
      setPlacementPendingByChannel(channelId, false);
      if (changesSectionMembership) deps.setSectionStructurePending(false);
    }
  }

  async function moveChannelToSection(
    channelId: string,
    targetSectionId: string | null,
  ): Promise<ChannelPlacementOutcome> {
    if (isChannelPlacementPending(channelId) || deps.sectionStructurePending()) return "failed";
    setPlacementPendingByChannel(channelId, true);
    deps.setSectionStructurePending(true);
    const current = deps.sections() ?? [];
    const from = current.find(
      (s) => s.type === "standard" && s.channelIds.includes(channelId) && s.id !== targetSectionId,
    );
    let removedFromSource = false;
    let insertedIntoTarget = false;
    try {
      if (from) {
        const ok = await apiUpdateSectionChannels(from.id, {
          removeChannelIds: [channelId],
        });
        if (!ok) {
          actionFeedback.flash(channelId, "Failed to move channel.", "error");
          return "failed";
        }
        removedFromSource = true;
      }
      if (targetSectionId) {
        const ok = await apiUpdateSectionChannels(targetSectionId, {
          insertChannelIds: [channelId],
        });
        if (!ok) {
          if (from)
            await apiUpdateSectionChannels(from.id, {
              insertChannelIds: [channelId],
            });
          actionFeedback.flash(channelId, "Failed to move channel.", "error");
          await deps.refreshSections();
          return "failed";
        }
        insertedIntoTarget = true;

        if (isChannelStarred(channelId)) {
          setStarredChannelIds(channelId, false);
          try {
            await toggleStar(channelId, true);
          } catch (err) {
            console.error("Failed to unstar channel", err);
            setStarredChannelIds(channelId, true);
            actionFeedback.flash(
              channelId,
              "Moved, but couldn't remove the channel from Starred.",
              "error",
            );
            await deps.refreshSections();
            return "applied-with-warning";
          }
        }
      }
      await deps.refreshSections();
      return "applied";
    } catch (err) {
      console.error("Failed to move channel", err);
      if (removedFromSource && !insertedIntoTarget && from) {
        try {
          await apiUpdateSectionChannels(from.id, {
            insertChannelIds: [channelId],
          });
        } catch (rollbackError) {
          console.error("Failed to restore channel to its previous section", rollbackError);
        }
      }
      actionFeedback.flash(channelId, "Failed to move channel.", "error");
      await deps.refreshSections();
      return "failed";
    } finally {
      setPlacementPendingByChannel(channelId, false);
      deps.setSectionStructurePending(false);
    }
  }

  return {
    isChannelPlacementPending,
    isChannelStarred,
    moveChannelToSection,
    setStarredChannelIds,
    toggleChannelStar,
  };
}
