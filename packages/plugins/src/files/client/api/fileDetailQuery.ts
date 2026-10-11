import { service } from "@slock/core/solid";
import { createKeyedQuery, defineKey } from "../../../query/client/api";
import { fetchFileDetail } from "../../../slack/client/api";

const fileDetailKey = defineKey<[string]>("fileDetail");

const query = service("query");

export function fileDetailQueryOptions(fileId: string) {
  return { queryFn: () => fetchFileDetail(fileId), queryKey: fileDetailKey(fileId) };
}

export function createFileDetailQuery(fileId: () => string | undefined) {
  return createKeyedQuery(() => {
    const id = fileId();
    return id ? fileDetailQueryOptions(id) : undefined;
  });
}

export function loadFileDetail(fileId: string) {
  return query.client.ensureQueryData(fileDetailQueryOptions(fileId));
}
