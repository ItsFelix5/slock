/* @refresh reload */

import { render } from "solid-js/web";
import ConnectSlack from "./components/setup/ConnectSlack";
import { isConfigured } from "./lib/api";
import "./index.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

async function main(mountPoint: HTMLElement) {
  if (!isConfigured()) {
    document.title = "Connect to Slack";
    render(() => <ConnectSlack onConnected={() => location.reload()} />, mountPoint);
    return;
  }

  const { default: App } = await import("./App");
  render(() => <App />, mountPoint);
}

main(document.body);
