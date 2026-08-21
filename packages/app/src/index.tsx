/* @refresh reload */

import { render } from "solid-js/web";
import ConnectSlack from "./components/setup/ConnectSlack";
import { isConfigured } from "./lib/api";
import "./index.css";

async function main(mountPoint: HTMLElement) {
  // TEMPORARY offline test mode - see mock/README.md. Remove this block and
  // the mock/ folder once real testing is possible again.
  if (new URLSearchParams(location.search).has("mock")) {
    const { installMock } = await import("./mock/mockApi");
    installMock();
    const { default: App } = await import("./App");
    render(() => <App />, mountPoint);
    return;
  }

  if (!isConfigured()) {
    document.title = "Connect to Slack";
    render(() => <ConnectSlack onConnected={() => location.reload()} />, mountPoint);
    return;
  }

  const { default: App } = await import("./App");
  render(() => <App />, mountPoint);
}

main(document.body);
