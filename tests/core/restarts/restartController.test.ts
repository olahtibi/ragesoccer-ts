import { assertEqual, assertNear, assertTrue, test } from "../../testlib";
import {
  advancePhysics,
  completePositioning,
  makeFixture,
  updateTeamAis,
} from "../../helpers";
import { Formation } from "../../../src/ai/formation";
import { CornerFormation } from "../../../src/ai/cornerFormation";
import { CornerRestart } from "../../../src/core/restarts/cornerRestart";
import { GoalKickRestart } from "../../../src/core/restarts/goalKickRestart";
import { KickoffRestart } from "../../../src/core/restarts/kickoffRestart";
import { RestartRegistry } from "../../../src/core/restarts/restartRegistry";
import { ThrowInRestart } from "../../../src/core/restarts/throwInRestart";
import { math as MathLib } from "../../../src/math/math";
import { Vector2 as Vector2d } from "../../../src/math/vector";
import type { Vector2 } from "../../../src/math/vector";
import type { Configuration } from "../../../src/core/configuration";
import type { PositioningController } from "../../../src/core/restarts/positioningController";
import type { Player } from "../../../src/world/player";
import type {
  PlayerPlacement,
  RestartRequest,
  RestartStrategy,
} from "../../../src/types";

function ellipseDistance(config: Configuration, position: Vector2): number {
  var dx = position.x - config.pitch.initialBallPosition.x;
  var dy = position.y - config.pitch.aiCenterY;
  return (
    (dx * dx) /
      (config.pitch.centerCircleRadiusX * config.pitch.centerCircleRadiusX) +
    (dy * dy) /
      (config.pitch.centerCircleRadiusY * config.pitch.centerCircleRadiusY)
  );
}

function positioningTargetForPlayer(
  controller: PositioningController,
  player: Player | null,
): Vector2 | null {
  if (player === null) return null;
  var placements = controller.placements();
  if (placements === null) return null;
  for (const side of ["home", "away"] as const) {
    for (const placement of placements[side]) {
      if (placement.player === player) {
        return placement.target;
      }
    }
  }
  return null;
}

function throwInReceiverPlacement(
  controller: PositioningController,
  taker: Player,
): PlayerPlacement {
  var placements = required(controller.placements())[taker.teamSide];
  var ballPosition = required(controller.ballPosition());
  var receiver: PlayerPlacement | null = null;
  var closestDistance = Infinity;
  for (const placement of placements) {
    if (placement.player === taker) continue;
    var distance = MathLib.computeDistance(placement.target, ballPosition);
    if (distance < closestDistance) {
      receiver = placement;
      closestDistance = distance;
    }
  }
  return required(receiver);
}

function required<T>(value: T | null | undefined): T {
  assertTrue(value != null);
  return value;
}

test("RestartRegistry resolves strategies by generic type", function () {
  var registry = new RestartRegistry();
  var strategy: RestartStrategy = new ThrowInRestart(makeFixture().config);
  registry.register("throwIn", strategy);

  assertTrue(registry.get("throwIn") === strategy);
  assertEqual(registry.get("corner"), null);
});

test("Initial kickoff positions immediately and waits for input", function () {
  var fixture = makeFixture();

  assertEqual(fixture.game.matchFlow.snapshot().kind, "restart");
  assertEqual(fixture.restartController.type(), "kickoff");
  assertEqual(fixture.restartController.phase(), "waitingForInput");
  assertEqual(fixture.positioningController.isActive(), false);
  assertTrue(
    fixture.game.humanController.player() ===
      fixture.restartController.taker("home"),
  );
  assertEqual(fixture.game.matchFlow.simulationMode(), "none");
});

test("Restart positioning progresses through waiting and in-progress phases", function () {
  var fixture = makeFixture({ homeTeamSize: 1, awayTeamSize: 1 });
  fixture.game.beginRestart({ type: "kickoff", awardedTo: "home" });

  assertEqual(fixture.restartController.phase(), "positioning");
  assertEqual(fixture.game.matchFlow.simulationMode(), "playersOnly");

  completePositioning(fixture);
  assertEqual(fixture.restartController.phase(), "waitingForInput");

  fixture.game.resumeFromInput(null);
  assertEqual(fixture.restartController.phase(), "inProgress");
  assertEqual(fixture.game.matchFlow.simulationMode(), "full");
});

