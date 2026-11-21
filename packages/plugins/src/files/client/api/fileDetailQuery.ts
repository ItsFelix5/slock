import { defineQuery } from "@slock/plugins/query/client/api";
import { fetchFileDetail } from "@slock/plugins/slack/client/api";
import type { FileId } from "@slock/types";

const fileDetail = defineQuery<FileId, Awaited<ReturnType<typeof fetchFileDetail>>>({
  load: fetchFileDetail,
  name: "fileDetail",
});

export function createFileDetailQuery(fileId: () => FileId | undefined) {
  return fileDetail.state(fileId);
}

export function useFileDetail(fileId: () => FileId | undefined) {
  return fileDetail.use(fileId);
}

export const refreshFileDetail = (fileId: FileId) => fileDetail.refresh(fileId).catch(() => {});

export const loadFileDetail = (fileId: FileId) => fileDetail.ensure(fileId);
