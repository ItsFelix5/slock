import { Mrkdwn } from "@slock/blockkit";
import { Icon, IconButton, InlineFeedback, Menu, Tooltip } from "@slock/ui";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { openChannelDetails } from "../../lib/channelDetails";
import { usePaneView } from "../../lib/paneView";
import { actionFeedback } from "../../lib/store";
import ChannelActionsMenuItems from "./ChannelActionsMenuItems";
import "./ChannelHeader.css";
import ChannelMoveMenu from "./ChannelMoveMenu";
import { createChannelHeaderState } from "./channelHeaderState";

export default function ChannelHeader() {
  const { view } = usePaneView();
  const {
    channelMemberCount,
    channelTitle,
    channelTopic,
    filesLinksOpen,
    isArchivedChannel,
    isChannelView,
    isPrivateChannel,
    openCurrentDmProfile,
    searchCurrentConversation,
  } = createChannelHeaderState(view);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [topicEl, setTopicEl] = createSignal<HTMLSpanElement>();
  const [topicOverflowing, setTopicOverflowing] = createSignal(false);
  createEffect(() => {
    channelTopic();
    const el = topicEl();
    if (el) setTopicOverflowing(el.scrollWidth > el.clientWidth);
  });
  createEffect(() => {
    const el = topicEl();
    if (!el) return;
    const measure = () => setTopicOverflowing(el.scrollWidth > el.clientWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });
  return (
    <div class="channel-header">
      <div class="channel-header-top flex-align-center">
        <div class="channel-header-context flex-align-center">
          <div class="channel-header-identity flex-align-center">
            <Show when={isChannelView() && view()?.id}>
              {(id) => <ChannelMoveMenu channelId={id()} channelTitle={channelTitle()} />}
            </Show>
            <span class="channel-header-icon">
              <Show fallback={null} when={view()?.kind !== "dm"}>
                {isPrivateChannel() ? <Icon name="lock" size={14} /> : "#"}
              </Show>
            </span>
            <button
              class="channel-header-title channel-header-title-btn btn-reset"
              onClick={() => {
                const v = view();
                if (!v) return;
                if (v.kind === "channel") openChannelDetails(v.id);
                else openCurrentDmProfile();
              }}
              type="button"
            >
              {channelTitle()}
            </button>
            <Show when={isChannelView() && channelMemberCount()}>
              {(count) => (
                <Tooltip content="View members">
                  <button
                    class="channel-header-members-btn btn-reset flex-align-center"
                    onClick={() => {
                      const v = view();
                      if (v?.kind === "channel") openChannelDetails(v.id, "members");
                    }}
                    type="button"
                  >
                    <Icon name="user-groups" size={14} />
                    <span>{count()}</span>
                  </button>
                </Tooltip>
              )}
            </Show>
            <Show when={isArchivedChannel()}>
              <span class="channel-header-archived-badge">Archived</span>
            </Show>
          </div>
          <Show when={channelTopic()}>
            <span
              class="channel-header-topic-wrap"
              classList={{ "is-overflowing": topicOverflowing() }}
            >
              <span class="channel-header-topic truncate text-dim text-sm" ref={setTopicEl}>
                <Mrkdwn text={channelTopic()} />
              </span>
            </span>
          </Show>
          <Show when={view()?.id}>
            {(id) => (
              <InlineFeedback class="channel-header-feedback" feedback={actionFeedback.get(id())} />
            )}
          </Show>
        </div>
        <div class="channel-header-actions">
          <IconButton
            active={filesLinksOpen()}
            class="channel-header-btn"
            icon="search"
            label="Files & links"
            onClick={searchCurrentConversation}
            size="md"
          />
          <Show when={view()}>
            {(v) => (
              <Menu
                align="end"
                class="channel-header-more-wrap"
                onClose={() => setMoreOpen(false)}
                open={moreOpen()}
                panelClass="menu-panel channel-header-menu"
                trigger={
                  <IconButton
                    class="channel-header-btn"
                    icon="ellipsis-vertical-filled"
                    label="More"
                    onClick={() => setMoreOpen(!moreOpen())}
                    size="md"
                  />
                }
              >
                <ChannelActionsMenuItems
                  channelId={v().id}
                  channelTitle={channelTitle()}
                  isDm={v().kind === "dm"}
                  onClose={() => setMoreOpen(false)}
                />
              </Menu>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}
