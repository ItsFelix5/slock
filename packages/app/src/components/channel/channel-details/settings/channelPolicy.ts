import type { MemberPermissionsPatch } from "@slock/slack-api";

export type AppliedPermissionChoice = "allow" | "restrict";
export type AppliedRetentionChoice = "keep" | "delete";

export function memberPermissionPatch(
  permission: "invite" | "topic" | "purpose",
  choice: AppliedPermissionChoice,
): MemberPermissionsPatch {
  const allowed = choice === "allow";
  return {
    invite: permission === "invite" ? allowed : undefined,
    setPurpose: permission === "purpose" ? allowed : undefined,
    setTopic: permission === "topic" ? allowed : undefined,
  };
}

export function retentionValue(choice: AppliedRetentionChoice, days: number): number | null {
  return choice === "delete" ? days : null;
}
