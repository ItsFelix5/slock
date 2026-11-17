import { callBot } from "./slack";

const KEEP_MS = 15 * 60_000;

const reserved = new Set<string>();

export async function reserveUpload(team: string, filename: string, length: string) {
  const reply = await callBot<{ file_id: string; upload_url: string }>(
    team,
    "files.getUploadURLExternal",
    { filename, length },
  );
  if (reply.ok) {
    reserved.add(reply.file_id);
    setTimeout(() => reserved.delete(reply.file_id), KEEP_MS).unref();
  }
  return reply;
}

export function claimUploads(ids: string[]) {
  if (!ids.every((id) => reserved.has(id))) return false;
  for (const id of ids) reserved.delete(id);
  return true;
}
