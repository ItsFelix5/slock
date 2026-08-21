export type PairedPreferenceValues = Record<"desktop" | "mobile", string>;

export class PairedPreferenceWriteError extends Error {
  readonly rollbackComplete: boolean;

  constructor(rollbackComplete: boolean) {
    super(
      rollbackComplete
        ? "Paired preference write failed and was rolled back"
        : "Paired preference write failed and rollback was incomplete",
    );
    this.name = "PairedPreferenceWriteError";
    this.rollbackComplete = rollbackComplete;
  }
}

export async function writePairedPreference(
  nextValue: string,
  previousValues: PairedPreferenceValues,
  write: (target: "desktop" | "mobile", value: string) => Promise<boolean>,
): Promise<void> {
  const targets = ["desktop", "mobile"] as const;
  const results = await Promise.allSettled(targets.map((target) => write(target, nextValue)));
  if (results.every((result) => result.status === "fulfilled" && result.value)) return;

  const appliedTargets = targets.filter((_, index) => {
    const result = results[index];
    return result.status === "fulfilled" && result.value;
  });
  const rollbacks = await Promise.allSettled(
    appliedTargets.map((target) => write(target, previousValues[target])),
  );
  const rollbackComplete = rollbacks.every(
    (result) => result.status === "fulfilled" && result.value,
  );
  throw new PairedPreferenceWriteError(rollbackComplete);
}