test("Beginning a restart clears keyboard touch and controlled-player velocity", function () {
  var fixture = makeFixture();
  var humanPlayer = required(fixture.homeTeam.humanPlayer);
  fixture.game.humanController.setKey(39, true);
  fixture.game.humanController.setTouchTarget(new Vector2d(400, 400));
  humanPlayer.velocity.x = 10;
  humanPlayer.velocity.y = -10;

  fixture.game.beginRestart({ type: "kickoff", awardedTo: "away" });

  assertEqual(fixture.game.humanController.keys[39], undefined);
  assertEqual(fixture.game.humanController.touchTarget, null);
  assertEqual(humanPlayer.velocity.x, 0);
  assertEqual(humanPlayer.velocity.y, 0);
});

test("Goal kick can start when its taker arrives while teammates are still positioning", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.game.beginRestart({
    type: "goalKick",
    awardedTo: "home",
    boundary: "bottom",
  });
  var controller = fixture.positioningController;
  var taker = required(controller.readyPlayer());
  var target = required(positioningTargetForPlayer(controller, taker));
  var unfinished = fixture.homePlayers[3];
  var designatedTarget = required(
    positioningTargetForPlayer(controller, unfinished),
  );
  unfinished.position.x = fixture.config.pitch.fieldLeft;
  unfinished.position.y = fixture.config.pitch.aiCenterY;
  var unfinishedX = unfinished.position.x;
  var unfinishedY = unfinished.position.y;

  assertEqual(fixture.game.resumeFromInput(new Vector2d(0, -1)), false);
  taker.position.x = target.x;
  taker.position.y = target.y;
  assertEqual(fixture.game.resumeFromInput(new Vector2d(0, -1)), true);

  assertEqual(fixture.restartController.phase(), "inProgress");
  assertEqual(controller.isActive(), false);
  assertEqual(unfinished.position.x, unfinishedX);
  assertEqual(unfinished.position.y, unfinishedY);

  updateTeamAis(fixture);
  var targetAfterRelease = required(
    fixture.homeTeamAi.debugSnapshot()[3].target,
  );
  assertEqual(targetAfterRelease.x, designatedTarget.x);
  assertEqual(targetAfterRelease.y, designatedTarget.y);
});

test("Early home restart selects the designated taker over a closer teammate", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.game.beginRestart({
    type: "goalKick",
    awardedTo: "home",
    boundary: "bottom",
  });
  var controller = fixture.positioningController;
  var taker = required(controller.readyPlayer());
  var target = required(positioningTargetForPlayer(controller, taker));
  var ballPosition = required(controller.ballPosition());
  taker.position.x = target.x;
  taker.position.y = target.y;
  fixture.homePlayers[1].position.x = ballPosition.x;
  fixture.homePlayers[1].position.y = ballPosition.y;

  fixture.game.resumeFromInput(new Vector2d(0, -1));

  assertTrue(fixture.homeTeam.humanPlayer === taker);
});

test("Away corner waits for the configured delay after its taker is ready", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.game.beginRestart({
    type: "corner",
    awardedTo: "away",
    boundary: "bottom",
    position: new Vector2d(
      fixture.config.pitch.fieldRight,
      fixture.config.pitch.fieldBottom,
    ),
  });
  var controller = fixture.positioningController;
  var readyPlayer = required(controller.readyPlayer());
  var target = required(positioningTargetForPlayer(controller, readyPlayer));
  readyPlayer.position.x = target.x;
  readyPlayer.position.y = target.y;

  assertEqual(fixture.game.resumeFromInput(new Vector2d(0, -1)), false);

  fixture.game.physics.lastDt = 0.4;
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertEqual(fixture.restartController.phase(), "positioning");

  fixture.game.physics.lastDt = 0.6;
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertEqual(fixture.restartController.phase(), "inProgress");
  assertEqual(controller.isActive(), false);
});

