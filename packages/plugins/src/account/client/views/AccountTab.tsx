import { Slot, usePoint } from "@slock/core/solid";
import { getActiveAccountId, listAccounts, removeAccount, switchAccount } from "@slock/slack";
import { Avatar, Button, DEFAULT_AVATAR_COLOR, Icon, IconButton } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import { confirmLogout, logoutAndRestart, restartApp } from "../session";
import ConnectAccountForm from "./ConnectAccountForm";

export default function AccountTab() {
  const sections = usePoint("account.section");
  const [loggingOut, setLoggingOut] = createSignal(false);
  const [logoutError, setLogoutError] = createSignal<string>();

  const [accounts, setAccounts] = createSignal(listAccounts());
  const activeId = getActiveAccountId();
  const currentAccount = () => accounts().find((a) => a.id === activeId);
  const otherAccounts = () => accounts().filter((a) => a.id !== activeId);

  const [switching, setSwitching] = createSignal<string>();
  const [switchError, setSwitchError] = createSignal<string>();
  const [showAdd, setShowAdd] = createSignal(false);

  async function handleLogout() {
    if (!(await confirmLogout())) return;
    setLogoutError(undefined);
    setLoggingOut(true);
    try {
      await logoutAndRestart();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Couldn't log out. Try again.");
      setLoggingOut(false);
    }
  }

  async function handleSwitch(id: string) {
    setSwitchError(undefined);
    setSwitching(id);
    try {
      switchAccount(id);
      await restartApp();
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Couldn't switch accounts.");
      setSwitching(undefined);
    }
  }

  async function handleRemove(id: string) {
    setSwitchError(undefined);
    try {
      await removeAccount(id);
      setAccounts(listAccounts());
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "Couldn't remove the account.");
    }
  }

  return (
    <>
      <h2>Account</h2>

      <Show when={currentAccount()}>
        {(account) => (
          <div class="settings-row flex-between">
            <div class="settings-account-identity flex-align-center">
              <Avatar
                size="medium"
                user={{
                  avatarColor: DEFAULT_AVATAR_COLOR,
                  avatarUrl: `/api/accounts/${account().id}/avatar`,
                  id: account().id,
                  name: account().name || account().domain,
                }}
              />
              <div>
                <div class="settings-row-label">{account().name || account().domain}</div>
                <div class="settings-row-meta text-dim">{account().domain}</div>
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
                        avatarUrl: `/api/accounts/${account.id}/avatar`,
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
                      onClick={() => handleSwitch(account.id)}
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
          <ConnectAccountForm onConnected={() => void restartApp()} />
        </Show>
      </div>

      <Show when={sections().length > 0}>
        <div class="settings-section">
          <Slot point="account.section" />
        </div>
      </Show>

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
