import { service } from "@slock/core/solid";
import { ApiError, forceReauth, isConfigured } from "@slock/slack";
import type { BootstrapPayload } from "@slock/types";
import { defineKey } from "../../../query/client/api";

const query = service("query");
const initialDataKey = defineKey("initialData");

export function fetchInitialData(): Promise<BootstrapPayload> {
  return query.client.fetchQuery({
    queryFn: async () => {
      const response = await fetch("/api/bootstrap");
      if (!response.ok) {
        throw new ApiError(
          `Bootstrap failed (${response.status})`,
          response.headers.get("retry-after") ?? undefined,
        );
      }
      const data: BootstrapPayload = await response.json();
      if (isConfigured() && Object.values(data.error ?? {}).includes("not_configured")) {
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
