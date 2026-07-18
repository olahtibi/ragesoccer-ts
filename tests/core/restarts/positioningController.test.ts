import { assertEqual, assertTrue, test } from "../../testlib";
import { makeFixture, type TestFixture } from "../../helpers";
import {
  Vector2 as Vector2d,
  Vector3 as Vector3d,
} from "../../../src/math/vector";
import { vi } from "vitest";

function positioningControllerFor(fixture: TestFixture) {
  return fixture.positioningController;
}

test("PositioningController starts inactive", function () {
  var fixture = makeFixture();
  var controller = positioningControllerFor(fixture);

  assertEqual(controller.isActive(), false);
  assertEqual(controller.isActive(), false);
});

test("PositioningController rejects mismatched player and position counts", function () {
  var fixture = makeFixture({ homeTeamSize: 2, awayTeamSize: 1 });
  var controller = positioningControllerFor(fixture);

  var started = controller.play({
    ballPosition: fixture.config.pitch.initialBallPosition,
    readyPlayer: null,
    sceneTeams: [
      {
        side: "home",
        players: fixture.homePlayers,
        positions: [new Vector2d(100, 100)],
      },
    ],
  });

  assertEqual(started, false);
  assertEqual(controller.isActive(), false);
});

test("PositioningController locks ball and moves players toward explicit targets", function () {
  var fixture = makeFixture({
    homeTeamSize: 1,
    awayTeamSize: 1,
    playerStrength: 10,
  });
  var controller = positioningControllerFor(fixture);
  fixture.ball.position.x = 100;
  fixture.ball.position.y = 200;
  fixture.ball.velocity.x = 90;
  fixture.homePlayers[0].position.x = 100;
  fixture.homePlayers[0].position.y = 100;

  controller.play({
    ballPosition: new Vector3d(334, 433, 0),
    readyPlayer: null,
    sceneTeams: [
      {
        side: "home",
        players: fixture.homePlayers,
        positions: [new Vector2d(120, 100)],
      },
    ],
  });
  controller.update(fixture.game.context());

  assertEqual(fixture.ball.position.x, 334);
  assertEqual(fixture.ball.position.y, 433);
  assertEqual(fixture.ball.velocity.x, 0);
  assertTrue(fixture.homePlayers[0].velocity.x > 0);
});

test("PositioningController waits for players and camera before completing", function () {
  var fixture = makeFixture({ homeTeamSize: 1, awayTeamSize: 1 });
  var game = fixture.game;
  var controller = positioningControllerFor(fixture);
  var cameraArrived = false;
  vi.spyOn(game.camera, "hasArrivedAtFocus").mockImplementation(
    () => cameraArrived,
  );
  fixture.homePlayers[0].position.x = 120;
  fixture.homePlayers[0].position.y = 100;

  controller.play({
    ballPosition: new Vector3d(334, 433, 0),
    readyPlayer: null,
    sceneTeams: [
      {
        side: "home",
        players: fixture.homePlayers,
        positions: [new Vector2d(120, 100)],
      },
    ],
  });

  controller.update(game.context());
  assertEqual(controller.isActive(), true);
  assertTrue(game.camera.focusTarget !== null);

  cameraArrived = true;
  controller.update(game.context());

  assertEqual(controller.isActive(), false);
  assertEqual(game.camera.focusTarget, null);
});

test("PositioningController snaps overshot players to targets", function () {
  var fixture = makeFixture({ homeTeamSize: 1, awayTeamSize: 1 });
  var controller = positioningControllerFor(fixture);
  var target = new Vector2d(120, 100);
  fixture.homePlayers[0].position.x = 120;
  fixture.homePlayers[0].position.y = 96;

  controller.play({
    ballPosition: fixture.config.pitch.initialBallPosition,
    readyPlayer: null,
    sceneTeams: [
      {
        side: "home",
        players: fixture.homePlayers,
        positions: [target],
      },
    ],
  });
  fixture.homePlayers[0].velocity.x = 0;
  fixture.homePlayers[0].velocity.y = -fixture.config.teamVelocity("home");
  controller.updateBeforePhysics(fixture.game.context());

  assertEqual(fixture.homePlayers[0].position.x, target.x);
  assertEqual(fixture.homePlayers[0].position.y, target.y);
  assertEqual(fixture.homePlayers[0].velocity.y, 0);
});

test("PositioningController ignores pre-positioning velocity when moving players to targets", function () {
  var fixture = makeFixture({ homeTeamSize: 1, awayTeamSize: 1 });
  var controller = positioningControllerFor(fixture);
  var target = new Vector2d(120, 100);
  fixture.awayPlayers[0].position.x = 80;
  fixture.awayPlayers[0].position.y = 100;
  fixture.awayPlayers[0].velocity.x = -fixture.config.teamVelocity("away");
  fixture.awayPlayers[0].velocity.y = 0;

  controller.play({
    ballPosition: fixture.config.pitch.initialBallPosition,
    readyPlayer: null,
    sceneTeams: [
      {
        side: "away",
        players: fixture.awayPlayers,
        positions: [target],
      },
    ],
  });
  controller.updateBeforePhysics(fixture.game.context());

  assertEqual(fixture.awayPlayers[0].position.x, 80);
  assertEqual(fixture.awayPlayers[0].position.y, 100);
  assertTrue(fixture.awayPlayers[0].velocity.x > 0);
});

test("PositioningController becomes ready when its taker arrives before other players", function () {
  var fixture = makeFixture({ homeTeamSize: 2, awayTeamSize: 1 });
  var controller = positioningControllerFor(fixture);
  var takerTarget = new Vector2d(120, 100);
  fixture.homePlayers[0].position.x = takerTarget.x;
  fixture.homePlayers[0].position.y = takerTarget.y;
  fixture.homePlayers[1].position.x = 300;
  fixture.homePlayers[1].position.y = 300;

  controller.play({
    ballPosition: fixture.config.pitch.initialBallPosition,
    readyPlayer: fixture.homePlayers[0],
    sceneTeams: [
      {
        side: "home",
        players: fixture.homePlayers,
        positions: [takerTarget, new Vector2d(400, 400)],
      },
    ],
  });

  assertEqual(controller.isReadyForInput(), true);
  assertEqual(controller.isActive(), true);
});

test("Cancelling ready positioning does not snap unfinished players", function () {
  var fixture = makeFixture({ homeTeamSize: 2, awayTeamSize: 1 });
  var controller = positioningControllerFor(fixture);
  var completed = false;
  fixture.homePlayers[0].position.x = 120;
  fixture.homePlayers[0].position.y = 100;
  fixture.homePlayers[1].position.x = 300;
  fixture.homePlayers[1].position.y = 300;

  controller.play({
    ballPosition: fixture.config.pitch.initialBallPosition,
    readyPlayer: fixture.homePlayers[0],
    onComplete: function () {
      completed = true;
    },
    sceneTeams: [
      {
        side: "home",
        players: fixture.homePlayers,
        positions: [new Vector2d(120, 100), new Vector2d(400, 400)],
      },
    ],
  });
  controller.cancel(fixture.game.context());

  assertEqual(controller.isActive(), false);
  assertEqual(fixture.homePlayers[1].position.x, 300);
  assertEqual(fixture.homePlayers[1].position.y, 300);
  assertEqual(completed, false);
});
