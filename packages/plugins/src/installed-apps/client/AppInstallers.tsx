import { Mrkdwn } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { Avatar } from "@slock/ui";
import { For, Show } from "solid-js";
import type { ProfileMetaProps } from "../../profile/client/api";
import { createKeyedQuery, defineKey } from "../../query/client/api";
import { fetchAppInstallers } from "./fetch";
import "./InstalledApps.css";

const appInstallersKey = defineKey<[string]>("appInstallers");

const users = service("users");

export default function AppInstallers(props: ProfileMetaProps) {
  const installers = createKeyedQuery(() => {
    const { appId, isBot } = props.user;
    if (!(isBot && appId)) return;
    return { queryFn: () => fetchAppInstallers(appId), queryKey: appInstallersKey(appId) };
  });
  return (
    <Show when={installers.data}>
      {(data) => (
        <>
          <Show when={data().userIds.length}>
            <div class="user-profile-section">
              <h3 class="user-profile-section-title">Installed by ({data().userIds.length})</h3>
              <div class="user-profile-field-users flex-col">
                <For each={data().userIds}>
                  {(id) => (
                    <button
                      class="user-profile-field-user btn-reset flex-align-center"
                      onClick={() => users.openUserProfile(id)}
                      type="button"
                    >
                      <Show fallback={id} when={users.userById(id)}>
                        {(user) => (
                          <>
                            <Avatar size="small" user={user()} />
                            <span class="truncate">{user().name}</span>
                          </>
                        )}
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
          <Show when={data().channelIds.length || data().hiddenChannels}>
            <div class="user-profile-section">
              <h3 class="user-profile-section-title">
                In {data().channelIds.length} channels
                <Show when={data().hiddenChannels}>
                  {" "}
                  <span class="text-muted">(+{data().hiddenChannels} you can't see)</span>
                </Show>
              </h3>
              <Mrkdwn
                text={data()
                  .channelIds.map((id) => `<#${id}>`)
                  .join("  ")}
              />
            </div>
          </Show>
        </>
      )}
    </Show>
  );
}