test("Opponent restart delay continues after every player finishes positioning", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.game.beginRestart({
    type: "throwIn",
    awardedTo: "away",
    boundary: "right",
    position: new Vector2d(
      fixture.config.pitch.fieldRight,
      fixture.config.pitch.aiCenterY,
    ),
  });
  completePositioning(fixture);

  assertEqual(fixture.restartController.phase(), "waitingForInput");
  assertEqual(fixture.game.matchFlow.simulationMode(), "playersOnly");

  fixture.game.physics.lastDt = 0.5;
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );
  assertEqual(fixture.restartController.phase(), "waitingForInput");

  fixture.game.physics.lastDt = 0.5;
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );
  assertEqual(fixture.restartController.phase(), "inProgress");
  assertTrue(fixture.ball.velocity.z > 0);
});

test("Away kickoff delay starts only after every player finishes positioning", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.game.beginRestart({ type: "kickoff", awardedTo: "away" });
  var controller = fixture.positioningController;
  var readyPlayer = required(controller.readyPlayer());
  var takerTarget = required(
    positioningTargetForPlayer(controller, readyPlayer),
  );
  readyPlayer.position.x = takerTarget.x;
  readyPlayer.position.y = takerTarget.y;

  fixture.game.physics.lastDt = 1;
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );
  assertEqual(fixture.restartController.phase(), "positioning");
  assertEqual(fixture.game.resumeFromInput(new Vector2d(0, -1)), false);

  completePositioning(fixture);
  assertEqual(fixture.restartController.phase(), "waitingForInput");

  fixture.game.physics.lastDt = 0.6;
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );
  assertEqual(fixture.restartController.phase(), "waitingForInput");

  fixture.game.physics.lastDt = 0.4;
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );
  assertEqual(fixture.restartController.phase(), "inProgress");
});

test("Early away goal kick keeps the goalkeeper as designated taker", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.config.restarts.opponentDelaySeconds = 0;
  fixture.game.beginRestart({
    type: "goalKick",
    awardedTo: "away",
    boundary: "top",
  });
  var controller = fixture.positioningController;
  var readyPlayer = required(controller.readyPlayer());
  var target = required(positioningTargetForPlayer(controller, readyPlayer));
  var ballPosition = required(controller.ballPosition());
  readyPlayer.position.x = target.x;
  readyPlayer.position.y = target.y;
  fixture.awayPlayers[1].position.x = ballPosition.x;
  fixture.awayPlayers[1].position.y = ballPosition.y;

  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );
  updateTeamAis(fixture);

  assertEqual(fixture.awayTeamAi.debugSnapshot()[0].command, "attackBall");
  assertEqual(fixture.awayTeamAi.debugSnapshot()[1].command, "moveToPosition");
});

test("Away throw-in waits for its taker and receiver before launching", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.config.restarts.opponentDelaySeconds = 0;
  fixture.game.beginRestart({
    type: "throwIn",
    awardedTo: "away",
    boundary: "right",
    position: new Vector2d(
      fixture.config.pitch.fieldRight,
      fixture.config.pitch.aiCenterY,
    ),
  });
  var controller = fixture.positioningController;
  var readyPlayer = required(controller.readyPlayer());
  var target = required(positioningTargetForPlayer(controller, readyPlayer));
  var receiver = throwInReceiverPlacement(controller, readyPlayer);
  readyPlayer.position.x = target.x;
  readyPlayer.position.y = target.y;

  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertEqual(fixture.restartController.phase(), "positioning");
  receiver.player.placeAt(receiver.target);
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertEqual(fixture.restartController.phase(), "inProgress");
  assertTrue(fixture.ball.velocity.x < 0);
  assertTrue(fixture.ball.velocity.z > 0);
  assertEqual(fixture.ball.lastTouchedBy, "away");
});

test("Throw-in positions a close receiver on an inward attacking diagonal", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.game.beginRestart({
    type: "throwIn",
    awardedTo: "home",
    boundary: "left",
    position: new Vector2d(
      fixture.config.pitch.fieldLeft,
      fixture.config.pitch.aiCenterY,
    ),
  });
  var controller = fixture.positioningController;
  var taker = required(controller.readyPlayer());
  var receiver = throwInReceiverPlacement(controller, taker);
  var ballPosition = required(controller.ballPosition());

  assertTrue(receiver.player !== taker);
  assertNear(
    MathLib.computeDistance(receiver.target, ballPosition),
    fixture.config.restarts.throwInReceiverDistance,
    0.0001,
  );
  assertTrue(receiver.target.x > ballPosition.x);
  assertTrue(receiver.target.y < ballPosition.y);
});

