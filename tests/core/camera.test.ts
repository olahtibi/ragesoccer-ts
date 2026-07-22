import { assertEqual, assertNear, assertTrue, test } from "../testlib";
import { canvasContext, makeFixture } from "../helpers";
import { Camera } from "../../src/core/camera";
import { Vector2 as Vector2d } from "../../src/math/vector";
import { world } from "../../src/core/configuration";

test("Camera snaps viewport translation to device pixels", function () {
  var originalDevicePixelRatio = window.devicePixelRatio;
  window.devicePixelRatio = 2;
  var fixture = makeFixture();
  fixture.config.viewport.width = 501;
  fixture.config.viewport.height = 300;
  fixture.config.viewport.ratio = 0.7;
  fixture.ball.position.x = 200;
  fixture.ball.position.y = 300;
  var camera = new Camera(fixture.config, fixture.stadium);
  var translateArgs = { x: Number.NaN, y: Number.NaN };
  var ctx = canvasContext({
    save: function () {},
    scale: function () {},
    translate: function (x: number, y: number) {
      translateArgs = {
        x: x,
        y: y,
      };
    },
  });

  try {
    camera.windowToViewport(ctx);
  } finally {
    window.devicePixelRatio = originalDevicePixelRatio;
  }

  var scaleBy = fixture.config.computeScaleBy();
  assertNear(
    translateArgs.x * scaleBy * 2,
    Math.round(translateArgs.x * scaleBy * 2),
    0.0001,
  );
  assertNear(
    translateArgs.y * scaleBy * 2,
    Math.round(translateArgs.y * scaleBy * 2),
    0.0001,
  );
});

test("Camera lerps toward focus target and reports arrival", function () {
  var fixture = makeFixture();
  fixture.config.viewport.width = 400;
  fixture.config.viewport.height = 300;
  fixture.config.viewport.ratio = 0.7;
  fixture.config.cutscene.cameraLerp = 0.5;
  fixture.config.cutscene.cameraArrivedRadius = 0.001;
  var camera = new Camera(fixture.config, fixture.stadium);
  camera.position.x = 0;
  camera.position.y = 0;
  camera.setFocusTarget(new Vector2d(world(334), world(433)));
  var translateArgs = { x: Number.NaN, y: Number.NaN };
  var ctx = canvasContext({
    save: function () {},
    scale: function () {},
    translate: function (x: number, y: number) {
      translateArgs = { x: x, y: y };
    },
  });

  camera.windowToViewport(ctx);

  var desired = new Vector2d(
    (fixture.config.viewport.width / 2 -
      world(334) * fixture.config.computeScaleBy()) /
      fixture.config.computeScaleBy(),
    (fixture.config.viewport.height / 2 -
      world(433) * fixture.config.computeScaleBy()) /
      fixture.config.computeScaleBy(),
  );
  assertNear(translateArgs.x, desired.x * 0.5, 0.0001);
  assertNear(translateArgs.y, desired.y * 0.5, 0.0001);
  assertTrue(!camera.hasArrivedAtFocus());

  camera.position.x = desired.x;
  camera.position.y = desired.y;
  assertTrue(camera.hasArrivedAtFocus());
});

test("Camera overlay renders team-owned scores and supplied FPS", function () {
  var fixture = makeFixture();
  fixture.homeTeam.score = 2;
  fixture.awayTeam.score = 1;
  fixture.game.camera.showStats = true;
  var labels: string[] = [];
  var ctx = canvasContext({
    fillText: function (value: string) {
      labels.push(String(value));
    },
    fillRect: function () {},
    save: function () {},
    restore: function () {},
  });

  fixture.game.camera.renderOverlay(ctx, 60);

  assertTrue(labels.indexOf("MAR") !== -1);
  assertTrue(labels.indexOf("SAP") !== -1);
  assertTrue(labels.indexOf("2") !== -1);
  assertTrue(labels.indexOf("1") !== -1);
  assertTrue(labels.indexOf("FPS 60") !== -1);
});

