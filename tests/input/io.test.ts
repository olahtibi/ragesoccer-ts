import { assertEqual, assertNear, assertTrue, test } from "../testlib";
import {
  completePositioning,
  makeFixture,
  touchEventAt,
  type FixtureOptions,
} from "../helpers";
import { BrowserInput } from "../../src/input/io";
import { Vector2 as Vector2d } from "../../src/math/vector";

function setup(options: FixtureOptions = {}) {
  var fixture = makeFixture(options);
  fixture.game.camera.position.x = 0;
  fixture.game.camera.position.y = 0;
  return {
    fixture: fixture,
    game: fixture.game,
    restartController: fixture.restartController,
    positioningController: fixture.positioningController,
    input: new BrowserInput(fixture.game, window),
  };
}

test("Arrow keys prevent browser scrolling", function () {
  var setupResult = setup();
  var defaultPrevented = false;

  setupResult.input.handleKey({
    keyCode: 40,
    type: "keydown",
    preventDefault: function () {
      defaultPrevented = true;
    },
  });

  assertTrue(defaultPrevented);
});

test("Keyboard input selects and controls the player closest to the ball", function () {
  var setupResult = setup({
    homeTeamSize: 2,
    awayTeamSize: 1,
    playerStrength: 10,
  });
  var fixture = setupResult.fixture;
  fixture.ball.position.x = fixture.homePlayers[1].position.x;
  fixture.ball.position.y = fixture.homePlayers[1].position.y;

  setupResult.input.handleKey({ keyCode: 39, type: "keydown" });

  assertTrue(fixture.homeTeam.humanPlayer === fixture.homePlayers[1]);
  assertEqual(
    fixture.homePlayers[1].velocity.x,
    fixture.config.teamVelocity("home"),
  );
});

test("Human selection keeps the current player within the hysteresis margin", function () {
  var setupResult = setup({ homeTeamSize: 2, awayTeamSize: 1 });
  var fixture = setupResult.fixture;
  fixture.config.input.humanSwitchHysteresisDistance = 20;
  fixture.homePlayers[0].position.x = 100;
  fixture.homePlayers[1].position.x = 112;
  fixture.homePlayers[0].position.y = fixture.homePlayers[1].position.y = 100;
  fixture.ball.position.x = 120;
  fixture.ball.position.y = 100;
  fixture.game.humanController.selectPlayer(fixture.homePlayers[0]);

  fixture.game.humanController.selectPlayer();

  assertTrue(fixture.homeTeam.humanPlayer === fixture.homePlayers[0]);
});

test("Human selection switches and stops the old player outside hysteresis", function () {
  var setupResult = setup({ homeTeamSize: 2, awayTeamSize: 1 });
  var fixture = setupResult.fixture;
  fixture.config.input.humanSwitchHysteresisDistance = 20;
  fixture.homePlayers[0].position.x = 100;
  fixture.homePlayers[1].position.x = 140;
  fixture.homePlayers[0].position.y = fixture.homePlayers[1].position.y = 100;
  fixture.game.humanController.selectPlayer(fixture.homePlayers[0]);
  fixture.homePlayers[0].velocity.x = 10;
  fixture.ball.position.x = 140;
  fixture.ball.position.y = 100;

  fixture.game.humanController.selectPlayer();

  assertTrue(fixture.homeTeam.humanPlayer === fixture.homePlayers[1]);
  assertEqual(fixture.homePlayers[0].velocity.x, 0);
});

test("Human selection prioritizes an intended pass receiver", function () {
  var fixture = makeFixture({ homeTeamSize: 2, awayTeamSize: 1 });
  fixture.game.humanController.selectPlayer(fixture.homePlayers[0]);
  fixture.ball.position.x = fixture.homePlayers[0].position.x;
  fixture.ball.position.y = fixture.homePlayers[0].position.y;
  fixture.ball.intendedReceiver = fixture.homePlayers[1];

  fixture.game.humanController.selectPlayer();

  assertTrue(fixture.homeTeam.humanPlayer === fixture.homePlayers[1]);
});

