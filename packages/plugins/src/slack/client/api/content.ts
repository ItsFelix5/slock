import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import { mapFile, replyError } from "@slock/slack";
import type { ChannelId, FileUploadInput, RawFile, SlackFile, Ts } from "@slock/types";

const env = service("env");

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
    const { file, title } = defined(files[i]);
    const reserve = await env.fetch("/api/files/reserve", {
      body: JSON.stringify({ filename: file.name, length: String(file.size) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const reservation = await reserve.json();
    if (!(reserve.ok && reservation.file_id && reservation.upload_url)) {
      throw replyError(reservation, "File reservation failed");
    }

    const uploadUrl = `/api/files/upload?url=${encodeURIComponent(reservation.upload_url)}&filename=${encodeURIComponent(file.name)}`;
    await uploadFileWithProgress(uploadUrl, file, (fraction) => onProgress?.(i, fraction));
    uploaded.push({ id: reservation.file_id, title: title?.trim() || file.name });
  }
  return uploaded;
}

async function completeUpload(
  uploaded: { id: string; title: string }[],
  extra?: Record<string, string>,
): Promise<SlackFile[]> {
  const completeRes = await env.fetch("/api/files/complete", {
    body: JSON.stringify({ files: JSON.stringify(uploaded), ...extra }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const complete = await completeRes.json();
  if (!completeRes.ok) throw replyError(complete, "files.completeUploadExternal failed");
  const files: RawFile[] = complete.files ?? [];
  return files.map(mapFile);
}

export async function uploadFilesForEdit(
  files: FileUploadInput[],
  onProgress?: (fileIndex: number, fraction: number) => void,
): Promise<SlackFile[]> {
  if (files.length === 0) return [];
  const uploaded = await reserveAndUploadFiles(files, onProgress);
  return completeUpload(uploaded);
}

export async function uploadFiles(
  channelId: ChannelId,
  files: FileUploadInput[],
  threadTs?: Ts,
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