test("Throw-in selects the closest non-goalkeeper receiver", function () {
  var fixture = makeFixture({ homeTeamSize: 3, awayTeamSize: 3 });
  var throwPosition = new Vector2d(
    fixture.config.pitch.fieldLeft,
    fixture.config.pitch.aiCenterY,
  );
  fixture.homePlayers[2].placeAt(
    new Vector2d(
      throwPosition.x +
        fixture.config.ball.radius +
        fixture.config.restarts.placementClearance,
      throwPosition.y,
    ),
  );
  fixture.homePlayers[0].placeAt(
    new Vector2d(
      throwPosition.x +
        fixture.config.ball.radius +
        fixture.config.restarts.placementClearance +
        1,
      throwPosition.y,
    ),
  );
  fixture.homePlayers[1].placeAt(
    new Vector2d(throwPosition.x + 100, throwPosition.y),
  );

  fixture.game.beginRestart({
    type: "throwIn",
    awardedTo: "home",
    boundary: "left",
    position: throwPosition,
  });
  var taker = required(fixture.positioningController.readyPlayer());
  var receiver = throwInReceiverPlacement(fixture.positioningController, taker);

  assertTrue(taker === fixture.homePlayers[2]);
  assertTrue(receiver.player === fixture.homePlayers[1]);
  assertTrue(receiver.player !== fixture.homePlayers[0]);
});

test("Held human input starts an early restart when the taker becomes ready", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.game.beginRestart({
    type: "goalKick",
    awardedTo: "home",
    boundary: "bottom",
  });
  fixture.game.humanController.setKey(38, true);
  var controller = fixture.positioningController;
  var readyPlayer = required(controller.readyPlayer());
  var target = required(positioningTargetForPlayer(controller, readyPlayer));
  readyPlayer.position.x = target.x;
  readyPlayer.position.y = target.y;

  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertEqual(fixture.restartController.phase(), "inProgress");
});

test("Kickoff assigns relative states and movement permission", function () {
  var fixture = makeFixture({ kickoffSide: "away" });
  fixture.config.restarts.opponentDelaySeconds = 0;
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertEqual(fixture.homeTeamAi.state, "kickoffOpponent");
  assertEqual(fixture.awayTeamAi.state, "kickoffUs");
  assertEqual(fixture.restartController.canTeamMove("home"), false);
  assertEqual(fixture.restartController.canTeamMove("away"), true);
});

test("Away kickoff aims its opening pass backward", function () {
  var fixture = makeFixture({ kickoffSide: "away" });
  fixture.config.restarts.opponentDelaySeconds = 0;
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );
  var target = required(fixture.restartController.attackTarget("away"));

  assertEqual(target.x, fixture.config.pitch.initialBallPosition.x);
  assertTrue(target.y < fixture.config.pitch.aiCenterY);
  assertEqual(fixture.restartController.attackTarget("home"), null);

  var taker = required(fixture.restartController.taker("away"));
  taker.position.x = fixture.ball.position.x;
  taker.position.y = fixture.ball.position.y + 4;
  updateTeamAis(fixture);
  advancePhysics(fixture, 0);

  assertTrue(fixture.ball.velocity.y < 0);
});

test("Throw-in uses fresh directional input to launch a lofted inward throw", function () {
  var fixture = makeFixture();
  fixture.game.beginRestart({
    type: "throwIn",
    awardedTo: "home",
    boundary: "left",
    position: new Vector2d(
      fixture.config.pitch.fieldLeft,
      fixture.config.pitch.aiCenterY,
    ),
  });
  fixture.positioningController.updateBeforePhysics(fixture.game.context());
  completePositioning(fixture);

  var taker = fixture.ball.heldBy;
  var heldPosition = fixture.ball.heldPosition();
  assertTrue(taker !== null);
  assertEqual(taker.facingX, 1);
  assertEqual(taker.facingY, 0);
  assertTrue(heldPosition.x > taker.position.x);
  assertTrue(heldPosition.y < taker.position.y);

  fixture.game.resumeFromInput(new Vector2d(-1, 0));

  assertEqual(fixture.restartController.phase(), "inProgress");
  assertTrue(fixture.ball.velocity.x > 0);
  assertTrue(fixture.ball.velocity.z > 0);
  assertEqual(fixture.ball.lastTouchedBy, "home");
  assertEqual(fixture.ball.heldBy, null);
  assertEqual(fixture.ball.position.x, heldPosition.x);
  assertEqual(fixture.ball.position.y, heldPosition.y);
});

