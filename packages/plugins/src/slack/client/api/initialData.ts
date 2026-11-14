import { service } from "@slock/core/solid";
import { ApiError, forceReauth, isAuthError, isConfigured } from "@slock/slack";
import type { BootstrapPayload } from "@slock/types";
import { defineKey } from "../../../query/client/api";

const query = service("query");
const initialDataKey = defineKey("initialData");

export function fetchInitialData(): Promise<BootstrapPayload> {
  return query.client.query({
    queryFn: async () => {
      const response = await fetch("/api/bootstrap");
      if (!response.ok) {
        throw new ApiError(
          `Bootstrap failed (${response.status})`,
          response.headers.get("retry-after") ?? undefined,
        );
      }
      const data: BootstrapPayload = await response.json();
      if (isConfigured() && Object.values(data.error ?? {}).some(isAuthError)) {
        return forceReauth();
      }
      if (Object.keys(data.error ?? {}).length)
        query.client.removeQueries({ queryKey: initialDataKey() });
      return data;
    },
    queryKey: initialDataKey(),
    staleTime: Infinity,
  });
}

export function isPending(data: BootstrapPayload, part: string): boolean {
  return !data.error && !!data.pending?.includes(part);
}

export async function completePending(
  part: string,
  loadLate: () => Promise<Partial<BootstrapPayload>>,
): Promise<void> {
  const late = await loadLate();
  query.client.setQueryData<BootstrapPayload>(
    initialDataKey(),
    (current) =>
      current && {
        ...current,
        ...late,
        pending: current.pending?.filter((name) => name !== part),
      },
  );
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
  query.client.setQueryData<BootstrapPayload>(
    initialDataKey(),
    (data) => data && { ...data, ...patch },
  );
}
