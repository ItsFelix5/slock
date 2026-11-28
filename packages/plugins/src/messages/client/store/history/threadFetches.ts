import type { fetchRepliesFrom, ReplyPage } from "@slock/plugins/slack/client/api";
import { compareTs } from "@slock/slack";
import type { ChannelId, Message, Ts } from "@slock/types";
import { dropVanished, mergeMessages } from "../../api/messageMerge";
import type { fetchReplies, fetchRepliesBefore } from "../../requests/replies";
import type { createRequestEpochs } from "./requestEpoch";
import { idle, type ThreadPaging } from "./threadPaging";

export type ThreadApi = {
  fetchReplies: typeof fetchReplies;
  fetchRepliesBefore: typeof fetchRepliesBefore;
  fetchRepliesFrom: typeof fetchRepliesFrom;
};

export function createThreadFetches(deps: {
  api: ThreadApi;
  paging: Record<Ts, ThreadPaging>;
  patchPaging: (ts: Ts, patch: Partial<ThreadPaging>) => void;
  runs: ReturnType<typeof createRequestEpochs<Ts>>;
  threadMessages: Record<Ts, Message[]>;
}) {
  const { api, paging, patchPaging, runs, threadMessages } = deps;

  function settleFirstPage(ts: Ts, run: number, page: ReplyPage): Message[] {
    const current = threadMessages[ts] ?? [];
    if (!runs.isCurrent(ts, run)) return current;
    patchPaging(ts, {
      ...idle,
      after: page.edge,
      before: undefined,
      hasEarlier: false,
      hasMore: page.hasMore,
    });
    return mergeMessages(current, page.messages);
  }

  async function loadAnchored(channelId: ChannelId, ts: Ts, anchor: Ts): Promise<Message[]> {
    const run = runs.begin(ts);
    const first = await api.fetchRepliesFrom(channelId, ts, ts);
    const anchorInFirstPage =
      !first.hasMore || (!!first.edge && compareTs(anchor, first.edge) <= 0);
    if (anchorInFirstPage) return settleFirstPage(ts, run, first);
    const root = first.messages.find((m) => m.ts === ts);
    const [forward, earlier] = await Promise.all([
      api.fetchRepliesFrom(channelId, ts, anchor),
      api.fetchRepliesBefore(channelId, ts, anchor),
    ]);
    const current = threadMessages[ts] ?? [];
    if (!runs.isCurrent(ts, run)) return current;
    const live = forward.hasMore
      ? []
      : current.filter((m) => Number(m.ts) > Number(forward.edge ?? anchor));
    patchPaging(ts, {
      ...idle,
      after: forward.edge,
      before: earlier.before,
      hasEarlier: earlier.hasEarlier,
      hasMore: forward.hasMore,
      span: earlier.span,
    });
    return mergeMessages(live, [...(root ? [root] : []), ...earlier.messages, ...forward.messages]);
  }

  async function loadFirst(channelId: ChannelId, ts: Ts) {
    const run = runs.begin(ts);
    return settleFirstPage(ts, run, await api.fetchRepliesFrom(channelId, ts, ts));
  }

  async function reloadWindow(channelId: ChannelId, ts: Ts, state: ThreadPaging) {
    const run = runs.current(ts);
    const known = [...(threadMessages[ts] ?? [])];
    const from = (state.hasEarlier && state.before) || ts;
    const upTo = known.at(-1)?.ts ?? from;
    const root =
      from === ts
        ? []
        : (await api.fetchRepliesFrom(channelId, ts, ts)).messages.filter((m) => m.ts === ts);
    let page = await api.fetchRepliesFrom(channelId, ts, from);
    const fetched = [...root, ...page.messages];
    while (page.hasMore && page.edge && compareTs(page.edge, upTo) < 0) {
      page = await api.fetchReplies(channelId, ts, page.edge);
      fetched.push(...page.messages);
    }
    const current = threadMessages[ts] ?? [];
    if (!runs.isCurrent(ts, run)) return current;
    const cursor = paging[ts]?.after;
    if (!(cursor && page.edge && compareTs(page.edge, cursor) < 0))
      patchPaging(ts, { after: page.edge ?? cursor, error: false, hasMore: page.hasMore });
    const covers = (reply: Ts) => compareTs(reply, from) >= 0;
    return mergeMessages(dropVanished(current, known, fetched, covers), fetched);
  }

  return { loadAnchored, loadFirst, reloadWindow };
}
