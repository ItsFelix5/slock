import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { FileId, SlackFileDetail } from "@slock/types";
import { fileDetail } from "./api/fileDetailQuery";
import {
  addFileAccess,
  type FileAccessTarget,
  removeFileAccess,
  renameFile,
  setFileOrgAccess,
  updateFileAccess,
} from "./requests";

const feedback = service("feedback");

export const fileRename = defineMutation<{ fileId: FileId; title: string }>({
  key: ({ fileId }) => fileId,
  mode: "queue",
  onError: (error, { fileId }) => feedback.caught(fileId, error, "Couldn't rename the file"),
  onSuccess: (_, { fileId }) => fileDetail.invalidate(fileId),
  optimistic: ({ fileId, title }, transaction) =>
    transaction.apply(fileDetail, fileId, (detail) => ({
      ...detail,
      file: { ...detail.file, title },
    })),
  run: ({ fileId, title }) => renameFile(fileId, title),
});

export type AccessChange =
  | { kind: "org"; level: string; orgId: string }
  | { kind: "add" | "update"; level: string; orgId: string; target: FileAccessTarget }
  | { kind: "revoke"; orgId: string; target: FileAccessTarget };

type TargetChange = Exclude<AccessChange, { kind: "org" }>;

function changedEntries<T extends { access: string }>(
  entries: T[],
  change: TargetChange,
  isTarget: (entry: T) => boolean,
  added: (level: string) => T,
): T[] {
  if (change.kind === "revoke") return entries.filter((entry) => !isTarget(entry));
  if (change.kind === "add") return [...entries, added(change.level)];
  return entries.map((entry) => (isTarget(entry) ? { ...entry, access: change.level } : entry));
}

function withAccess(detail: SlackFileDetail, change: AccessChange): SlackFileDetail {
  const { access } = detail;
  if (!access) return detail;
  if (change.kind === "org") return { ...detail, access: { ...access, orgLevel: change.level } };
  const { target } = change;
  const changed =
    "channelId" in target
      ? {
          channels: changedEntries(
            access.channels,
            change,
            (entry) => entry.channelId === target.channelId,
            (level) => ({ access: level, channelId: target.channelId }),
          ),
        }
      : {
          users: changedEntries(
            access.users,
            change,
            (entry) => entry.userId === target.userId,
            (level) => ({ access: level, userId: target.userId }),
          ),
        };
  return { ...detail, access: { ...access, ...changed } };
}

function sendAccess(fileId: FileId, change: AccessChange) {
  if (change.kind === "org") return setFileOrgAccess(fileId, change.orgId, change.level);
  const { orgId, target } = change;
  if (change.kind === "revoke") return removeFileAccess(fileId, orgId, target);
  const send = change.kind === "add" ? addFileAccess : updateFileAccess;
  return send(fileId, { ...target, level: change.level, orgId });
}

export const fileAccess = defineMutation<{ change: AccessChange; fileId: FileId }>({
  key: ({ fileId }) => fileId,
  mode: "queue",
  onError: (error, { fileId }) => {
    feedback.caught(fileId, error, "Couldn't update access");
    fileDetail.invalidate(fileId);
  },
  onSuccess: (_, { fileId }) => fileDetail.invalidate(fileId),
  optimistic: ({ change, fileId }, transaction) =>
    transaction.apply(fileDetail, fileId, (detail) => withAccess(detail, change)),
  run: ({ change, fileId }) => sendAccess(fileId, change),
});
