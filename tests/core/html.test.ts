import * as fs from "node:fs";
import * as path from "node:path";
import * as testlib from "../testlib";

const test = testlib.test;
const assertTrue = testlib.assertTrue;
const rootDir = path.resolve(import.meta.dirname, "../..");
const readFile = (relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), "utf8");

test("Options page loads the typed menu entry and preserves all match options", function () {
  const html = readFile("index.html");
  const menu = readFile("src/menu.ts");
  const styles = readFile("src/styles/menu.css");

  assertTrue(html.includes('id="optionsForm"'));
  assertTrue(html.includes('src="/src/menu.ts"'));
  for (const id of [
    "playerStrength",
    "opponentStrength",
    "homeTeamSize",
    "awayTeamSize",
    "kickoffSide",
    "outOfPlayRestartsEnabled",
  ]) {
    assertTrue(menu.includes(id), `Missing option ${id}`);
  }
  assertTrue(menu.includes('"Red Novices", "Blue Novices"'));
  assertTrue(menu.includes('"Red Titans", "Blue Titans"'));
  assertTrue(menu.includes("game.html?"));
  assertTrue(styles.includes("@media (max-width: 600px)"));
  assertTrue(styles.includes("prefers-reduced-motion"));
});

test("Game page loads one module entry with canvas assets and mobile rotation UI", function () {
  const html = readFile("game.html");
  const main = readFile("src/main.ts");
  const styles = readFile("src/styles/game.css");

  assertTrue(html.includes('id="myCanvas"'));
  assertTrue(html.includes('id="rotateNotice"'));
  assertTrue(html.includes('src="/src/main.ts"'));
  assertTrue(html.includes('src="assets/images/pitch.jpg"'));
  assertTrue(html.includes('src="assets/images/player-sprite-away.png"'));
  assertTrue(
    main.includes("createGame(new Configuration(loadBrowserAssets()))"),
  );
  assertTrue(main.includes("requestAnimationFrame"));
  assertTrue(styles.includes("(orientation: portrait) and (pointer: coarse)"));
});
