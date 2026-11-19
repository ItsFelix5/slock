import type { ApiReply } from "@slock/types";
import { apiDelete, apiPost } from "../client";
import { replyError } from "../error";
import { getActiveAccountId, refreshAccountInfo } from "./account";

async function sessionRequest(request: Promise<ApiReply>): Promise<void> {
  const reply = await request;
  refreshAccountInfo();
  if (!reply.ok) throw replyError(reply, "Couldn't update the session.");
}

export function connectWith(path: string, body: unknown): Promise<void> {
  return sessionRequest(apiPost(path, body));
}

export function removeAccount(id: string): Promise<void> {
  return sessionRequest(apiDelete(`/api/session/${id}`));
}

export async function logout(): Promise<void> {
  const activeId = getActiveAccountId();
  if (activeId) await removeAccount(activeId);
}
