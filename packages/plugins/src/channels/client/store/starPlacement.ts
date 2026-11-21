import { createOptimisticFlags, service } from "@slock/core/solid";
import {
  updateSectionChannels as apiUpdateSectionChannels,
  toggleStar,
} from "@slock/plugins/slack/client/api";
import type { ChannelId, ChannelSection } from "@slock/types";
import { action } from "solid-js";

const feedback = service("feedback");

const PREVIOUS_SECTION_WARNING =
  "Starred, but couldn't remove the channel from its previous section.";

export function createChannelStarPlacement(deps: {
  refreshSections: () => Promise<ChannelSection[] | null | undefined>;
  sections: () => ChannelSection[] | undefined;
  sectionStructurePending: () => boolean;
  holdSectionStructure: () => void;
}) {
  const starred = createOptimisticFlags<ChannelId>();
  const placement = createOptimisticFlags<ChannelId>();

  const toggleChannelStar = action(function* (channelId: ChannelId) {
    if (placement.has(channelId)) return "failed";
    const currentlyStarred = starred.has(channelId);
    const changesSectionMembership = !currentlyStarred;
    if (changesSectionMembership && deps.sectionStructurePending()) return "failed";
    placement.hold(channelId, true);
    if (changesSectionMembership) deps.holdSectionStructure();
    starred.hold(channelId, !currentlyStarred);
    try {
      yield toggleStar(channelId, currentlyStarred);
    } catch (err) {
      console.error("Failed to toggle star", err);
      feedback.flash(channelId, "Failed to update star.", "error");
      return "failed";
    }
    starred.set(channelId, !currentlyStarred);
    if (currentlyStarred) return "applied";
    try {
      const from = (deps.sections() ?? []).find(
        (section) => section.type === "standard" && section.channelIds.includes(channelId),
      );
      if (from) {
        const removed: boolean = yield apiUpdateSectionChannels(from.id, {
          removeChannelIds: [channelId],
        });
        if (!removed) {
          feedback.flash(channelId, PREVIOUS_SECTION_WARNING, "error");
          return "applied-with-warning";
        }
        yield deps.refreshSections();
      }
    } catch (err) {
      console.error("Failed to remove starred channel from its section", err);
      feedback.flash(channelId, PREVIOUS_SECTION_WARNING, "error");
      return "applied-with-warning";
    }
    return "applied";
  });

  const moveChannelToSection = action(function* (
    channelId: ChannelId,
    targetSectionId: string | null,
  ) {
    if (placement.has(channelId) || deps.sectionStructurePending()) return "failed";
    placement.hold(channelId, true);
    deps.holdSectionStructure();
    const from = (deps.sections() ?? []).find(
      (s) => s.type === "standard" && s.channelIds.includes(channelId) && s.id !== targetSectionId,
    );
    let removedFromSource = false;
    let insertedIntoTarget = false;
    try {
      if (from) {
        const removed: boolean = yield apiUpdateSectionChannels(from.id, {
          removeChannelIds: [channelId],
        });
        if (!removed) {
          feedback.flash(channelId, "Failed to move channel.", "error");
          return "failed";
        }
        removedFromSource = true;
      }
      if (targetSectionId) {
        const inserted: boolean = yield apiUpdateSectionChannels(targetSectionId, {
          insertChannelIds: [channelId],
        });
        if (!inserted) {
          if (from) yield apiUpdateSectionChannels(from.id, { insertChannelIds: [channelId] });
          feedback.flash(channelId, "Failed to move channel.", "error");
          yield deps.refreshSections();
          return "failed";
        }
        insertedIntoTarget = true;

        if (starred.has(channelId)) {
          starred.hold(channelId, false);
          try {
            yield toggleStar(channelId, true);
          } catch (err) {
            console.error("Failed to unstar channel", err);
            feedback.flash(
              channelId,
              "Moved, but couldn't remove the channel from Starred.",
              "error",
            );
            yield deps.refreshSections();
            return "applied-with-warning";
          }
          starred.set(channelId, false);
        }
      }
      yield deps.refreshSections();
      return "applied";
    } catch (err) {
      console.error("Failed to move channel", err);
      if (removedFromSource && !insertedIntoTarget && from) {
        try {
          yield apiUpdateSectionChannels(from.id, { insertChannelIds: [channelId] });
        } catch (rollbackError) {
          console.error("Failed to restore channel to its previous section", rollbackError);
        }
      }
      feedback.flash(channelId, "Failed to move channel.", "error");
      yield deps.refreshSections();
      return "failed";
    }
  });

  return {
    isChannelPlacementPending: placement.has,
    isChannelStarred: starred.has,
    moveChannelToSection,
    setStarredChannelIds: starred.set,
    toggleChannelStar,
  };
}
