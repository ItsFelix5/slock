import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { Overlay, Transaction } from "@slock/resource";
import type { ChannelId, ChannelSection } from "@slock/types";
import { createMemo, createSignal } from "solid-js";
import type { ChannelPlacement, ChannelPlacementOutcome } from "../api/sectionMutations";
import { toggleStar } from "../requests/channels";
import { updateSectionChannels } from "../requests/sections";

const feedback = service("feedback");

const PREVIOUS_SECTION_WARNING =
  "Starred, but couldn't remove the channel from its previous section.";

interface PlacementJob {
  channelId: ChannelId;
  failure: string;
  optimistic: (transaction: Transaction) => void;
  run: () => Promise<ChannelPlacementOutcome>;
}

export function createChannelStarPlacement(deps: {
  changeStructure: <T>(job: () => Promise<T>) => Promise<T | undefined>;
  holdChannelSection: (
    transaction: Transaction,
    channelId: ChannelId,
    sectionId: string | null,
  ) => void;
  overlayStarredIds: (change: (ids: ChannelId[]) => ChannelId[]) => Overlay;
  refreshSections: () => Promise<unknown>;
  sections: () => ChannelSection[] | undefined;
  starredIds: () => ChannelId[] | undefined;
}) {
  const starred = createMemo(() => new Set(deps.starredIds()));
  const isChannelStarred = (channelId: ChannelId) => starred().has(channelId);
  const [lastPlacedId, setLastPlacedId] = createSignal<ChannelId>();

  const overlayStar = (channelId: ChannelId, value: boolean) =>
    deps.overlayStarredIds((ids) => {
      if (ids.includes(channelId) === value) return ids;
      return value ? [...ids, channelId] : ids.filter((id) => id !== channelId);
    });
  const setChannelStarred = (channelId: ChannelId, value: boolean) =>
    overlayStar(channelId, value).commit();

  const placement = defineMutation<Omit<PlacementJob, "run"> & { run: () => Promise<void> }>({
    key: ({ channelId }) => channelId,
    mode: "single",
    onError: (error, { channelId, failure }) => {
      console.error(failure, error);
      feedback.flash(channelId, failure, "error");
    },
    optimistic: (job, transaction) => job.optimistic(transaction),
    run: (job) => job.run(),
  });
  const isChannelPlacementPending = (channelId: ChannelId) => placement.pending(channelId);

  async function runPlacement({ run, ...job }: PlacementJob): Promise<ChannelPlacementOutcome> {
    let outcome: ChannelPlacementOutcome = "failed";
    await placement.run({
      ...job,
      run: async () => {
        outcome = await run();
      },
    });
    return outcome;
  }

  const sectionOf = (channelId: ChannelId) =>
    (deps.sections() ?? []).find(
      (section) => section.type === "standard" && section.channelIds.includes(channelId),
    );

  async function leaveSection(channelId: ChannelId): Promise<ChannelPlacementOutcome> {
    const from = sectionOf(channelId);
    if (!from) return "applied";
    try {
      await updateSectionChannels(from.id, { removeChannelIds: [channelId] });
    } catch (error) {
      console.error("Failed to remove starred channel from its section", error);
      feedback.flash(channelId, PREVIOUS_SECTION_WARNING, "error");
      return "applied-with-warning";
    }
    await deps.refreshSections();
    return "applied";
  }

  async function toggleChannelStar(channelId: ChannelId): Promise<ChannelPlacementOutcome> {
    const wasStarred = isChannelStarred(channelId);
    const job = () =>
      runPlacement({
        channelId,
        failure: "Failed to update star.",
        optimistic: (transaction) => transaction.hold(overlayStar(channelId, !wasStarred)),
        run: async () => {
          await toggleStar(channelId, wasStarred);
          return wasStarred ? "applied" : leaveSection(channelId);
        },
      });
    if (wasStarred) return job();
    return (await deps.changeStructure(job)) ?? "failed";
  }

  async function transfer(channelId: ChannelId, from: string | undefined, to: string | null) {
    if (from) await updateSectionChannels(from, { removeChannelIds: [channelId] });
    if (!to) return;
    try {
      await updateSectionChannels(to, { insertChannelIds: [channelId] });
    } catch (error) {
      if (from)
        await updateSectionChannels(from, { insertChannelIds: [channelId] }).catch((restore) =>
          console.error("Failed to restore channel to its previous section", restore),
        );
      throw error;
    }
  }

  async function moveChannelToSection(
    channelId: ChannelId,
    to: string | null,
  ): Promise<ChannelPlacementOutcome> {
    const current = sectionOf(channelId);
    const from = current?.id === to ? undefined : current?.id;
    const unstar = !!to && isChannelStarred(channelId);
    let star: Overlay | undefined;
    const job = () =>
      runPlacement({
        channelId,
        failure: "Failed to move channel.",
        optimistic: (transaction) => {
          deps.holdChannelSection(transaction, channelId, to);
          if (!unstar) return;
          star = overlayStar(channelId, false);
          transaction.hold(star);
        },
        run: async () => {
          try {
            await transfer(channelId, from, to);
          } catch (error) {
            await deps.refreshSections();
            throw error;
          }
          let outcome: ChannelPlacementOutcome = "applied";
          if (unstar)
            await toggleStar(channelId, true).catch((error) => {
              console.error("Failed to unstar channel", error);
              feedback.flash(
                channelId,
                "Moved, but couldn't remove the channel from Starred.",
                "error",
              );
              star?.discard();
              outcome = "applied-with-warning";
            });
          await deps.refreshSections();
          return outcome;
        },
      });
    return (await deps.changeStructure(job)) ?? "failed";
  }

  const isChannelPlacedAt = (channelId: ChannelId, to: ChannelPlacement) => {
    if (to.kind === "stars") return isChannelStarred(channelId);
    if (isChannelStarred(channelId)) return false;
    const current = sectionOf(channelId);
    return to.kind === "home" ? !current : current?.id === to.id;
  };

  const isChannelJustPlaced = (channelId: ChannelId) =>
    isChannelPlacementPending(channelId) || lastPlacedId() === channelId;

  const placeChannel = (
    channelId: ChannelId,
    to: ChannelPlacement,
  ): Promise<ChannelPlacementOutcome> => {
    if (isChannelPlacedAt(channelId, to)) return Promise.resolve("applied");
    setLastPlacedId(channelId);
    if (to.kind === "section") return moveChannelToSection(channelId, to.id);
    if (to.kind === "home" && !isChannelStarred(channelId))
      return moveChannelToSection(channelId, null);
    return toggleChannelStar(channelId);
  };

  return {
    isChannelJustPlaced,
    isChannelPlacedAt,
    isChannelPlacementPending,
    isChannelStarred,
    placeChannel,
    setChannelStarred,
    toggleChannelStar,
  };
}