test("Away throw-in chooses an automatic inward attacking direction", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.config.restarts.opponentDelaySeconds = 0;
  fixture.game.beginRestart({
    type: "throwIn",
    awardedTo: "away",
    boundary: "right",
    position: new Vector2d(
      fixture.config.pitch.fieldRight,
      fixture.config.pitch.aiCenterY,
    ),
  });
  fixture.positioningController.updateBeforePhysics(fixture.game.context());
  var taker = required(fixture.positioningController.readyPlayer());
  var receiver = throwInReceiverPlacement(fixture.positioningController, taker);
  completePositioning(fixture);

  var heldBy = required(fixture.ball.heldBy);
  var heldPosition = fixture.ball.heldPosition();
  assertEqual(heldBy.facingX, -1);
  assertEqual(heldBy.facingY, 0);

  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertTrue(fixture.ball.velocity.x < 0);
  assertTrue(fixture.ball.velocity.y > 0);
  var receiverDx = receiver.player.position.x - heldPosition.x;
  var receiverDy = receiver.player.position.y - heldPosition.y;
  assertNear(
    fixture.ball.velocity.x * receiverDy - fixture.ball.velocity.y * receiverDx,
    0,
    0.0001,
  );
  assertEqual(fixture.ball.lastTouchedBy, "away");
  assertTrue(fixture.ball.intendedReceiver === receiver.player);

  fixture.game.matchFlow.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );
  updateTeamAis(fixture);
  var receiverIndex = fixture.awayPlayers.indexOf(receiver.player);
  var takerIndex = fixture.awayPlayers.indexOf(taker);
  assertEqual(
    fixture.awayTeamAi.debugSnapshot()[receiverIndex].command,
    "attackBall",
  );
  assertEqual(
    fixture.awayTeamAi.debugSnapshot()[takerIndex].command,
    "moveToPosition",
  );
});

test("Away throw-in near the attacking goal line stays in bounds", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.config.restarts.opponentDelaySeconds = 0;
  fixture.game.beginRestart({
    type: "throwIn",
    awardedTo: "away",
    boundary: "right",
    position: new Vector2d(
      fixture.config.pitch.fieldRight,
      fixture.config.pitch.fieldBottom - 5,
    ),
  });
  fixture.positioningController.updateBeforePhysics(fixture.game.context());
  var taker = required(fixture.positioningController.readyPlayer());
  var receiver = throwInReceiverPlacement(fixture.positioningController, taker);
  var ballPosition = required(fixture.positioningController.ballPosition());
  assertTrue(receiver.target.x < ballPosition.x);
  assertTrue(receiver.target.y < ballPosition.y);
  completePositioning(fixture);

  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertTrue(fixture.ball.velocity.x < 0);
  assertTrue(fixture.ball.velocity.y < 0);
});

test("One-player away throw-in keeps the automatic direction fallback", function () {
  var fixture = makeFixture({ homeTeamSize: 1, awayTeamSize: 1 });
  fixture.config.restarts.opponentDelaySeconds = 0;
  fixture.game.beginRestart({
    type: "throwIn",
    awardedTo: "away",
    boundary: "right",
    position: new Vector2d(
      fixture.config.pitch.fieldRight,
      fixture.config.pitch.aiCenterY,
    ),
  });
  completePositioning(fixture);
  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertTrue(fixture.ball.velocity.x < 0);
  assertTrue(fixture.ball.velocity.y > 0);
});