test("Keyboard diagonal input normalizes velocity", function () {
  var setupResult = setup({ playerStrength: 10 });
  setupResult.input.handleKey({ keyCode: 39, type: "keydown" });
  setupResult.input.handleKey({ keyCode: 40, type: "keydown" });

  assertNear(
    setupResult.fixture.playerHome.velocity.x,
    setupResult.fixture.config.teamVelocity("home") / Math.sqrt(2),
    0.0001,
  );
  assertNear(
    setupResult.fixture.playerHome.velocity.y,
    setupResult.fixture.config.teamVelocity("home") / Math.sqrt(2),
    0.0001,
  );
});

test("Touch input stores a world target and controls the selected player", function () {
  var setupResult = setup({
    homeTeamSize: 2,
    awayTeamSize: 1,
    playerStrength: 10,
  });
  var fixture = setupResult.fixture;
  fixture.ball.position.x = fixture.homePlayers[1].position.x;
  fixture.ball.position.y = fixture.homePlayers[1].position.y;
  var scale = fixture.config.computeScaleBy();

  setupResult.input.handleTouch(
    touchEventAt(
      fixture.homePlayers[1].position.x * scale,
      (fixture.homePlayers[1].position.y + 50) * scale,
    ),
  );

  assertTrue(fixture.homeTeam.humanPlayer === fixture.homePlayers[1]);
  assertTrue(fixture.game.humanController.touchTarget !== null);
  assertNear(
    fixture.game.humanController.touchTarget.y,
    fixture.homePlayers[1].position.y + 50,
    0.0001,
  );
  assertTrue(fixture.homePlayers[1].velocity.y > 0);
});

test("Opponent kickoff ignores input and starts after its configured delay", function () {
  var setupResult = setup({ kickoffSide: "away" });

  setupResult.input.handleKey({ keyCode: 39, type: "keydown" });

  assertEqual(setupResult.restartController.phase(), "waitingForInput");
  assertEqual(setupResult.fixture.playerHome.velocity.x, 0);

  setupResult.fixture.physics.lastDt = 0.5;
  setupResult.restartController.updateAfterPhysics(
    setupResult.game.context(),
    0.5,
  );
  assertEqual(setupResult.restartController.phase(), "waitingForInput");

  setupResult.fixture.physics.lastDt = 0.5;
  setupResult.restartController.updateAfterPhysics(
    setupResult.game.context(),
    0.5,
  );
  assertEqual(setupResult.restartController.phase(), "inProgress");
});

test("Keyboard outward direction does not execute a human throw-in", function () {
  var setupResult = setup();
  setupResult.game.beginRestart({
    type: "throwIn",
    awardedTo: "home",
    boundary: "left",
    position: new Vector2d(
      setupResult.fixture.config.pitch.fieldLeft,
      setupResult.fixture.config.pitch.aiCenterY,
    ),
  });
  completePositioning(setupResult.fixture);

  setupResult.input.handleKey({ keyCode: 37, type: "keydown" });

  assertEqual(setupResult.restartController.phase(), "waitingForInput");
  assertTrue(setupResult.fixture.ball.heldBy !== null);
  assertEqual(setupResult.fixture.ball.velocity.x, 0);
});

test("Keyboard inward direction throws straight across the field", function () {
  var setupResult = setup();
  setupResult.game.beginRestart({
    type: "throwIn",
    awardedTo: "home",
    boundary: "left",
    position: new Vector2d(
      setupResult.fixture.config.pitch.fieldLeft,
      setupResult.fixture.config.pitch.aiCenterY,
    ),
  });
  completePositioning(setupResult.fixture);

  setupResult.input.handleKey({ keyCode: 39, type: "keydown" });

  assertEqual(setupResult.restartController.phase(), "inProgress");
  assertTrue(setupResult.fixture.ball.velocity.x > 0);
  assertEqual(setupResult.fixture.ball.velocity.y, 0);
});

