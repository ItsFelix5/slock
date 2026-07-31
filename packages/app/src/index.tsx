/* @refresh reload */
import { isConfigured } from "@slock/slack-api";
import { render } from "solid-js/web";
import ConnectSlack from "./components/setup/ConnectSlack";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// Importing App pulls in lib/store, which fires off Slack API calls and opens
// the websocket as a module side effect — deferred behind a dynamic import so
// none of that happens until we know the server actually has credentials.
async function main(mountPoint: HTMLElement) {
  if (!isConfigured()) {
    render(() => <ConnectSlack onConnected={() => location.reload()} />, mountPoint);
    return;
  }

  const { default: App } = await import("./App");
  render(() => <App />, mountPoint);
}

main(root);
