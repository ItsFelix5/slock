import type {
  FileUploadInput,
  LinkPreview,
  RawFile,
  RawFileShare,
  SavedItem,
  SlackFile,
  SlackFileDetail,
} from "@slock/types";
import { apiGet, apiPost, mapFile, mapFileShare } from "@slock/types";

export async function fetchSaved(): Promise<SavedItem[]> {
  const data = await apiGet<{ items?: SavedItem[] }>("/api/saved");
  if (!data.ok) throw new Error(data.error ?? "saved.list failed");
  return data.items ?? [];
}

export async function fetchFileDetail(fileId: string): Promise<SlackFileDetail> {
  const data = await apiGet<{
    access: {
      org_id: string | null;
      org_level: string;
      users: { access: string; user_id: string }[];
    };
    content?: string | null;
    contentTruncated?: boolean;
    editable?: boolean;
    file: RawFile;
    owner?: string | null;
    shares?: RawFileShare[];
    starred?: boolean;
    viewer_count?: number | null;
  }>(`/api/files/${fileId}/detail`);
  if (!data.ok) throw new Error(data.error ?? "files.info failed");
  return {
    access: {
      orgId: data.access.org_id,
      orgLevel: data.access.org_level,
      users: data.access.users.map((entry) => ({ access: entry.access, userId: entry.user_id })),
    },
    content: data.content ?? null,
    contentTruncated: !!data.contentTruncated,
    editable: data.editable !== false,
    file: mapFile(data.file),
    ownerId: data.owner ?? null,
    shares: (data.shares ?? []).map(mapFileShare),
    starred: !!data.starred,
    viewerCount: data.viewer_count ?? null,
  };
}

export async function renameFile(fileId: string, title: string): Promise<void> {
  const data = await apiPost(`/api/files/${fileId}/rename`, { title });
  if (!data.ok) throw new Error(data.error ?? "Couldn't rename the file");
}

export async function runSlashCommand(
  channelId: string,
  command: string,
  text: string,
): Promise<string | null> {
  const data = await apiPost("/api/commands/run", { channelId, command, text });
  if (!data.ok) return data.error ?? "Command not supported by this client.";
  return null;
}

function uploadFileWithProgress(url: string, file: File, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Failed to upload ${file.name}.`));
    };
    xhr.onerror = () => reject(new Error(`Failed to upload ${file.name}.`));
    xhr.send(file);
  });
}

async function reserveAndUploadFiles(
  files: FileUploadInput[],
  onProgress?: (fileIndex: number, fraction: number) => void,
): Promise<{ id: string; title: string }[]> {
  const uploaded: { id: string; title: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const { file, title } = files[i];
    const reserve = await fetch("/api/files/reserve", {
      body: JSON.stringify({ filename: file.name, length: String(file.size) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const reservation = await reserve.json();
    if (!(reserve.ok && reservation.file_id && reservation.upload_token)) {
      throw new Error(reservation.error ?? "File reservation failed");
    }

    const uploadUrl = `/api/files/upload/${reservation.upload_token}?filename=${encodeURIComponent(file.name)}`;
    await uploadFileWithProgress(uploadUrl, file, (fraction) => onProgress?.(i, fraction));
    uploaded.push({ id: reservation.file_id, title: title?.trim() || file.name });
  }
  return uploaded;
}

async function completeUpload(
  uploaded: { id: string; title: string }[],
  extra?: Record<string, string>,
): Promise<SlackFile[]> {
  const completeRes = await fetch("/api/files/complete", {
    body: JSON.stringify({ files: JSON.stringify(uploaded), ...extra }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const complete = await completeRes.json();
  if (!completeRes.ok) throw new Error(complete.error ?? "files.completeUploadExternal failed");
  const files: RawFile[] = complete.files ?? [];
  return files.map(mapFile);
}

export async function uploadFiles(
  channelId: string,
  files: FileUploadInput[],
  threadTs?: string,
  comment?: string,
  onProgress?: (fileIndex: number, fraction: number) => void,
): Promise<void> {
  if (files.length === 0) return;
  const uploaded = await reserveAndUploadFiles(files, onProgress);
  const extra: Record<string, string> = { channel_id: channelId };
  if (threadTs) extra.thread_ts = threadTs;
  if (comment) extra.initial_comment = comment;
  await completeUpload(uploaded, extra);
}

export async function uploadFilesForEdit(
  files: FileUploadInput[],
  onProgress?: (fileIndex: number, fraction: number) => void,
): Promise<SlackFile[]> {
  if (files.length === 0) return [];
  const uploaded = await reserveAndUploadFiles(files, onProgress);
  return completeUpload(uploaded);
}

export function uploadFile(
  channelId: string,
  file: File,
  threadTs?: string,
  comment?: string,
): Promise<void> {
  return uploadFiles(channelId, [{ file }], threadTs, comment);
}

export function fetchLinkPreview(_url: string): Promise<LinkPreview | null> {
  return Promise.resolve(null);
}

export type FileAccessTarget = { channelId: string } | { userId: string };

async function postFileAccess(fileId: string, path: string, body: object) {
  const data = await apiPost(`/api/files/${fileId}/${path}`, body);
  if (!data.ok) throw new Error(data.error ?? "Couldn't update access");
}

export function setFileAccess(
  fileId: string,
  orgId: string,
  target: FileAccessTarget,
  level: string,
) {
  return postFileAccess(fileId, "access", { ...target, level, orgId });
}

export function removeFileAccess(fileId: string, target: FileAccessTarget) {
  return postFileAccess(fileId, "access/remove", target);
}

export function setFileOrgAccess(fileId: string, orgId: string, level: string) {
  return postFileAccess(fileId, "org-access", { level, orgId });
}