test("Keyboard up direction throws diagonally up and inward", function () {
  var setupResult = setup();
  setupResult.game.beginRestart({
    type: "throwIn",
    awardedTo: "home",
    boundary: "left",
    position: new Vector2d(
      setupResult.fixture.config.pitch.fieldLeft,
      setupResult.fixture.config.pitch.aiCenterY,
    ),
  });
  completePositioning(setupResult.fixture);

  setupResult.input.handleKey({ keyCode: 38, type: "keydown" });

  assertTrue(setupResult.fixture.ball.velocity.x > 0);
  assertTrue(setupResult.fixture.ball.velocity.y < 0);
  assertNear(
    Math.abs(setupResult.fixture.ball.velocity.x),
    Math.abs(setupResult.fixture.ball.velocity.y),
    0.0001,
  );
  assertEqual(setupResult.fixture.boundaryDetector.update(), null);
});

test("Keyboard down direction throws diagonally down and inward", function () {
  var setupResult = setup();
  setupResult.game.beginRestart({
    type: "throwIn",
    awardedTo: "home",
    boundary: "right",
    position: new Vector2d(
      setupResult.fixture.config.pitch.fieldRight,
      setupResult.fixture.config.pitch.aiCenterY,
    ),
  });
  completePositioning(setupResult.fixture);

  setupResult.input.handleKey({ keyCode: 40, type: "keydown" });

  assertTrue(setupResult.fixture.ball.velocity.x < 0);
  assertTrue(setupResult.fixture.ball.velocity.y > 0);
  assertNear(
    Math.abs(setupResult.fixture.ball.velocity.x),
    Math.abs(setupResult.fixture.ball.velocity.y),
    0.0001,
  );
  assertEqual(setupResult.fixture.boundaryDetector.update(), null);
});

test("Touch direction executes a human throw-in and clamps it inward", function () {
  var setupResult = setup();
  setupResult.game.beginRestart({
    type: "throwIn",
    awardedTo: "home",
    boundary: "right",
    position: new Vector2d(
      setupResult.fixture.config.pitch.fieldRight,
      setupResult.fixture.config.pitch.aiCenterY,
    ),
  });
  completePositioning(setupResult.fixture);
  var scale = setupResult.fixture.config.computeScaleBy();

  setupResult.input.handleTouch(
    touchEventAt(
      (setupResult.fixture.config.pitch.fieldRight + 100) * scale,
      setupResult.fixture.config.pitch.aiCenterY * scale,
    ),
  );

  assertEqual(setupResult.restartController.phase(), "inProgress");
  assertTrue(setupResult.fixture.ball.velocity.x < 0);
});

test("Touch executes when the home taker is ready without waiting for receiver", function () {
  var setupResult = setup({ homeTeamSize: 4, awayTeamSize: 4 });
  setupResult.game.beginRestart({
    type: "throwIn",
    awardedTo: "home",
    boundary: "right",
    position: new Vector2d(
      setupResult.fixture.config.pitch.fieldRight,
      setupResult.fixture.config.pitch.aiCenterY,
    ),
  });
  var controller = setupResult.positioningController;
  var readyPlayer = controller.readyPlayer();
  var placements = controller.placements();
  assertTrue(readyPlayer !== null && placements !== null);
  var receiverPlacement = null;
  var closestReceiverDistance = Infinity;
  var ballPosition = controller.ballPosition();
  assertTrue(ballPosition !== null);
  for (const side of ["home", "away"] as const) {
    for (const placement of placements[side]) {
      if (placement.player === readyPlayer) {
        readyPlayer.placeAt(placement.target);
      } else if (side == "home") {
        var dx = placement.target.x - ballPosition.x;
        var dy = placement.target.y - ballPosition.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < closestReceiverDistance) {
          receiverPlacement = placement;
          closestReceiverDistance = distance;
        }
      }
    }
  }
  var scale = setupResult.fixture.config.computeScaleBy();

  setupResult.input.handleTouch(
    touchEventAt(
      (setupResult.fixture.config.pitch.fieldRight + 100) * scale,
      setupResult.fixture.config.pitch.aiCenterY * scale,
    ),
  );

  assertEqual(setupResult.restartController.phase(), "inProgress");
  assertEqual(controller.isActive(), false);
  assertTrue(receiverPlacement !== null);
  assertTrue(
    setupResult.fixture.ball.intendedReceiver === receiverPlacement.player,
  );
  assertTrue(
    setupResult.fixture.homeTeam.humanPlayer === receiverPlacement.player,
  );
  assertEqual(setupResult.fixture.game.humanController.touchTarget, null);
  assertTrue(setupResult.fixture.ball.velocity.x < 0);
});

