import { describe, expect, test } from "bun:test";
import { messageField, stringField } from "../../../src/canvas/protocol/protobufWrite.ts";
import { decodeLoadData } from "../../../src/canvas/protocol/sections.ts";

function loadDataWith(secretPath: number[]): Uint8Array {
  const thread = [...stringField(1, "thread"), ...secretPath];
  const document = [...messageField(3, thread), ...messageField(6, stringField(1, "doc"))];
  return Uint8Array.from(messageField(2, messageField(2, document)));
}

describe("secret path", () => {
  test("reads a plain string", () => {
    const decoded = decodeLoadData(loadDataWith(stringField(7, "GJP9EANSP9i")));
    expect(decoded.meta?.secretPath).toBe("GJP9EANSP9i");
  });

  test("reads the packed form", () => {
    const decoded = decodeLoadData(loadDataWith(messageField(7, stringField(9, "F9EAREnuU"))));
    expect(decoded.meta?.secretPath).toBe("F9EAREnuU");
  });

  test("ignores a packed form without field 9", () => {
    const decoded = decodeLoadData(loadDataWith(messageField(7, stringField(10, "D9EA2ufQI"))));
    expect(decoded.meta?.secretPath).toBe("");
  });
});
