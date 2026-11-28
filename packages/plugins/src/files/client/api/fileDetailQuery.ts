import { defineQuery } from "@slock/plugins/query/client/api";
import type { FileId, SlackFileDetail } from "@slock/types";
import { fetchFileDetail } from "../requests";

export const fileDetail = defineQuery<FileId, SlackFileDetail>({
  load: (fileId, { signal }) => fetchFileDetail(fileId, signal),
  name: "fileDetail",
});

export function createFileDetailQuery(fileId: () => FileId | undefined) {
  return fileDetail.state(fileId);
}

export function useFileDetail(fileId: () => FileId | undefined) {
  return fileDetail.use(fileId);
}

export const loadFileDetail = (fileId: FileId) => fileDetail.ensure(fileId);
