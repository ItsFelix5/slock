import { imageSrc } from "@slock/ui";
import { Errored, For, Loading, Show } from "solid-js";
import type { ProfileMetaProps } from "../../profile/client/api";
import { installedApps } from "./fetch";
import "./InstalledApps.css";

export default function UserInstalledApps(props: ProfileMetaProps) {
  const installed = installedApps.use(() => (props.user.isBot ? undefined : props.user.id));
  return (
    <Errored fallback={null}>
      <Loading>
        <Show when={installed()?.length}>
          <div class="user-profile-section">
            <h3 class="user-profile-section-title">Installed apps ({installed()?.length})</h3>
            <ul class="installed-apps flex-col">
              <For each={installed()}>
                {(app) => (
                  <li class="installed-app flex-align-center">
                    <Show
                      fallback={<span class="installed-app-icon installed-app-icon-empty" />}
                      when={app.icon}
                    >
                      <img alt="" class="installed-app-icon" src={imageSrc(app.icon)} />
                    </Show>
                    <span class="truncate">{app.name}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </Show>
      </Loading>
    </Errored>
  );
}
