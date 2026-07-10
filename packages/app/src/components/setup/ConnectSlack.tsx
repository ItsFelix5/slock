import { submitAuthRequest } from "@slock/slack-api";
import { Button } from "@slock/ui";
import { createSignal } from "solid-js";
import "./ConnectSlack.css";

export default function ConnectSlack(props: { onConnected: () => void }) {
  const [raw, setRaw] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!raw().trim() || submitting()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitAuthRequest(raw());
      if (result.ok) props.onConnected();
      else setError(result.error ?? "Something went wrong.");
    } catch {
      setError("Couldn't reach the server. Is it running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="connect-slack">
      <form class="connect-slack-card" onSubmit={handleSubmit}>
        <h1>Connect to Slack</h1>
        <p class="connect-slack-intro">
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
          class="connect-slack-input"
          placeholder="curl 'https://your-workspace.slack.com/api/...' -H ..."
          value={raw()}
          onInput={(e) => setRaw(e.currentTarget.value)}
          spellcheck={false}
          rows={8}
        />
        {error() && <p class="connect-slack-error">{error()}</p>}
        <Button type="submit" variant="primary" disabled={submitting() || !raw().trim()}>
          {submitting() ? "Connecting…" : "Connect"}
        </Button>
      </form>
    </div>
  );
}
