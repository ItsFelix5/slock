import { rememberAccount, setActiveAccountId, submitAuthRequest } from "@slock/types";
import { createSignal } from "solid-js";
import { fetchAccountIdentity } from "../../lib/api";
import { parseSlackCurl } from "../../lib/parseSlackCurl";
import "./ConnectSlack.css";

export default function ConnectSlack(props: { onConnected: () => void }) {
  const [error, setError] = createSignal<string | null>(null);

  async function connect(raw: string) {
    try {
      const creds = parseSlackCurl(raw);
      const result = await submitAuthRequest(creds);
      if (!result.ok) throw result.error;
      const identity = await fetchAccountIdentity().catch(() => ({ name: creds.domain }));
      setActiveAccountId(rememberAccount({ ...creds, ...identity }).id);
      props.onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div class="connect-slack flex-center">
      <div class="connect-slack-card">
        <h1>Connect to Slack</h1>
        <p class="connect-slack-intro" id="connect-slack-instructions">
          Slock needs a token and session cookie from a signed-in Slack tab. Grab both at once by
          copying a request out of devtools:
        </p>
        <ol class="connect-slack-steps">
          <li>Open Slack in your browser and sign in.</li>
          <li>Open devtools → the Network tab, then click around (e.g. switch channels).</li>
          <li>
            Right-click any request to <code>/api/...</code> → Copy → <strong>Copy as cURL</strong>.
          </li>
          <li>Paste it below.</li>
        </ol>
        <textarea
          aria-describedby="connect-slack-instructions connect-slack-error"
          autocomplete="off"
          class="connect-slack-input"
          onPaste={(event) => {
            const text = event.clipboardData?.getData("text");
            if (!text) return;
            setError(null);
            connect(text);
          }}
          placeholder="curl 'https://your-workspace.slack.com/api/...' -H ..."
          rows={8}
          spellcheck={false}
        />
        <p class="connect-slack-error" id="connect-slack-error">
          {error()}
        </p>
      </div>
    </div>
  );
}
