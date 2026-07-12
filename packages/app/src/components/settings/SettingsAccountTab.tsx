import { getWorkspaceDomain, logout } from "@slock/slack-api";
import { Avatar, Button } from "@slock/ui";
import { createResource, Show } from "solid-js";
import { currentUser } from "../../lib/store";
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

      <Show when={currentUser()}>
        {(user) => (
          <div class="settings-row">
            <div class="settings-account-identity">
              <Avatar user={user()} size="medium" />
              <div>
                <div class="settings-row-label">{user().name}</div>
                <div class="settings-row-hint">{domain() ?? "…"}</div>
              </div>
            </div>
          </div>
        )}
      </Show>

      <div class="settings-section">
        <div class="settings-row-label">Log out</div>
        <div class="settings-row-hint">
          Disconnects this browser and server from Slack. You'll need to paste a fresh request from
          devtools to reconnect.
        </div>
        <Button variant="danger" onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </>
  );
}