test("J and K do not start restarts", function () {
  var setupResult = setup();

  setupResult.input.handleKey({ keyCode: 74, type: "keydown" });
  setupResult.input.handleKey({ keyCode: 75, type: "keydown" });

  assertEqual(setupResult.restartController.phase(), "waitingForInput");
  assertEqual(setupResult.positioningController.isActive(), false);
});

test("C awards a home corner on the ball side when debugging is enabled", function () {
  var setupResult = setup();
  setupResult.fixture.config.debug.enabled = true;
  setupResult.restartController.clear();
  setupResult.game.matchFlow.enterNormalPlayForTesting();
  setupResult.fixture.ball.position.x =
    setupResult.fixture.config.pitch.fieldRight - 20;

  setupResult.input.handleKey({ keyCode: 67, type: "keydown" });

  assertEqual(setupResult.restartController.type(), "corner");
  assertEqual(setupResult.restartController.phase(), "positioning");
  var ballPosition = setupResult.positioningController.ballPosition();
  assertTrue(ballPosition !== null);
  assertEqual(
    ballPosition.x,
    setupResult.fixture.config.pitch.fieldRight -
      setupResult.fixture.config.ball.radius -
      setupResult.fixture.config.restarts.placementClearance,
  );
  assertEqual(
    ballPosition.y,
    setupResult.fixture.config.pitch.fieldTop +
      setupResult.fixture.config.ball.radius +
      setupResult.fixture.config.restarts.placementClearance,
  );
});

test("T awards a home throw-in on the nearest touchline", function () {
  var setupResult = setup({ homeTeamSize: 4, awayTeamSize: 4 });
  setupResult.fixture.config.debug.enabled = true;
  setupResult.restartController.clear();
  setupResult.game.matchFlow.enterNormalPlayForTesting();
  setupResult.fixture.ball.position.x =
    setupResult.fixture.config.pitch.fieldRight - 20;
  setupResult.fixture.ball.position.y =
    setupResult.fixture.config.pitch.aiCenterY + 50;

  setupResult.input.handleKey({ keyCode: 84, type: "keydown" });

  assertEqual(setupResult.restartController.type(), "throwIn");
  assertEqual(setupResult.restartController.phase(), "positioning");
  assertEqual(setupResult.restartController.teamAiState("home"), "throwInUs");
  var ballPosition = setupResult.positioningController.ballPosition();
  assertTrue(ballPosition !== null);
  assertEqual(
    ballPosition.x,
    setupResult.fixture.config.pitch.fieldRight -
      setupResult.fixture.config.ball.radius -
      setupResult.fixture.config.restarts.placementClearance,
  );
  assertEqual(ballPosition.y, setupResult.fixture.config.pitch.aiCenterY + 50);
});

test("C corner diagnostic is disabled when debugging is disabled", function () {
  var setupResult = setup();
  setupResult.fixture.config.debug.enabled = false;
  setupResult.restartController.clear();
  setupResult.game.matchFlow.enterNormalPlayForTesting();

  setupResult.input.handleKey({ keyCode: 67, type: "keydown" });

  assertEqual(setupResult.restartController.type(), null);
  assertEqual(setupResult.positioningController.isActive(), false);
});

