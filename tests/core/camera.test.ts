import { assertEqual, assertNear, assertTrue, test } from "../testlib";
import { canvasContext, makeFixture } from "../helpers";
import { Camera } from "../../src/core/camera";
import { Vector2 as Vector2d } from "../../src/math/vector";

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
  camera.setFocusTarget(new Vector2d(334, 433));
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
    fixture.config.viewport.width / 2 - 334,
    fixture.config.viewport.height / 2 - 433,
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
    restore: function () {},
  });

  fixture.game.camera.renderOverlay(ctx, 60);

  assertEqual(labels[0], "2");
  assertEqual(labels[1], "2");
  assertTrue(labels.indexOf("1") !== -1);
  assertTrue(labels.indexOf("FPS: 60") !== -1);
});
