/* @refresh reload */
import { isConfigured } from "@slock/slack-api";
import { render } from "solid-js/web";
import ConnectSlack from "./components/setup/ConnectSlack";
import "./index.css";

async function main(mountPoint: HTMLElement) {
  if (!isConfigured()) {
    render(() => <ConnectSlack onConnected={() => location.reload()} />, mountPoint);
    return;
  }

  const { default: App } = await import("./App");
  render(() => <App />, mountPoint);
}

main(document.body);