test("T throw-in diagnostic is disabled when debugging is disabled", function () {
  var setupResult = setup();
  setupResult.fixture.config.debug.enabled = false;
  setupResult.restartController.clear();
  setupResult.game.matchFlow.enterNormalPlayForTesting();

  setupResult.input.handleKey({ keyCode: 84, type: "keydown" });

  assertEqual(setupResult.restartController.type(), null);
  assertEqual(setupResult.positioningController.isActive(), false);
});

test("Restart positioning selects the newly closest human player on completion", function () {
  var setupResult = setup({
    homeTeamSize: 4,
    awayTeamSize: 4,
    kickoffSide: "away",
  });
  setupResult.game.beginRestart({ type: "kickoff", awardedTo: "home" });
  var controller = setupResult.positioningController;
  var placements = controller.placements();
  assertTrue(placements !== null);
  for (const placement of placements.home) {
    placement.player.placeAt(placement.target);
  }

  completePositioning(setupResult.fixture);

  assertTrue(
    setupResult.fixture.homeTeam.humanPlayer ===
      setupResult.fixture.homePlayers[3],
  );
});

test("Slash pauses and resumes while preserving restart positioning", function () {
  var setupResult = setup();
  setupResult.fixture.config.debug.enabled = true;
  setupResult.game.debugTool.dump = function () {};
  setupResult.game.beginRestart({ type: "kickoff", awardedTo: "home" });

  setupResult.input.handleKey({ keyCode: 191, type: "keydown" });
  assertEqual(setupResult.game.matchFlow.snapshot().kind, "paused");

  setupResult.input.handleKey({ keyCode: 191, type: "keydown" });
  assertEqual(setupResult.game.matchFlow.snapshot().kind, "restart");
  assertEqual(setupResult.restartController.phase(), "positioning");
});

test("Slash is disabled when debug logging is disabled", function () {
  var setupResult = setup();
  setupResult.fixture.config.debug.enabled = false;

  setupResult.input.handleKey({ keyCode: 191, type: "keydown" });

  assertEqual(setupResult.game.isPaused(), false);
});

test("Input events are recorded only when debugging is enabled", function () {
  var setupResult = setup();
  setupResult.fixture.config.debug.enabled = false;
  setupResult.input.handleKey({ keyCode: 39, type: "keydown" });
  assertEqual(setupResult.game.debugTool.events.length, 0);

  setupResult.fixture.config.debug.enabled = true;
  setupResult.input.handleKey({ keyCode: 39, type: "keyup" });
  assertEqual(setupResult.game.debugTool.events.length, 1);
  assertEqual(setupResult.game.debugTool.events[0].type, "keyup");
});

test("Touch debug events use world coordinates", function () {
  var setupResult = setup();
  setupResult.fixture.config.debug.enabled = true;
  setupResult.game.camera.position.x = -10;
  setupResult.game.camera.position.y = -20;
  var scale = setupResult.fixture.config.computeScaleBy();

  setupResult.input.handleTouch(touchEventAt(30 * scale, 40 * scale));

  assertTrue(setupResult.game.debugTool.events[0].target !== undefined);
  assertEqual(setupResult.game.debugTool.events[0].target.x, 40);
  assertEqual(setupResult.game.debugTool.events[0].target.y, 60);
});

test("Q and W change the viewport ratio", function () {
  var setupResult = setup();
  var ratio = setupResult.fixture.config.viewport.ratio;
  setupResult.input.handleKey({ keyCode: 81, type: "keydown" });
  assertEqual(setupResult.fixture.config.viewport.ratio, ratio / 1.2);
  setupResult.input.handleKey({ keyCode: 87, type: "keydown" });
  assertNear(setupResult.fixture.config.viewport.ratio, ratio, 0.0001);
});
