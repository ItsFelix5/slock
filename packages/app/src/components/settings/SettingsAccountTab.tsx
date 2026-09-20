import {
  forgetAccount,
  getActiveAccountId,
  getWorkspaceDomain,
  listStoredAccounts,
  logout,
  rememberAccount,
  type StoredAccount,
  setActiveAccountId,
  submitAuthRequest,
} from "@slock/types";
import {
  Avatar,
  Button,
  confirmDialog,
  DEFAULT_AVATAR_COLOR,
  debugMode,
  Icon,
  IconButton,
  Switch,
  setDebugMode,
} from "@slock/ui";
import { createResource, createSignal, For, Show } from "solid-js";
import { fetchAccountIdentity, reportChannelNamesToFlaron } from "../../lib/api";
import { parseSlackCurl } from "../../lib/parseSlackCurl";
import { store } from "../../lib/store";
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
  const [addError, setAddError] = createSignal<string | null>(null);

  const [reportingFlaron, setReportingFlaron] = createSignal(false);
  const [flaronReported, setFlaronReported] = createSignal(false);

  async function handleLogout() {
    const confirmed = await confirmDialog({
      confirmLabel: "Log out",
      danger: true,
      message: "Log out? You'll need to paste a fresh request from devtools to reconnect.",
    });
    if (!confirmed) return;
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

  async function handleAdd(raw: string) {
    try {
      const creds = parseSlackCurl(raw);
      const result = await submitAuthRequest(creds);
      if (!result.ok) throw new Error(result.error ?? "Couldn't connect.");
      const identity = await fetchAccountIdentity().catch(() => ({ name: creds.domain }));
      setActiveAccountId(rememberAccount({ ...creds, ...identity }).id);
      location.reload();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    }
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
          <div class="account-switcher-list">
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
              class="settings-quiet-btn btn-reset flex-align-center"
              onClick={() => setShowAdd(true)}
              type="button"
            >
              <Icon name="user-add" size={14} />
              Add another account
            </button>
          }
          when={showAdd()}
        >
          <textarea
            aria-describedby="settings-add-account-error"
            autocomplete="off"
            class="settings-status-input settings-account-add-input"
            onInput={(event) => {
              setAddError(null);
              handleAdd(event.currentTarget.value);
            }}
            placeholder="Paste a 'Copy as cURL' request from another account's devtools"
            rows={4}
            spellcheck={false}
          />
          <p class="settings-account-error" id="settings-add-account-error">
            {addError()}
          </p>
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