test("Set-piece positioning keeps opponents outside the restart distance", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  fixture.game.beginRestart({
    type: "corner",
    awardedTo: "home",
    boundary: "top",
    position: new Vector2d(
      fixture.config.pitch.fieldLeft,
      fixture.config.pitch.fieldTop,
    ),
  });
  var ballPosition = required(fixture.positioningController.ballPosition());
  var awayPlacements = required(
    fixture.positioningController.placements(),
  ).away;

  for (var i = 0; i < awayPlacements.length; i++) {
    assertTrue(
      MathLib.computeDistance(awayPlacements[i].target, ballPosition) >=
        fixture.config.restarts.opponentDistance - 0.0001,
    );
  }
});

test("Corner restart gives the awarded AI team a central crossing target", function () {
  var fixture = makeFixture();
  fixture.game.beginRestart({
    type: "corner",
    awardedTo: "away",
    boundary: "bottom",
    position: new Vector2d(
      fixture.config.pitch.fieldRight,
      fixture.config.pitch.fieldBottom,
    ),
  });

  var target = fixture.restartController.attackTarget("away");
  assertTrue(target !== null);

  assertEqual(target.x, fixture.config.pitch.initialBallPosition.x);
  assertEqual(
    target.y,
    fixture.config.pitch.fieldBottom -
      fixture.config.restarts.cornerCrossDistance,
  );
  assertEqual(fixture.restartController.attackTarget("home"), null);
});

test("Corner restart never selects the goalkeeper or cover defender as taker", function () {
  var fixture = makeFixture({ homeTeamSize: 4, awayTeamSize: 4 });
  var corner = new Vector2d(
    fixture.config.pitch.fieldLeft,
    fixture.config.pitch.fieldTop,
  );
  fixture.homePlayers[0].position.x = corner.x;
  fixture.homePlayers[0].position.y = corner.y;
  fixture.homePlayers[1].position.x = corner.x + 1;
  fixture.homePlayers[1].position.y = corner.y + 1;
  fixture.homePlayers[2].position.x = corner.x + 40;
  fixture.homePlayers[2].position.y = corner.y + 40;
  fixture.homePlayers[3].position.x = corner.x + 80;
  fixture.homePlayers[3].position.y = corner.y + 80;

  fixture.game.beginRestart({
    type: "corner",
    awardedTo: "home",
    boundary: "top",
    position: corner,
  });

  var scene = fixture.positioningController;
  var ballPosition = required(scene.ballPosition());
  var homePlacements = required(scene.placements()).home;
  assertTrue(
    MathLib.computeDistance(homePlacements[2].target, ballPosition) < 20,
  );
  assertTrue(
    MathLib.computeDistance(homePlacements[0].target, ballPosition) > 20,
  );
  assertTrue(
    MathLib.computeDistance(homePlacements[1].target, ballPosition) > 20,
  );
  assertTrue(
    Math.abs(
      homePlacements[3].target.y -
        (fixture.config.pitch.fieldTop +
          fixture.config.restarts.cornerBoxDepth),
    ) <= fixture.config.restarts.positionVariationY,
  );
});

test("Corner restart applies the taker-aware layered plan before jitter", function () {
  var fixture = makeFixture({ homeTeamSize: 11, awayTeamSize: 11 });
  fixture.game.beginRestart({
    type: "corner",
    awardedTo: "home",
    boundary: "top",
    position: new Vector2d(
      fixture.config.pitch.fieldLeft,
      fixture.config.pitch.fieldTop,
    ),
  });
  var scene = fixture.positioningController;
  var homePlacements = required(scene.placements()).home;
  var takerIndex = homePlacements.findIndex(
    (placement) => placement.player === required(scene.readyPlayer()),
  );
  var sceneBallPosition = required(scene.ballPosition());
  var plan = new CornerFormation(fixture.config).attackingPlan(
    "home",
    11,
    takerIndex,
    true,
  );
  var shortIndex = plan.groups.indexOf("short");

  assertTrue(takerIndex >= 0);
  assertTrue(
    Math.abs(
      homePlacements[shortIndex].target.x - plan.positions[shortIndex].x,
    ) <= fixture.config.restarts.positionVariationX,
  );
  assertTrue(
    Math.abs(
      homePlacements[shortIndex].target.y - plan.positions[shortIndex].y,
    ) <= fixture.config.restarts.positionVariationY,
  );
  assertTrue(
    MathLib.computeDistance(
      homePlacements[takerIndex].target,
      sceneBallPosition,
    ) < 20,
  );
});

