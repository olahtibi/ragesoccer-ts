import { assertEqual, assertNear, assertTrue, test } from "../../testlib";
import { makeFixture } from "../../helpers";
import { IndividualAi } from "../../../src/ai/individualAi";
import { math as MathLib } from "../../../src/math/math";
import { Vector2 as Vector2d } from "../../../src/math/vector";
import { Player } from "../../../src/world/player";
import { world } from "../../../src/core/configuration";

test("attackBall shoots through ball when aligned behind it", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(336);
  fixture.playerAway.position.y = world(380);
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(400);
  fixture.ball.velocity.x = 0;
  fixture.ball.velocity.y = 0;

  ai.setCommand("attackBall", null);
  ai.update({ ball: fixture.ball, attackTarget: null });

  assertEqual(ai.debugSnapshot().state, "shoot");
  assertTrue(ai.tPos !== null);
  assertNear(ai.tPos.x, world(336), 0.0001);
  assertTrue(ai.tPos.y > fixture.ball.position.y);
  assertNear(fixture.ball.velocity.x, 0, 0.0001);
  assertNear(fixture.ball.velocity.y, 0, 0.0001);
});

test("attackBall aims through a supplied set-piece target", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(80);
  fixture.playerAway.position.y = world(100);
  fixture.ball.position.x = world(100);
  fixture.ball.position.y = world(100);

  ai.setCommand("attackBall", null);
  ai.update({
    ball: fixture.ball,
    attackTarget: new Vector2d(world(200), world(100)),
  });

  assertEqual(ai.debugSnapshot().state, "shoot");
  assertTrue(ai.tPos !== null);
  assertTrue(ai.tPos.x > fixture.ball.position.x);
  assertNear(ai.tPos.y, fixture.ball.position.y, 0.0001);
});

test("attackBall approaches behind-ball setup point when far and not aligned", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(300);
  fixture.playerAway.position.y = world(400);
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(400);

  ai.setCommand("attackBall", null);
  ai.update({ ball: fixture.ball, attackTarget: null });

  assertEqual(ai.debugSnapshot().state, "approach");
  assertTrue(ai.tPos !== null);
  assertNear(ai.tPos.x, world(336), 0.0001);
  assertTrue(ai.tPos.y < fixture.ball.position.y);
});

test("attackBall detours around ball when close and not aligned", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(346);
  fixture.playerAway.position.y = world(400);
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(400);

  ai.setCommand("attackBall", null);
  ai.update({ ball: fixture.ball, attackTarget: null });

  assertEqual(ai.debugSnapshot().state, "detour");
  assertTrue(ai.tPos !== null);
  assertNear(
    MathLib.computeDistance(ai.tPos, fixture.ball.position),
    fixture.config.ai.attackDetourRadius,
    0.0001,
  );
  assertTrue(ai.debugSnapshot().attackOrbitDir !== 0);
});

test("attackBall keeps detour direction across updates", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(346);
  fixture.playerAway.position.y = world(400);
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(400);

  ai.setCommand("attackBall", null);
  ai.update({ ball: fixture.ball, attackTarget: null });
  var orbitDir = ai.debugSnapshot().attackOrbitDir;
  ai.update({ ball: fixture.ball, attackTarget: null });

  assertEqual(ai.debugSnapshot().state, "detour");
  assertEqual(ai.debugSnapshot().attackOrbitDir, orbitDir);
});

test("attackBall ignores the formation pace multiplier", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(100);
  fixture.playerAway.position.y = world(100);
  fixture.ball.position.x = world(200);
  fixture.ball.position.y = world(100);
  ai.formationPaceMultiplier = 0.92;

  ai.setCommand("attackBall", null);
  ai.update({ ball: fixture.ball, attackTarget: null });

  assertNear(
    MathLib.vectorLength(
      fixture.playerAway.velocity.x,
      fixture.playerAway.velocity.y,
    ),
    fixture.config.teamVelocity("away"),
    0.0001,
  );
});

