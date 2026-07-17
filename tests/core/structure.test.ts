import * as fs from "node:fs";
import * as path from "node:path";
import * as testlib from "../testlib";

const test = testlib.test;
const assertTrue = testlib.assertTrue;
const sourceRoot = path.resolve(import.meta.dirname, "../../src");

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(fullPath) : [fullPath];
  });
}

test("Runtime source is TypeScript and uses module entry points", function () {
  const files = sourceFiles(sourceRoot);
  assertTrue(
    files
      .filter((file) => /\.[jt]s$/.test(file))
      .every((file) => file.endsWith(".ts")),
  );
  assertTrue(
    fs
      .readFileSync(path.join(sourceRoot, "main.ts"), "utf8")
      .includes('from "./core/game"'),
  );
});

test("PositioningController retains the sceneTeams ownership contract", function () {
  const source = fs.readFileSync(
    path.join(sourceRoot, "core/restarts/positioningController.ts"),
    "utf8",
  );
  assertTrue(source.includes("options.sceneTeams"));
  assertTrue(source.includes("this.sceneTeams"));
  assertTrue(source.includes("movePlayerToTarget("));
  assertTrue(!source.includes("\n  movePlayerToTarget("));
});
