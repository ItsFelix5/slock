import { describe, expect, test } from "bun:test";
import { canEditCanvas } from "../../../src/canvas/server/api";

type FileFields = Record<string, unknown>;

const file: FileFields = { id: "F1", quip_thread_id: "T1", user: "U1" };

const withFields = (fields: FileFields): FileFields => ({ ...file, ...fields });

describe("canEditCanvas", () => {
  test("is true only for an explicit true", () => {
    expect(canEditCanvas(withFields({ editable: true }))).toBe(true);
  });

  test.each<[string, FileFields]>([
    ["missing field", file],
    ["false", withFields({ editable: false })],
    ["undefined", withFields({ editable: undefined })],
    ["null", withFields({ editable: null })],
    ["string true", withFields({ editable: "true" })],
    ["number one", withFields({ editable: 1 })],
    ["empty object", withFields({ editable: {} })],
  ])("is false for %s", (_name, info) => {
    expect(canEditCanvas(info)).toBe(false);
  });

  test.each<[string, FileFields]>([
    ["org read access", withFields({ org_or_workspace_access: "read" })],
    ["org edit access", withFields({ org_or_workspace_access: "edit" })],
    [
      "dm user with edit access",
      withFields({ dm_mpdm_users_with_file_access: [{ access: "edit", user_id: "U1" }] }),
    ],
  ])("ignores permission fields without editable: %s", (_name, info) => {
    expect(canEditCanvas(info)).toBe(false);
  });
});
