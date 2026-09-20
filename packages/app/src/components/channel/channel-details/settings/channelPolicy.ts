import type { MemberPermissionsPatch } from "../../../../lib/api";

export type AppliedPermissionChoice = "allow" | "restrict";
export type AppliedRetentionChoice = "keep" | "delete";
export type PermissionChoice = "" | AppliedPermissionChoice;

export interface PermissionDraft {
  current: PermissionChoice;
  committed: PermissionChoice;
}

function isPermissionDirty(draft: PermissionDraft): boolean {
  return draft.current !== "" && draft.current !== draft.committed;
}

export function memberPermissionsDirty(drafts: {
  invite: PermissionDraft;
  purpose: PermissionDraft;
  topic: PermissionDraft;
}): boolean {
  return (
    isPermissionDirty(drafts.invite) ||
    isPermissionDirty(drafts.purpose) ||
    isPermissionDirty(drafts.topic)
  );
}

export function memberPermissionsPatch(drafts: {
  invite: PermissionDraft;
  purpose: PermissionDraft;
  topic: PermissionDraft;
}): MemberPermissionsPatch {
  const allowed = (draft: PermissionDraft) =>
    isPermissionDirty(draft) ? draft.current === "allow" : undefined;
  return {
    invite: allowed(drafts.invite),
    setPurpose: allowed(drafts.purpose),
    setTopic: allowed(drafts.topic),
  };
}

export function retentionValue(choice: AppliedRetentionChoice, days: number): number | null {
  return choice === "delete" ? days : null;
}
