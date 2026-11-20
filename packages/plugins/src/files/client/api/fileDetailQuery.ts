import { defineQuery } from "../../../query/client/api";
import { fetchFileDetail } from "../../../slack/client/api";

const fileDetail = defineQuery<string, Awaited<ReturnType<typeof fetchFileDetail>>>({
  load: fetchFileDetail,
  name: "fileDetail",
});

export function createFileDetailQuery(fileId: () => string | undefined) {
  return fileDetail.state(fileId);
}

export function useFileDetail(fileId: () => string | undefined) {
  return fileDetail.use(fileId);
}

export const refreshFileDetail = (fileId: string) => fileDetail.refresh(fileId).catch(() => {});

export const loadFileDetail = (fileId: string) => fileDetail.ensure(fileId);
