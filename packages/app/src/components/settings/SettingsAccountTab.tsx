import { getWorkspaceDomain, logout } from "@slock/slack-api";
import { Avatar, Button } from "@slock/ui";
import { createResource, Show } from "solid-js";
import { store } from "../../lib/store";
import "./Settings.css";

export default function SettingsAccountTab() {
  const [domain] = createResource(getWorkspaceDomain);

  async function handleLogout() {
    if (!confirm("Log out? You'll need to paste a fresh request from devtools to reconnect.")) {
      return;
    }
    await logout();
    location.reload();
  }

  return (
    <>
      <h2>Account</h2>

      <Show when={store.users.currentUser()}>
        {(user) => (
          <div class="settings-row flex-between">
            <div class="settings-account-identity flex-align-center">
              <Avatar size="medium" user={user()} />
              <div>
                <div class="settings-row-label">{user().name}</div>
                <div class="settings-row-hint text-dim">{domain() ?? "…"}</div>
              </div>
            </div>
          </div>
        )}
      </Show>

      <div class="settings-section">
        <div class="settings-row-label">Log out</div>
        <div class="settings-row-hint text-dim">
          Disconnects this browser and server from Slack. You'll need to paste a fresh request from
          devtools to reconnect.
        </div>
        <Button onClick={handleLogout} variant="danger">
          Log out
        </Button>
      </div>
    </>
  );
}
