import { fetchFileDetail } from "./api";
import { createKeyedQuery } from "./createKeyedQuery";
import { queryClient } from "./queryClient";

export function fileDetailQueryOptions(fileId: string) {
  return { queryFn: () => fetchFileDetail(fileId), queryKey: ["fileDetail", fileId] };
}

export function createFileDetailQuery(fileId: () => string | undefined) {
  return createKeyedQuery(() => {
    const id = fileId();
    return id ? fileDetailQueryOptions(id) : undefined;
  });
}

export function loadFileDetail(fileId: string) {
  return queryClient.ensureQueryData(fileDetailQueryOptions(fileId));
}
