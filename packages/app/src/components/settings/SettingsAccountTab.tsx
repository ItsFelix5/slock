import {
  forgetAccount,
  getActiveAccountId,
  getWorkspaceDomain,
  listStoredAccounts,
  rememberAccount,
  type StoredAccount,
  setActiveAccountId,
  submitAuthRequest,
} from "@slock/types";
import {
  Avatar,
  Button,
  DEFAULT_AVATAR_COLOR,
  debugMode,
  Icon,
  IconButton,
  Switch,
  setDebugMode,
} from "@slock/ui";
import { createResource, createSignal, For, Show } from "solid-js";
import { fetchAccountIdentity, reportChannelNamesToFlaron } from "../../lib/api";
import { confirmLogout, logoutAndReload } from "../../lib/session";
import { store } from "../../lib/store";
import ConnectAccountForm from "../setup/ConnectAccountForm";
import "./Settings.css";

export default function SettingsAccountTab() {
  const [domain, { refetch }] = createResource(getWorkspaceDomain);
  const [loggingOut, setLoggingOut] = createSignal(false);
  const [logoutError, setLogoutError] = createSignal<string>();

  const [accounts, setAccounts] = createSignal(listStoredAccounts());
  const activeId = getActiveAccountId();
  const otherAccounts = () => accounts().filter((a) => a.id !== activeId);

  const [switching, setSwitching] = createSignal<string>();
  const [switchError, setSwitchError] = createSignal<string>();
  const [showAdd, setShowAdd] = createSignal(false);

  const [reportingFlaron, setReportingFlaron] = createSignal(false);
  const [flaronReported, setFlaronReported] = createSignal(false);

  async function handleLogout() {
    if (!(await confirmLogout())) return;
    setLogoutError(undefined);
    setLoggingOut(true);
    try {
      await logoutAndReload();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Couldn't log out. Try again.");
      setLoggingOut(false);
    }
  }

  async function handleSwitch(account: StoredAccount) {
    setSwitchError(undefined);
    setSwitching(account.id);
    try {
      const result = await submitAuthRequest(account);
      if (!result.ok) throw new Error(result.error ?? "Couldn't switch accounts.");
      const identity = await fetchAccountIdentity().catch(() => null);
      const stored = identity ? rememberAccount({ ...account, ...identity }) : account;
      setActiveAccountId(stored.id);
      location.reload();
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Couldn't switch accounts.");
      setSwitching(undefined);
    }
  }

  function handleRemove(id: string) {
    forgetAccount(id);
    setAccounts(listStoredAccounts());
  }

  async function handleFlaronReport() {
    setReportingFlaron(true);
    try {
      const names = store.channels
        .channels()
        .filter((c) => c.private)
        .map((c) => c.name);
      await reportChannelNamesToFlaron(names);
      setFlaronReported(true);
    } finally {
      setReportingFlaron(false);
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
                  <Button onClick={() => refetch()} size="sm">
                    Retry workspace details
                  </Button>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>

      <div class="settings-section">
        <div class="settings-row-label">Other accounts</div>
        <Show
          fallback={<div class="settings-list-empty text-dim text-sm">None saved yet.</div>}
          when={otherAccounts().length > 0}
        >
          <div class="account-switcher-list flex-col">
            <For each={otherAccounts()}>
              {(account) => (
                <div class="settings-list-row flex-between">
                  <div class="settings-account-identity flex-align-center">
                    <Avatar
                      size="medium"
                      user={{
                        avatarColor: DEFAULT_AVATAR_COLOR,
                        avatarUrl: account.avatarUrl,
                        id: account.id,
                        name: account.name || account.domain,
                      }}
                    />
                    <div>
                      <div class="settings-row-label">{account.name || account.domain}</div>
                      <Show when={account.name}>
                        <div class="settings-row-meta text-dim">{account.domain}</div>
                      </Show>
                    </div>
                  </div>
                  <div class="account-switcher-actions flex-align-center">
                    <IconButton
                      disabled={!!switching()}
                      icon="arrow-right"
                      label={switching() === account.id ? "Switching…" : "Switch to this account"}
                      onClick={() => handleSwitch(account)}
                      size="sm"
                    />
                    <IconButton
                      disabled={!!switching()}
                      icon="trash"
                      label="Remove"
                      onClick={() => handleRemove(account.id)}
                      size="sm"
                      tone="dim"
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={switchError()}>
          {(message) => <div class="settings-account-error">{message()}</div>}
        </Show>

        <Show
          fallback={
            <button
              class="settings-quiet-btn btn-reset flex-align-center hover-hl"
              onClick={() => setShowAdd(true)}
              type="button"
            >
              <Icon name="user-add" size={14} />
              Add another account
            </button>
          }
          when={showAdd()}
        >
          <ConnectAccountForm onConnected={() => location.reload()} />
        </Show>
      </div>

      <div class="settings-section">
        <div class="settings-row flex-between">
          <div class="settings-row-label">Debug mode</div>
          <Switch checked={debugMode()} onChange={setDebugMode} />
        </div>
        <div class="settings-row flex-between">
          <div class="settings-row-label">Send private channels to Flaron</div>
          <IconButton
            disabled={reportingFlaron()}
            icon="cloud-upload"
            label={
              reportingFlaron()
                ? "Sending…"
                : flaronReported()
                  ? "Sent to Flaron"
                  : "Send private channel names to Flaron"
            }
            onClick={handleFlaronReport}
            size="sm"
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row">
          <Button disabled={loggingOut()} onClick={handleLogout} variant="danger">
            {loggingOut() ? "Logging out…" : "Log out"}
          </Button>
        </div>
        <Show when={logoutError()}>
          {(message) => <div class="settings-account-error">{message()}</div>}
        </Show>
      </div>
    </>
  );
}