test("Goal kick always positions the goalkeeper as the only nearby taker", function () {
  var fixture = makeFixture({ homeTeamSize: 3, awayTeamSize: 3 });
  var ballPosition = new Vector2d(
    fixture.config.pitch.initialBallPosition.x,
    fixture.config.pitch.fieldBottom - fixture.config.restarts.goalKickDistance,
  );
  fixture.homePlayers[0].position.x = fixture.config.pitch.fieldLeft;
  fixture.homePlayers[0].position.y = fixture.config.pitch.aiCenterY;
  fixture.homePlayers[1].position.x = ballPosition.x;
  fixture.homePlayers[1].position.y = ballPosition.y;

  fixture.game.beginRestart({
    type: "goalKick",
    awardedTo: "home",
    boundary: "bottom",
  });

  var homePlacements = required(
    fixture.positioningController.placements(),
  ).home;
  var nearby = 0;
  for (var i = 0; i < homePlacements.length; i++) {
    if (MathLib.computeDistance(homePlacements[i].target, ballPosition) < 40)
      nearby++;
  }
  assertEqual(nearby, 1);
  assertNear(
    MathLib.computeDistance(homePlacements[0].target, ballPosition),
    fixture.config.restarts.goalKickTakerDistance,
    0.0001,
  );
});

test("Kickoff clamps the human player to the center ellipse", function () {
  var fixture = makeFixture();
  fixture.game.resumeFromInput(null);
  var player = required(fixture.homeTeam.humanPlayer);
  player.position.y =
    fixture.config.pitch.aiCenterY -
    fixture.config.pitch.centerCircleRadiusY -
    20;
  player.velocity.y = -10;

  fixture.restartController.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertNear(ellipseDistance(fixture.config, player.position), 1, 0.0001);
  assertEqual(player.velocity.y, 0);
});

test("Kickoff scales only its first kick impulse", function () {
  var fixture = makeFixture();
  var player = required(fixture.homeTeam.humanPlayer);
  player.position.x = 100;
  player.position.y = 100;
  player.velocity.x = 20;
  player.velocity.y = 0;
  fixture.ball.placeAt(new Vector2d(104, 100));
  fixture.game.resumeFromInput(null);

  advancePhysics(fixture, 0);

  var kickoffVelocity = fixture.ball.velocity.x;
  assertTrue(kickoffVelocity > 0);

  fixture.ball.placeAt(new Vector2d(104, 100));
  advancePhysics(fixture, 0);

  assertNear(
    kickoffVelocity / fixture.ball.velocity.x,
    fixture.config.restarts.kickoffImpulseMultiplier,
    0.0001,
  );
});

test("Kickoff scene exposes the dedicated first striker as taker", function () {
  var homeFixture = makeFixture({ homeTeamSize: 11, awayTeamSize: 11 });
  homeFixture.game.beginRestart({ type: "kickoff", awardedTo: "home" });
  assertTrue(
    homeFixture.positioningController.readyPlayer() ===
      homeFixture.homePlayers[9],
  );

  var awayFixture = makeFixture({ homeTeamSize: 11, awayTeamSize: 11 });
  awayFixture.game.beginRestart({ type: "kickoff", awardedTo: "away" });
  assertTrue(
    awayFixture.positioningController.readyPlayer() ===
      awayFixture.awayPlayers[9],
  );
});

