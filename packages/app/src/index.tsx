import { isConfigured } from "@slock/types";
import { render } from "solid-js/web";
import ConnectAccountForm from "./components/setup/ConnectAccountForm";
import "./components/setup/ConnectSlack.css";
import "./index.css";

async function main(mountPoint: HTMLElement) {
  if (!isConfigured()) {
    document.title = "Connect to Slack";
    render(
      () => (
        <div class="connect-slack flex-center">
          <div class="connect-slack-card flex-col">
            <h1>Connect to Slack</h1>
            <ConnectAccountForm onConnected={() => location.reload()} />
          </div>
        </div>
      ),
      mountPoint,
    );
    return;
  }

  const { default: App } = await import("./App");
  render(() => <App />, mountPoint);
}

main(document.body);
