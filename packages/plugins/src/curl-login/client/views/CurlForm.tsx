import { connectWith } from "@slock/slack";
import type { ConnectMethodProps } from "../../../account/client/api";

export default function CurlForm(props: ConnectMethodProps) {
  return (
    <>
      <p class="connect-account-divider">
        or paste a Slack request from devtools (right-click → Copy as cURL)
      </p>
      <textarea
        autocomplete="off"
        class="connect-account-input"
        onPaste={async (event) => {
          const text = event.clipboardData?.getData("text");
          if (!text) return;
          props.setError(null);
          try {
            await connectWith("/api/curl-login/connect", { curl: text });
            props.connected();
          } catch (e) {
            props.setError(e instanceof Error ? e.message : String(e));
          }
        }}
        placeholder="curl 'https://your-workspace.slack.com/api/...' -H ..."
        rows={4}
        spellcheck={false}
      />
    </>
  );
}
