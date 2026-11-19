export function assertNever(value: never): never {
  throw new Error(`unhandled case: ${JSON.stringify(value)}`);
}
