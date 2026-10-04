import { apiPost, type StoredAccount } from "@slock/types";

export type HackclubCredentials = Omit<StoredAccount, "id" | "name" | "avatarUrl">;

export async function requestHackclubEmailCode(email: string): Promise<unknown> {
  const data = await apiPost<{ challenge: unknown }>("/api/hackclub-auth/email", { email });
  if (!data.ok) throw new Error(data.error ?? "Could not send the email code");
  return data.challenge;
}

export async function exchangeHackclubEmailCode(
  challenge: unknown,
  code: string,
): Promise<HackclubCredentials> {
  const data = await apiPost<{ credentials: HackclubCredentials }>("/api/hackclub-auth/verify", {
    challenge,
    code,
  });
  if (!data.ok) throw new Error(data.error ?? "Could not verify the email code");
  return data.credentials;
}
