import { assertEqual, assertNear, test } from "../../testlib";
import { makeFixture } from "../../helpers";
import { IndividualAi } from "../../../src/ai/individualAi";
import { Vector2 as Vector2d } from "../../../src/math/vector";
import { world } from "../../../src/core/configuration";

test("moveToPosition sets velocity toward target", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(10);
  fixture.playerAway.position.y = world(10);

  ai.setCommand("moveToPosition", new Vector2d(world(10), world(20)));
  ai.update({ ball: fixture.ball, attackTarget: null });

  var arrivalFactor =
    fixture.config.ai.arrivalMinSpeedFactor +
    ((1 - fixture.config.ai.arrivalMinSpeedFactor) * world(10)) /
      fixture.config.ai.arrivalSlowRadius;
  assertNear(fixture.playerAway.velocity.x, 0, 0.0001);
  assertNear(
    fixture.playerAway.velocity.y,
    fixture.config.teamVelocity("away") * arrivalFactor,
    0.0001,
  );
  assertEqual(ai.debugSnapshot().state, "moving");
});

test("moveToPosition applies formation pace outside the arrival radius", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(10);
  fixture.playerAway.position.y = world(10);
  ai.formationPaceMultiplier = 0.92;

  ai.setCommand("moveToPosition", new Vector2d(world(10), world(60)));
  ai.update({ ball: fixture.ball, attackTarget: null });

  assertNear(
    fixture.playerAway.velocity.y,
    fixture.config.teamVelocity("away") * 0.92,
    0.0001,
  );
});

test("moveToPosition stops at target", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(10);
  fixture.playerAway.position.y = world(10);
  fixture.playerAway.velocity.x = 2;
  fixture.playerAway.velocity.y = 3;

  ai.setCommand("moveToPosition", new Vector2d(world(10), world(10)));
  ai.update({ ball: fixture.ball, attackTarget: null });

  assertEqual(fixture.playerAway.velocity.x, 0);
  assertEqual(fixture.playerAway.velocity.y, 0);
  assertEqual(ai.debugSnapshot().state, "stopped");
});

test("moveToPosition uses hysteresis before resuming near a drifting target", function () {
  var fixture = makeFixture();
  var ai = new IndividualAi(
    fixture.config,
    fixture.awayTeam,
    fixture.playerAway,
  );
  fixture.playerAway.position.x = world(10);
  fixture.playerAway.position.y = world(10);

  ai.setCommand("moveToPosition", new Vector2d(world(10), world(13)));
  ai.update({ ball: fixture.ball, attackTarget: null });
  assertEqual(ai.debugSnapshot().state, "stopped");

  ai.setCommand("moveToPosition", new Vector2d(world(10), world(15)));
  ai.update({ ball: fixture.ball, attackTarget: null });
  assertEqual(ai.debugSnapshot().state, "moving");

  ai.setCommand("moveToPosition", new Vector2d(world(10), world(11.5)));
  ai.update({ ball: fixture.ball, attackTarget: null });
  assertEqual(ai.debugSnapshot().state, "stopped");

  ai.setCommand("moveToPosition", new Vector2d(world(10), world(13)));
  ai.update({ ball: fixture.ball, attackTarget: null });
  assertEqual(ai.debugSnapshot().state, "stopped");
});
