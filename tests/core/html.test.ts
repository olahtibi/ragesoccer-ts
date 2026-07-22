import * as fs from "node:fs";
import * as path from "node:path";
import { assertTrue, test } from "../testlib";
import { assertEqual } from "../testlib";

const rootDir = path.resolve(import.meta.dirname, "../..");
const readFile = (relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), "utf8");

test("Options page loads the typed menu entry and preserves all match options", function () {
  const html = readFile("index.html");
  const menu = readFile("src/menu.ts");
  const teamCatalog = readFile("src/teamCatalog.ts");
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
  assertTrue(menu.includes("TEAM_CATALOG"));
  assertTrue(teamCatalog.includes('home: "Red Novices"'));
  assertTrue(teamCatalog.includes('away: "Blue Novices"'));
  assertTrue(teamCatalog.includes('homeShort: "RDT"'));
  assertTrue(teamCatalog.includes('awayShort: "BLT"'));
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
  assertTrue(html.includes('src="assets/images/pitch-v2.png"'));
  assertTrue(html.includes('src="assets/images/player-sprite-away-v2.png"'));
  assertTrue(main.includes("createGame("));
  assertTrue(main.includes("new Configuration(loadBrowserAssets()"));
  assertTrue(main.includes("visualViewport"));
  assertTrue(main.includes("requestAnimationFrame"));
  assertTrue(styles.includes("(orientation: portrait) and (pointer: coarse)"));
});

test("Facelift assets have the production PNG dimensions and alpha layouts", function () {
  function pngHeader(relativePath: string) {
    var data = fs.readFileSync(path.join(rootDir, relativePath));
    return {
      signature: data.subarray(1, 4).toString("ascii"),
      width: data.readUInt32BE(16),
      height: data.readUInt32BE(20),
      colorType: data[25],
    };
  }

  var pitch = pngHeader("public/assets/images/pitch-v2.png");
  var home = pngHeader("public/assets/images/player-sprite-home-v2.png");
  var away = pngHeader("public/assets/images/player-sprite-away-v2.png");
  var ball = pngHeader("public/assets/images/ball-v2.png");

  assertEqual(pitch.signature, "PNG");
  assertEqual(pitch.width, 2688);
  assertEqual(pitch.height, 3392);
  assertEqual(home.width, 320);
  assertEqual(home.height, 1536);
  assertEqual(home.colorType, 6);
  assertEqual(away.width, 320);
  assertEqual(away.height, 1536);
  assertEqual(away.colorType, 6);
  assertEqual(ball.width, 144);
  assertEqual(ball.height, 16);
  assertEqual(ball.colorType, 6);
});
