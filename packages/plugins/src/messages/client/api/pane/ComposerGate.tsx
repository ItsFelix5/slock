import { service } from "@slock/core/solid";
import type { ChannelId } from "@slock/types";
import type { JSX } from "@solidjs/web";
import { Match, Switch } from "solid-js";
import ChannelNoticeBar, { type NoticeAction } from "./ChannelNoticeBar";

const channelsStore = service("channels");
const channelDetails = service("channel-details");
const dmsStore = service("dms");

export interface ComposerNotice {
  action?: NoticeAction;
  subject: string;
  text: string;
}

export default function ComposerGate(props: {
  channelId: ChannelId;
  children: JSX.Element;
  locked?: boolean;
  notice?: ComposerNotice;
}) {
  const unarchiving = () => channelDetails.isArchivePending(props.channelId);
  const archived = () => !!channelsStore.channelById(props.channelId)?.archived;
  const isMember = () =>
    !!dmsStore.dmById(props.channelId) || channelsStore.isChannelMember(props.channelId);
  const joining = () => channelsStore.isJoinPending(props.channelId);

  return (
    <Switch>
      <Match when={props.locked}>
        <ChannelNoticeBar channelId={props.channelId} subject="This thread">
          is locked.
        </ChannelNoticeBar>
      </Match>
      <Match when={props.notice}>
        {(notice) => (
          <ChannelNoticeBar
            action={notice().action}
            channelId={props.channelId}
            subject={notice().subject}
          >
            {notice().text}
          </ChannelNoticeBar>
        )}
      </Match>
      <Match when={archived()}>
        <ChannelNoticeBar
          action={
            isMember()
              ? {
                  disabled: unarchiving(),
                  icon: "archive",
                  label: unarchiving() ? "Unarchiving…" : "Unarchive",
                  onClick: () => channelDetails.unarchiveChannelById(props.channelId),
                }
              : undefined
          }
          channelId={props.channelId}
        >
          is archived.
        </ChannelNoticeBar>
      </Match>
      <Match when={!isMember()}>
        <ChannelNoticeBar
          action={{
            disabled: joining(),
            icon: "plus",
            label: joining() ? "Joining…" : "Join channel",
            onClick: () => channelsStore.joinChannelById(props.channelId),
          }}
          channelId={props.channelId}
        >
          isn't joined.
        </ChannelNoticeBar>
      </Match>
      <Match when>{props.children}</Match>
    </Switch>
  );
}