test("Camera overlay stays in screen space across camera positions and zoom", function () {
  var fixture = makeFixture();
  var panels: Array<{ x: number; y: number; width: number; height: number }> =
    [];
  var fonts: string[] = [];
  var ctx = canvasContext({
    canvas: fixture.config.assets.canvas,
    fillRect: function (x: number, y: number, width: number, height: number) {
      panels.push({ x: x, y: y, width: width, height: height });
    },
    fillText: function () {
      fonts.push(ctx.font);
    },
    save: function () {},
    restore: function () {},
  });
  fixture.config.assets.canvas.width = 640;

  fixture.game.camera.position.x = -200;
  fixture.game.camera.position.y = -300;
  fixture.config.viewport.ratio = 0.1;
  fixture.game.camera.renderOverlay(ctx, 60);
  var firstPanel = panels[0];
  var firstFonts = fonts.slice();

  panels.length = 0;
  fonts.length = 0;
  fixture.game.camera.position.x = 100;
  fixture.game.camera.position.y = 150;
  fixture.config.viewport.ratio = 2;
  fixture.game.camera.renderOverlay(ctx, 60);

  assertEqual(firstPanel.x, 8);
  assertEqual(firstPanel.y, 8);
  assertEqual(firstPanel.width, 176);
  assertEqual(firstPanel.height, 28);
  assertEqual(panels[0].x, firstPanel.x);
  assertEqual(panels[0].y, firstPanel.y);
  assertEqual(panels[0].width, firstPanel.width);
  assertEqual(panels[0].height, firstPanel.height);
  assertEqual(fonts.join("|"), firstFonts.join("|"));
  assertTrue(
    fonts.indexOf('bold 11px "Arial Narrow", Arial, sans-serif') !== -1,
  );
  assertTrue(
    fonts.indexOf('bold 14px "Arial Narrow", Arial, sans-serif') !== -1,
  );
});

test("Camera overlay keeps FPS separate from the top-left score strip", function () {
  var fixture = makeFixture();
  fixture.game.camera.showStats = true;
  var fpsPositions: Array<{ x: number; y: number }> = [];
  var ctx = canvasContext({
    canvas: fixture.config.assets.canvas,
    fillRect: function () {},
    fillText: function (value: string, x: number, y: number) {
      if (value == "FPS 60") fpsPositions.push({ x: x, y: y });
    },
    save: function () {},
    restore: function () {},
  });

  fixture.config.viewport.width = 640;
  fixture.config.assets.canvas.width = 1280;
  fixture.game.camera.renderOverlay(ctx, 60);
  assertEqual(fpsPositions[fpsPositions.length - 1].x, 598);
  assertEqual(fpsPositions[fpsPositions.length - 1].y, 18);

  fpsPositions.length = 0;
  fixture.config.viewport.width = 240;
  fixture.game.camera.renderOverlay(ctx, 60);
  assertEqual(fpsPositions[fpsPositions.length - 1].x, 198);
  assertEqual(fpsPositions[fpsPositions.length - 1].y, 52);
});

test("Camera overlay leaves the panel center translucent", function () {
  var fixture = makeFixture();
  var paints: Array<{
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  var ctx = canvasContext({
    canvas: fixture.config.assets.canvas,
    fillRect: function (x: number, y: number, width: number, height: number) {
      paints.push({
        color: String(ctx.fillStyle),
        x: x,
        y: y,
        width: width,
        height: height,
      });
    },
    fillText: function () {},
    save: function () {},
    restore: function () {},
  });
  fixture.config.assets.canvas.width = 640;

  fixture.game.camera.renderOverlay(ctx, 60);

  var homePanelCenterX = 80;
  var panelCenterY = 22;
  var centerPaints = paints.filter(function (paint) {
    return (
      homePanelCenterX >= paint.x &&
      homePanelCenterX < paint.x + paint.width &&
      panelCenterY >= paint.y &&
      panelCenterY < paint.y + paint.height
    );
  });
  assertEqual(centerPaints.length, 1);
  assertEqual(centerPaints[0].color, "rgba(72, 72, 72, 0.3)");
});
