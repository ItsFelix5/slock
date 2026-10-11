import type { Setup } from "@slock/core";
import { isConfigured, REAUTH_EVENT } from "@slock/slack";
import { Button } from "@slock/ui";
import { createSignal, lazy } from "solid-js";
import { confirmLogout, logoutAndRestart, restartApp } from "./session";
import "./views/ConnectScreen.css";

const ConnectAccountForm = lazy(() => import("./views/ConnectAccountForm"));
const AccountTab = lazy(() => import("./views/AccountTab"));

function ConnectScreen() {
  document.title = "Connect to Slack";
  return (
    <div class="connect-slack flex-center">
      <div class="connect-slack-card flex-col">
        <h1>Connect to Slack</h1>
        <ConnectAccountForm onConnected={() => void restartApp()} />
      </div>
    </div>
  );
}

async function logout(): Promise<boolean> {
  if (!(await confirmLogout())) return false;
  await logoutAndRestart();
  return true;
}

function LogoutButton() {
  const [busy, setBusy] = createSignal(false);
  return (
    <Button
      disabled={busy()}
      onClick={async () => {
        setBusy(true);
        if (!(await logout())) setBusy(false);
      }}
      variant="secondary"
    >
      {busy() ? "Logging out…" : "Log out"}
    </Button>
  );
}

const setup: Setup = (ctx) => {
  ctx.provide("account", { logout, restart: restartApp });
  ctx.add("shell.blocker", { active: () => !isConfigured(), view: ConnectScreen });
  ctx.add("settings.tab", { id: "account", label: "Account", view: AccountTab }, { order: 0 });
  ctx.add("bootstrap.error.action", LogoutButton);

  const onReauth = () => void restartApp();
  window.addEventListener(REAUTH_EVENT, onReauth);
  ctx.onCleanup(() => window.removeEventListener(REAUTH_EVENT, onReauth));
};

export default setup;
