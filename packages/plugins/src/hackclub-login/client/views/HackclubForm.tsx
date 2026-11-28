import { errorMessage } from "@slock/core";
import type { ConnectMethodProps } from "@slock/plugins/account/client/api";
import { replyError } from "@slock/slack";
import { apiPost, connectWith } from "@slock/slack/client";
import { Button, OtpInput } from "@slock/ui";
import { createSignal, Show } from "solid-js";

async function requestHackclubEmailCode(email: string): Promise<unknown> {
  const data = await apiPost<{ challenge: unknown }>("/api/hackclub-auth/email", { email });
  if (!data.ok) throw replyError(data, "Could not send the email code");
  return data.challenge;
}

function connectWithHackclubEmailCode(challenge: unknown, code: string): Promise<void> {
  return connectWith("/api/hackclub-auth/verify", { challenge, code });
}

export default function HackclubForm(props: ConnectMethodProps) {
  const [busy, setBusy] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [challenge, setChallenge] = createSignal<unknown>(null);

  async function verifyCode(codeValue: string) {
    if (busy()) return;
    props.setError(null);
    setFailed(false);
    setBusy(true);
    try {
      await connectWithHackclubEmailCode(challenge(), codeValue);
      props.connected();
    } catch (e) {
      props.setError(errorMessage(e));
      setFailed(true);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function submitEmailStep(event: Event) {
    event.preventDefault();
    if (challenge()) return verifyCode(code());
    props.setError(null);
    setBusy(true);
    try {
      setChallenge(await requestHackclubEmailCode(email()));
    } catch (e) {
      props.setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="connect-account-fields flex-col" onSubmit={submitEmailStep}>
      <input
        autocomplete="email"
        class="connect-account-input field-surface"
        disabled={busy() || !!challenge()}
        onInput={(event) => setEmail(event.currentTarget.value)}
        placeholder="Hack Club Slack email"
        type="email"
        value={email()}
      />
      <Show
        fallback={
          <Button
            disabled={busy() || !(email().includes("@") && email().includes("."))}
            type="submit"
            variant="primary"
          >
            Send code
          </Button>
        }
        when={challenge()}
      >
        <OtpInput
          autofocus
          disabled={busy()}
          error={failed()}
          onChange={setCode}
          onComplete={verifyCode}
          value={code()}
        />
      </Show>
    </form>
  );
}
