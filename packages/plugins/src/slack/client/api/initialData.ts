import { forceReauth, isAuthError, isConfigured, slackErrorOf } from "@slock/slack";
import type { BootstrapPayload } from "@slock/types";
import { defineQuery } from "../../../query/client/api";

const initialData = defineQuery<null, BootstrapPayload>({
  load: async () => {
    const response = await fetch("/api/bootstrap");
    if (!response.ok) {
      throw slackErrorOf({
        fallback: `Bootstrap failed (${response.status})`,
        retryAfter: response.headers.get("retry-after") ?? undefined,
        status: response.status,
      });
    }
    const data: BootstrapPayload = await response.json();
    if (isConfigured() && Object.values(data.error ?? {}).some(isAuthError)) {
      return forceReauth();
    }
    return data;
  },
  name: "initialData",
});

export async function fetchInitialData(): Promise<BootstrapPayload> {
  const data = await initialData.ensure(null);
  if (Object.keys(data.error ?? {}).length) initialData.remove(null);
  return data;
}

export function isPending(data: BootstrapPayload, part: string): boolean {
  return !data.error && !!data.pending?.includes(part);
}

export async function completePending(
  part: string,
  loadLate: () => Promise<Partial<BootstrapPayload>>,
): Promise<void> {
  const late = await loadLate();
  initialData.modify(null, (current) => ({
    ...current,
    ...late,
    pending: current.pending?.filter((name) => name !== part),
  }));
}

export async function fetchInitialDataWith(
  part: string,
  loadLate: () => Promise<Partial<BootstrapPayload>>,
): Promise<BootstrapPayload> {
  const data = await fetchInitialData();
  if (!isPending(data, part)) return data;
  await completePending(part, loadLate);
  return fetchInitialData();
}

export function patchInitialData(patch: Partial<BootstrapPayload>) {
  initialData.modify(null, (data) => ({ ...data, ...patch }));
}