test("Kickoff slightly varies non-takers while preserving legal positions", function () {
  var fixture = makeFixture({ homeTeamSize: 11, awayTeamSize: 11 });
  var strategy = new KickoffRestart(fixture.config);
  var request: RestartRequest = {
    type: "kickoff",
    awardedTo: "home",
    positioningSeed: 7,
  };
  var scene = strategy.createScene(fixture.game.context(), request);
  var formation = new Formation(fixture.config);
  var takerIndex = formation.kickoffTakerIndex(11);
  var exactHome = formation.positions("kickoffUs", "home", 11);
  var sawVariation = false;

  for (const side of ["home", "away"] as const) {
    var placements = scene.placements[side];
    for (var i = 0; i < placements.length; i++) {
      var target = placements[i].target;
      var isTaker = side == "home" && i == takerIndex;
      if (isTaker) {
        assertEqual(target.x, exactHome[i].x);
        assertEqual(target.y, exactHome[i].y);
        continue;
      }
      assertTrue(ellipseDistance(fixture.config, target) >= 1);
      if (side == "home") {
        assertTrue(
          target.y >=
            fixture.config.pitch.aiCenterY + fixture.config.player.radius,
        );
        if (target.x != exactHome[i].x || target.y != exactHome[i].y) {
          sawVariation = true;
        }
      } else {
        assertTrue(
          target.y <=
            fixture.config.pitch.aiCenterY - fixture.config.player.radius,
        );
      }
    }
  }
  assertTrue(sawVariation);
});

test("Throw-in corner and goal-kick positioning changes with restart seed", function () {
  var fixture = makeFixture({ homeTeamSize: 5, awayTeamSize: 5 });
  var cases: { strategy: RestartStrategy; request: RestartRequest }[] = [
    {
      strategy: new ThrowInRestart(fixture.config),
      request: {
        type: "throwIn",
        awardedTo: "home",
        boundary: "left",
        position: new Vector2d(81, 400),
      },
    },
    {
      strategy: new CornerRestart(fixture.config),
      request: {
        type: "corner",
        awardedTo: "home",
        boundary: "top",
        position: new Vector2d(81, 113),
      },
    },
    {
      strategy: new GoalKickRestart(fixture.config),
      request: {
        type: "goalKick",
        awardedTo: "home",
        boundary: "bottom",
      },
    },
  ];

  for (var caseIndex = 0; caseIndex < cases.length; caseIndex++) {
    var entry = cases[caseIndex];
    entry.request.positioningSeed = 20;
    var first = entry.strategy.createScene(
      fixture.game.context(),
      entry.request,
    );
    entry.request.positioningSeed = 21;
    var second = entry.strategy.createScene(
      fixture.game.context(),
      entry.request,
    );
    var sawVariation = false;

    for (const side of ["home", "away"] as const) {
      for (var i = 0; i < first.placements[side].length; i++) {
        var firstPlayer = first.placements[side][i].player;
        var firstTarget = first.placements[side][i].target;
        var secondTarget = second.placements[side][i].target;
        if (firstPlayer === first.readyPlayer) {
          assertEqual(firstTarget.x, secondTarget.x);
          assertEqual(firstTarget.y, secondTarget.y);
        } else if (
          firstTarget.x != secondTarget.x ||
          firstTarget.y != secondTarget.y
        ) {
          sawVariation = true;
        }
      }
    }
    assertTrue(sawVariation);
  }
});

test("Kickoff completes generically when its strategy condition is met", function () {
  var fixture = makeFixture();
  fixture.game.resumeFromInput(null);
  fixture.ball.velocity.x = fixture.config.physics.minVelocity + 1;

  fixture.game.matchFlow.updateAfterPhysics(
    fixture.game.context(),
    fixture.physics.lastDt,
  );

  assertEqual(fixture.game.matchFlow.snapshot().kind, "normalPlay");
  assertEqual(fixture.restartController.type(), null);
  assertEqual(fixture.restartController.phase(), null);
});

test("MatchFlow pause resumes the previous restart state", function () {
  var fixture = makeFixture();
  fixture.game.togglePause();

  assertEqual(fixture.game.matchFlow.snapshot().kind, "paused");
  assertEqual(fixture.game.matchFlow.simulationMode(), "none");

  fixture.game.togglePause();
  assertEqual(fixture.game.matchFlow.snapshot().kind, "restart");
  assertEqual(fixture.restartController.phase(), "waitingForInput");
});

test("MatchFlow rejects nested positioning and paused restart requests", function () {
  var fixture = makeFixture();
  assertEqual(
    fixture.game.beginRestart({ type: "kickoff", awardedTo: "home" }),
    true,
  );
  assertEqual(
    fixture.game.beginRestart({ type: "kickoff", awardedTo: "away" }),
    false,
  );

  fixture.game.togglePause();
  assertEqual(
    fixture.game.beginRestart({ type: "kickoff", awardedTo: "away" }),
    false,
  );
});
