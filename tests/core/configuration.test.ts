import { assertEqual, assertNear, test } from "../testlib";
import { makeConfig } from "../helpers";
import { Vector2 } from "../../src/math/vector";
import { Ball } from "../../src/world/ball";
import { Player } from "../../src/world/player";

// Don't make asserts on how test tool works
// test("Test helper overrides production team-size defaults", function() {
//   var config = new Configuration();
//   config.teams.homeSize = 4;
//   config.teams.awaySize = 3;

//   var testConfig = makeConfig();

//   assertEqual(testConfig.teams.homeSize, 1);
//   assertEqual(testConfig.teams.awaySize, 1);
// });

test("Configuration defaults strength and team-size options", function () {
  var config = makeConfig({ search: "" });
  assertEqual(config.teams.homeStrength, 6);
  assertEqual(config.teams.awayStrength, 6);
  assertEqual(config.ai.formationDefenderProgress, -200);
  assertEqual(config.ai.formationMidfielderProgress, 0);
  assertEqual(config.ai.formationStrikerProgress, 130);
  assertEqual(config.ai.formationStateShift, 55);
  assertEqual(config.ai.formationDefenderDefenseShift, 25);
  assertEqual(config.ai.kickoffMidfielderProgress, -100);
  assertEqual(config.teams.homeSize, 11);
  assertEqual(config.teams.awaySize, 11);
  assertEqual(config.restarts.outOfPlayEnabled, true);
  assertEqual(config.restarts.kickoffTakerDistance, 8);
  assertNear(config.restarts.outOfPlayDelaySeconds, 0.35, 0.0001);
  assertEqual(config.restarts.opponentDelaySeconds, 1);
  assertNear(config.cutscene.cameraLerp, 0.06, 0.0001);
  assertEqual(config.cutscene.goalCelebrationSeconds, 5);
  assertEqual(config.cutscene.goalFocusSeconds, 1);
  assertEqual(config.restarts.cornerBoxSpacing, 34);
  assertEqual(config.restarts.cornerBoxDepth, 45);
  assertEqual(config.restarts.cornerLateRunReleaseDistance, 35);
  assertEqual("playerStrength" in config, false);
  assertEqual("fieldLeft" in config, false);
  assertEqual("ballRadius" in config, false);
});

test("Configuration maps strength to velocity", function () {
  var config = makeConfig();

  assertNear(config.strengthToVelocity(1), 35, 0.0001);
  assertNear(config.strengthToVelocity(6), 51.6667, 0.0001);
  assertNear(config.strengthToVelocity(10), 65, 0.0001);
});

test("Configuration parses and clamps game options from query string", function () {
  var config = makeConfig({
    search:
      "?playerStrength=10&opponentStrength=0&homeTeamSize=5&awayTeamSize=12&kickoffSide=away&outOfPlayRestartsEnabled=false",
  });
  assertEqual(config.teams.homeStrength, 10);
  assertEqual(config.teams.awayStrength, 1);
  assertEqual(config.teams.homeSize, 5);
  assertEqual(config.teams.awaySize, 11);
  assertEqual(config.restarts.kickoffSide, "away");
  assertEqual(config.restarts.outOfPlayEnabled, false);
});

test("Configuration falls back for invalid query options", function () {
  var config = makeConfig({
    search:
      "?playerStrength=x&opponentStrength=&homeTeamSize=no&awayTeamSize=?&outOfPlayRestartsEnabled=maybe",
  });
  assertEqual(config.teams.homeStrength, 6);
  assertEqual(config.teams.awayStrength, 6);
  assertEqual(config.teams.homeSize, 11);
  assertEqual(config.teams.awaySize, 11);
  assertEqual(config.restarts.outOfPlayEnabled, true);
});

test("Entity constructors honor zero-valued required configuration", function () {
  var config = makeConfig();
  config.player.animationIdleGraceSeconds = 0;
  config.ball.heldOffsetX = 0;
  var player = new Player(
    config.assets.playerHome,
    new Vector2(0, 0),
    "home",
    config.player,
  );
  var ball = new Ball(config.assets.ball, new Vector2(0, 0), config.ball);
  ball.heldBy = player;

  assertEqual(player.animationIdleGraceSeconds, 0);
  assertEqual(ball.heldPosition().x, 0);
});
