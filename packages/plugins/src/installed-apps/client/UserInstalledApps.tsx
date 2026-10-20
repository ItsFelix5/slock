import { For, Show } from "solid-js";
import type { ProfileMetaProps } from "../../profile/client/api";
import { createKeyedQuery, defineKey } from "../../query/client/api";
import { fetchInstalledApps } from "./fetch";
import "./InstalledApps.css";

const installedAppsKey = defineKey<[string]>("installedApps");

export default function UserInstalledApps(props: ProfileMetaProps) {
  const installed = createKeyedQuery(() => {
    const { id, isBot } = props.user;
    if (isBot) return;
    return { queryFn: () => fetchInstalledApps(id), queryKey: installedAppsKey(id) };
  });
  return (
    <Show when={installed.data?.length}>
      <div class="user-profile-section">
        <h3 class="user-profile-section-title">Installed apps ({installed.data?.length})</h3>
        <ul class="installed-apps flex-col">
          <For each={installed.data}>
            {(app) => (
              <li class="installed-app flex-align-center">
                <Show
                  fallback={<span class="installed-app-icon installed-app-icon-empty" />}
                  when={app.icon}
                >
                  <img alt="" class="installed-app-icon" src={app.icon} />
                </Show>
                <span class="truncate">{app.name}</span>
              </li>
            )}
          </For>
        </ul>
      </div>
    </Show>
  );
}
