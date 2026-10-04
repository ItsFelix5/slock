import type { ActivityItem } from "@slock/types";
import { Avatar, AvatarStack, DEFAULT_AVATAR_COLOR, Icon, Tooltip } from "@slock/ui";
import { Show } from "solid-js";
import { store } from "../../../lib/store";
import type { ActivityRowDisplay } from "./activityRowDisplay";
import { ACTIVITY_KIND_ICONS } from "./activityViewFilters";

export default function ActivityAvatar(props: {
  display: ActivityRowDisplay;
  grouped: boolean;
  latest: ActivityItem;
}) {
  return (
    <span class="activity-item-avatar">
      <Show
        fallback={
          <Show
            fallback={
              <span class="activity-item-avatar-icon flex-center">
                <Icon
                  name={
                    props.latest.activityType === "saved_reminder"
                      ? "reminder"
                      : ACTIVITY_KIND_ICONS[props.latest.kind]
                  }
                  size={12}
                />
              </span>
            }
            when={props.display.hasAnyActor()}
          >
            <Avatar
              size="small"
              user={{
                avatarColor: props.display.user()?.avatarColor ?? DEFAULT_AVATAR_COLOR,
                avatarUrl: props.display.avatarUrl(),
                id: props.latest.userId,
                name: props.display.displayName(),
                presence: props.display.user()?.presence,
              }}
            />
          </Show>
        }
        when={props.grouped}
      >
        <Tooltip content={props.display.interactorNames(props.display.replierIds())}>
          <AvatarStack
            max={3}
            users={props.display
              .replierIds()
              .map((id) => store.users.userById(id))
              .filter((person) => person !== undefined)}
          />
        </Tooltip>
      </Show>
    </span>
  );
}
