import { rememberAccount, setActiveAccountId, submitAuthRequest } from "@slock/types";
import { Button, OtpInput } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import {
  exchangeHackclubEmailCode,
  fetchAccountIdentity,
  requestHackclubEmailCode,
} from "../../lib/api";
import { parseSlackCurl } from "../../lib/parseSlackCurl";
import "./ConnectAccountForm.css";

type Creds = { domain: string; route: string; slackSession: string; token: string };

export default function ConnectAccountForm(props: { onConnected: () => void }) {
  const [error, setError] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [challenge, setChallenge] = createSignal<unknown>(null);

  async function finishConnecting(creds: Creds) {
    const result = await submitAuthRequest(creds);
    if (!result.ok) throw new Error(result.error);
    const identity = await fetchAccountIdentity().catch(() => ({ name: creds.domain }));
    setActiveAccountId(rememberAccount({ ...creds, ...identity }).id);
    props.onConnected();
  }

  async function verifyCode(codeValue: string) {
    if (busy()) return;
    setError(null);
    setBusy(true);
    try {
      await finishConnecting(await exchangeHackclubEmailCode(challenge(), codeValue));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function submitEmailStep(event: Event) {
    event.preventDefault();
    if (challenge()) return verifyCode(code());
    setError(null);
    setBusy(true);
    try {
      setChallenge(await requestHackclubEmailCode(email()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="connect-account-form flex-col">
      <form class="connect-account-fields flex-col" onSubmit={submitEmailStep}>
        <input
          autocomplete="email"
          class="connect-account-input"
          disabled={busy() || !!challenge()}
          onInput={(event) => setEmail(event.currentTarget.value)}
          placeholder="Hack Club Slack email"
          type="email"
          value={email()}
        />
        <Show
          when={challenge()}
          fallback={
            <Button
              disabled={busy() || !(email().includes("@") && email().includes("."))}
              type="submit"
              variant="primary"
            >
              Send code
            </Button>
          }
        >
          <OtpInput
            autofocus
            disabled={busy()}
            error={!!error()}
            onChange={setCode}
            onComplete={verifyCode}
            value={code()}
          />
        </Show>
      </form>

      <p class="connect-account-divider">
        or paste a Slack request from devtools (right-click → Copy as cURL)
      </p>

      <textarea
        autocomplete="off"
        class="connect-account-input"
        onPaste={async (event) => {
          const text = event.clipboardData?.getData("text");
          if (!text) return;
          setError(null);
          try {
            await finishConnecting(parseSlackCurl(text));
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }}
        placeholder="curl 'https://your-workspace.slack.com/api/...' -H ..."
        rows={4}
        spellcheck={false}
      />

      <p class="connect-account-error">{error()}</p>
    </div>
  );
}
