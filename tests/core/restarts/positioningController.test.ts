import { assertEqual, assertTrue, test } from "../../testlib";
import { makeFixture, type TestFixture } from "../../helpers";
import {
  Vector2 as Vector2d,
  Vector3 as Vector3d,
} from "../../../src/math/vector";
import type { Vector2 } from "../../../src/math/vector";
import type { Player } from "../../../src/world/player";
import { vi } from "vitest";

function play(
  fixture: TestFixture,
  side: "home" | "away",
  targets: Vector2[],
  readyPlayer: Player | null = null,
  onComplete: () => void = function () {},
): void {
  var players = side == "home" ? fixture.homePlayers : fixture.awayPlayers;
  fixture.positioningController.play({
    ballPosition: new Vector3d(334, 433, 0),
    readyPlayer: readyPlayer,
    placements: {
      home:
        side == "home"
          ? players.map((player, index) => ({ player, target: targets[index] }))
          : [],
      away:
        side == "away"
          ? players.map((player, index) => ({ player, target: targets[index] }))
          : [],
    },
    onComplete: onComplete,
  });
}

test("PositioningController starts inactive", function () {
  var fixture = makeFixture();
  assertEqual(fixture.positioningController.isActive(), false);
  assertEqual(fixture.positioningController.placements(), null);
});

test("PositioningController throws when placement team identity is invalid", function () {
  var fixture = makeFixture();
  var threw = false;
  try {
    fixture.positioningController.play({
      ballPosition: fixture.config.pitch.initialBallPosition,
      readyPlayer: null,
      placements: {
        home: [{ player: fixture.playerAway, target: new Vector2d(100, 100) }],
        away: [],
      },
      onComplete: function () {},
    });
  } catch {
    threw = true;
  }
  assertEqual(threw, true);
  assertEqual(fixture.positioningController.isActive(), false);
});

test("PositioningController locks ball and moves players toward explicit targets", function () {
  var fixture = makeFixture({ playerStrength: 10 });
  fixture.ball.placeAt(new Vector3d(100, 200, 0));
  fixture.ball.velocity.x = 90;
  fixture.playerHome.placeAt(new Vector2d(100, 100));

  play(fixture, "home", [new Vector2d(120, 100)]);
  fixture.positioningController.update(fixture.game.context());

  assertEqual(fixture.ball.position.x, 334);
  assertEqual(fixture.ball.position.y, 433);
  assertEqual(fixture.ball.velocity.x, 0);
  assertTrue(fixture.playerHome.velocity.x > 0);
});

test("PositioningController waits for players and camera before completing", function () {
  var fixture = makeFixture();
  var cameraArrived = false;
  vi.spyOn(fixture.game.camera, "hasArrivedAtFocus").mockImplementation(
    () => cameraArrived,
  );
  fixture.playerHome.placeAt(new Vector2d(120, 100));
  play(fixture, "home", [new Vector2d(120, 100)]);

  fixture.positioningController.update(fixture.game.context());
  assertEqual(fixture.positioningController.isActive(), true);
  cameraArrived = true;
  fixture.positioningController.update(fixture.game.context());

  assertEqual(fixture.positioningController.isActive(), false);
  assertEqual(fixture.game.camera.focusTarget, null);
});

test("PositioningController snaps overshot players to targets", function () {
  var fixture = makeFixture();
  var target = new Vector2d(120, 100);
  fixture.playerHome.placeAt(new Vector2d(120, 96));
  play(fixture, "home", [target]);
  fixture.playerHome.velocity.y = -fixture.config.teamVelocity("home");

  fixture.positioningController.updateBeforePhysics(fixture.game.context());

  assertEqual(fixture.playerHome.position.x, target.x);
  assertEqual(fixture.playerHome.position.y, target.y);
  assertEqual(fixture.playerHome.velocity.y, 0);
});

test("PositioningController clears pre-positioning velocity", function () {
  var fixture = makeFixture();
  var target = new Vector2d(120, 100);
  fixture.playerAway.placeAt(new Vector2d(80, 100));
  fixture.playerAway.velocity.x = -fixture.config.teamVelocity("away");

  play(fixture, "away", [target]);
  fixture.positioningController.updateBeforePhysics(fixture.game.context());

  assertEqual(fixture.playerAway.position.x, 80);
  assertTrue(fixture.playerAway.velocity.x > 0);
});

test("PositioningController is ready when its taker arrives first", function () {
  var fixture = makeFixture({ homeTeamSize: 2 });
  var takerTarget = new Vector2d(120, 100);
  fixture.homePlayers[0].placeAt(takerTarget);
  fixture.homePlayers[1].placeAt(new Vector2d(300, 300));

  play(
    fixture,
    "home",
    [takerTarget, new Vector2d(400, 400)],
    fixture.homePlayers[0],
  );

  assertEqual(fixture.positioningController.isReadyForInput(), true);
  assertEqual(
    fixture.positioningController.readyPlayer(),
    fixture.homePlayers[0],
  );
});

test("PositioningController waits for additional required players", function () {
  var fixture = makeFixture({ homeTeamSize: 2 });
  var takerTarget = new Vector2d(120, 100);
  var receiverTarget = new Vector2d(150, 100);
  fixture.homePlayers[0].placeAt(takerTarget);
  fixture.homePlayers[1].placeAt(new Vector2d(300, 300));
  fixture.positioningController.play({
    ballPosition: new Vector3d(334, 433, 0),
    readyPlayer: fixture.homePlayers[0],
    additionalReadyPlayers: [fixture.homePlayers[1]],
    placements: {
      home: [
        { player: fixture.homePlayers[0], target: takerTarget },
        { player: fixture.homePlayers[1], target: receiverTarget },
      ],
      away: [],
    },
    onComplete: function () {},
  });

  assertEqual(fixture.positioningController.isReadyForInput(), false);
  fixture.homePlayers[1].placeAt(receiverTarget);
  assertEqual(fixture.positioningController.isReadyForInput(), true);
});

test("Cancelling ready positioning does not snap unfinished players", function () {
  var fixture = makeFixture({ homeTeamSize: 2 });
  var completed = false;
  fixture.homePlayers[0].placeAt(new Vector2d(120, 100));
  fixture.homePlayers[1].placeAt(new Vector2d(300, 300));

  play(
    fixture,
    "home",
    [new Vector2d(120, 100), new Vector2d(400, 400)],
    fixture.homePlayers[0],
    function () {
      completed = true;
    },
  );
  fixture.positioningController.cancel(fixture.game.context());

  assertEqual(fixture.positioningController.isActive(), false);
  assertEqual(fixture.homePlayers[1].position.x, 300);
  assertEqual(completed, false);
});