test("attackBall keeps shoot commitment without relaxing entry accuracy", function () {
  var fixture = makeFixture();
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(400);
  var committedAi = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(336);
  fixture.playerAway.position.y = world(380);

  committedAi.setCommand("attackBall", null);
  committedAi.update({ ball: fixture.ball, attackTarget: null });
  assertEqual(committedAi.debugSnapshot().state, "shoot");

  var betweenTolerances = 0.22;
  fixture.playerAway.position.x =
    fixture.ball.position.x + Math.sin(betweenTolerances) * world(20);
  fixture.playerAway.position.y =
    fixture.ball.position.y - Math.cos(betweenTolerances) * world(20);
  committedAi.update({ ball: fixture.ball, attackTarget: null });
  assertTrue(committedAi.tPos !== null);
  assertEqual(committedAi.debugSnapshot().state, "shoot");
  assertTrue(committedAi.debugSnapshot().correctingAim);
  assertNear(
    MathLib.computeDistance(committedAi.tPos, fixture.ball.position),
    fixture.config.ai.attackDetourRadius,
    0.0001,
  );

  var freshPlayer = new Player(
    fixture.config.assets.playerAway,
    new Vector2d(fixture.playerAway.position.x, fixture.playerAway.position.y),
    "away",
    fixture.config.player,
  );
  var freshAi = new IndividualAi(fixture.config, fixture.awayTeam, freshPlayer);
  freshAi.setCommand("attackBall", null);
  freshAi.update({ ball: fixture.ball, attackTarget: null });
  assertTrue(freshAi.debugSnapshot().state != "shoot");

  var correctionTolerance =
    fixture.config.ai.attackAimCorrectionToleranceRadians;
  var stillCorrecting = 0.12;
  fixture.playerAway.position.x =
    fixture.ball.position.x + Math.sin(stillCorrecting) * world(20);
  fixture.playerAway.position.y =
    fixture.ball.position.y - Math.cos(stillCorrecting) * world(20);
  committedAi.update({ ball: fixture.ball, attackTarget: null });
  assertEqual(committedAi.debugSnapshot().state, "shoot");
  assertTrue(committedAi.debugSnapshot().correctingAim);

  fixture.playerAway.position.x =
    fixture.ball.position.x + Math.sin(correctionTolerance / 2) * world(20);
  fixture.playerAway.position.y =
    fixture.ball.position.y - Math.cos(correctionTolerance / 2) * world(20);
  committedAi.update({ ball: fixture.ball, attackTarget: null });
  assertTrue(committedAi.tPos !== null);
  assertEqual(committedAi.debugSnapshot().state, "shoot");
  assertTrue(!committedAi.debugSnapshot().correctingAim);
  assertTrue(committedAi.tPos.y > fixture.ball.position.y);

  var outsideReleaseTolerance = 0.35;
  fixture.playerAway.position.x =
    fixture.ball.position.x + Math.sin(outsideReleaseTolerance) * world(20);
  fixture.playerAway.position.y =
    fixture.ball.position.y - Math.cos(outsideReleaseTolerance) * world(20);
  committedAi.update({ ball: fixture.ball, attackTarget: null });
  assertTrue(committedAi.debugSnapshot().state != "shoot");
});

test("attackBall does not stop short of a nearly aligned correction waypoint", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.ball.position.x = world(336);
  fixture.ball.position.y = world(400);

  ai.setCommand("attackBall", null);
  fixture.playerAway.position.x = world(336);
  fixture.playerAway.position.y = world(390);
  ai.update({ ball: fixture.ball, attackTarget: null });

  var radius = world(9.46);
  fixture.playerAway.position.x =
    fixture.ball.position.x + Math.sin(0.2) * radius;
  fixture.playerAway.position.y =
    fixture.ball.position.y - Math.cos(0.2) * radius;
  ai.update({ ball: fixture.ball, attackTarget: null });
  assertTrue(ai.debugSnapshot().correctingAim);

  fixture.playerAway.position.x =
    fixture.ball.position.x + Math.sin(0.0524) * radius;
  fixture.playerAway.position.y =
    fixture.ball.position.y - Math.cos(0.0524) * radius;
  ai.update({ ball: fixture.ball, attackTarget: null });
  assertTrue(ai.tPos !== null);

  assertEqual(ai.debugSnapshot().state, "shoot");
  assertTrue(ai.debugSnapshot().correctingAim);
  assertTrue(
    MathLib.computeDistance(ai.tPos, fixture.playerAway.position) <
      fixture.config.ai.targetReachedRadius,
  );
  assertTrue(
    fixture.playerAway.velocity.x != 0 || fixture.playerAway.velocity.y != 0,
  );
});
