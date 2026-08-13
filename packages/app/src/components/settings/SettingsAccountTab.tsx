import { getWorkspaceDomain, logout } from "@slock/slack-api";
import { Avatar, Button } from "@slock/ui";
import { createResource, createSignal, Show } from "solid-js";
import { store } from "../../lib/store";
import "./Settings.css";

export default function SettingsAccountTab() {
  const [domain, { refetch }] = createResource(getWorkspaceDomain);
  const [loggingOut, setLoggingOut] = createSignal(false);
  const [logoutError, setLogoutError] = createSignal<string>();

  async function handleLogout() {
    if (!confirm("Log out? You'll need to paste a fresh request from devtools to reconnect.")) {
      return;
    }
    setLogoutError(undefined);
    setLoggingOut(true);
    try {
      await logout();
      location.reload();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Couldn't log out. Try again.");
      setLoggingOut(false);
    }
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
                <div class="settings-row-meta text-dim">
                  {domain.loading
                    ? "Loading workspace…"
                    : domain.error
                      ? "Workspace unavailable"
                      : (domain() ?? "Unknown workspace")}
                </div>
                <Show when={domain.error}>
                  <Button onClick={() => refetch()} size="sm" variant="ghost">
                    Retry workspace details
                  </Button>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>

      <div class="settings-section">
        <div class="settings-row-label">Log out</div>
        <Button disabled={loggingOut()} onClick={handleLogout} variant="danger">
          {loggingOut() ? "Logging out…" : "Log out"}
        </Button>
        <Show when={logoutError()}>
          {(message) => <div class="settings-account-error">{message()}</div>}
        </Show>
      </div>
    </>
  );
}
