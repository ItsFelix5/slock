import { expect, test } from "bun:test";
import { parseCommand, parseLine, parseTargets } from "../../packages/installer/src/spec";

test("a bare name is an id, a url is a url with a ref, anything else is a path", () => {
  expect(parseTargets(["perf", "./mine", "https://github.com/o/r/tree/main/x#v1"], false)).toEqual([
    { kind: "id", off: false, value: "perf" },
    { kind: "path", off: false, value: "./mine" },
    { kind: "url", off: false, ref: "v1", value: "https://github.com/o/r/tree/main/x" },
  ]);
});

test("commas split one target into many", () => {
  expect(parseTargets(["a,b", "c"], false).map((spec) => spec.value)).toEqual(["a", "b", "c"]);
});

test("a list line takes the same flags as the command line", () => {
  expect(parseLine("layout-master --off", false)).toEqual([
    { kind: "id", off: true, value: "layout-master" },
  ]);
  expect(parseLine("a,b", true).map((spec) => spec.off)).toEqual([true, true]);
});

test("the command parser splits name, targets and flags", () => {
  expect(parseCommand(["install", "core,perf", "--off", "--yes", "--dir", "x"])).toEqual({
    dir: "x",
    force: false,
    name: "install",
    off: true,
    targets: ["core,perf"],
    yes: true,
  });
});
