import { apiDelete, apiGet, apiPut } from "@slock/slack";

type RelayStatus = { available: boolean; connected: boolean };

const ERRORS: Record<string, string> = {
  invalid_token: "That token isn't valid or has expired. Run /slock-relay token again.",
  relay_not_configured: "This Slock server isn't set up with a relay.",
};

export async function fetchRelayStatus(): Promise<RelayStatus> {
  const data = await apiGet<RelayStatus>("/api/relay");
  if (!data.ok) throw new Error(data.error ?? "Couldn't load the relay status.");
  return { available: data.available, connected: data.connected };
}

export async function connectRelay(token: string) {
  const data = await apiPut("/api/relay/token", { token });
  if (!data.ok) throw new Error(ERRORS[data.error ?? ""] ?? data.error ?? "Couldn't connect.");
}

export async function disconnectRelay() {
  const data = await apiDelete("/api/relay/token");
  if (!data.ok) throw new Error(data.error ?? "Couldn't disconnect.");
}
