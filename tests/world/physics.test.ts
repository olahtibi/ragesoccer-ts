import { assertEqual, assertNear, assertTrue, test } from "../testlib";
import { advancePhysics, makeFixture } from "../helpers";

test("Physics advances player position without managing walk animation", function () {
  var fixture = makeFixture();
  fixture.config.physics.maxDeltaSeconds = 1;
  var startX = fixture.playerHome.position.x;
  var startY = fixture.playerHome.position.y;
  fixture.playerHome.velocity.x = 10;
  fixture.playerHome.velocity.y = 0;

  advancePhysics(fixture, 1, "playersOnly");

  assertNear(fixture.playerHome.position.x, startX + 10, 0.0001);
  assertNear(fixture.playerHome.position.y, startY, 0.0001);
  assertEqual(fixture.playerHome.phaseIndex, 0);
  assertEqual(fixture.playerHome.stepDistance, 0);
});

test("Ball position does not mutate configured initial ball position", function () {
  var fixture = makeFixture();
  var initialX = fixture.config.pitch.initialBallPosition.x;
  var initialY = fixture.config.pitch.initialBallPosition.y;

  fixture.ball.position.x += 25;
  fixture.ball.position.y += 30;

  assertNear(fixture.config.pitch.initialBallPosition.x, initialX, 0.0001);
  assertNear(fixture.config.pitch.initialBallPosition.y, initialY, 0.0001);
});

test("Physics advances every player in the stadium without managing animation", function () {
  var fixture = makeFixture({ homeTeamSize: 2, awayTeamSize: 2 });
  fixture.config.physics.maxDeltaSeconds = 1;
  var startXs = [];
  for (var i = 0; i < fixture.stadium.players.length; i++) {
    startXs.push(fixture.stadium.players[i].position.x);
    fixture.stadium.players[i].velocity.x = 10;
    fixture.stadium.players[i].velocity.y = 0;
  }

  advancePhysics(fixture, 1, "playersOnly");

  for (var j = 0; j < fixture.stadium.players.length; j++) {
    assertNear(fixture.stadium.players[j].position.x, startXs[j] + 10, 0.0001);
    assertEqual(fixture.stadium.players[j].stepDistance, 0);
    assertEqual(fixture.stadium.players[j].phaseIndex, 0);
  }
});

test("Cutscene physics advances players and ball without new contacts", function () {
  var fixture = makeFixture();
  fixture.config.physics.maxDeltaSeconds = 1;
  fixture.playerHome.position.x = 100;
  fixture.playerHome.position.y = 100;
  fixture.playerHome.velocity.x = 10;
  fixture.ball.position.x = 300;
  fixture.ball.position.y = 300;
  fixture.ball.velocity.x = 20;

  advancePhysics(fixture, 0.5, "cutscene");

  assertNear(fixture.playerHome.position.x, 105, 0.0001);
  assertTrue(fixture.ball.position.x > 300);
  assertEqual(fixture.ball.lastTouchedBy, null);
  assertEqual(fixture.ball.lastTouchedPlayer, null);
});

test("Physics advances a full 22-player match", function () {
  var fixture = makeFixture({ homeTeamSize: 11, awayTeamSize: 11 });
  assertEqual(fixture.stadium.players.length, 22);
  for (var i = 0; i < fixture.stadium.players.length; i++) {
    fixture.stadium.players[i].velocity.x = 10;
  }

  advancePhysics(fixture, 0.5, "playersOnly");

  for (var j = 0; j < fixture.stadium.players.length; j++) {
    assertEqual(fixture.stadium.players[j].stepDistance, 0);
  }
});

test("Physics ball friction reduces horizontal velocity", function () {
  var fixture = makeFixture();
  fixture.ball.velocity.x = 100;
  fixture.ball.velocity.y = 0;

  advancePhysics(fixture, 0.5, "ballOnly");

  assertTrue(fixture.ball.velocity.x > 0);
  assertTrue(fixture.ball.velocity.x < 100);
});

test("Physics snaps tiny ball velocity to zero", function () {
  var fixture = makeFixture();
  fixture.ball.velocity.x = 1;
  fixture.ball.velocity.y = 1;

  advancePhysics(fixture, 0.1, "ballOnly");

  assertEqual(fixture.ball.velocity.x, 0);
  assertEqual(fixture.ball.velocity.y, 0);
});

test("Physics reflects X velocity at a pitch wall", function () {
  var fixture = makeFixture({ outOfPlayRestartsEnabled: false });
  fixture.ball.position.x = fixture.config.pitch.boxTopLeft.x + 0.5;
  fixture.ball.position.y = fixture.config.pitch.aiCenterY;
  fixture.ball.velocity.x = -10;

  advancePhysics(fixture, 0.1, "ballOnly");

  assertTrue(fixture.ball.velocity.x > 0);
  assertTrue(fixture.ball.position.x > fixture.config.pitch.boxTopLeft.x);
});

test("Physics reflects Y velocity at a goal wall", function () {
  var fixture = makeFixture();
  fixture.ball.position.x = fixture.config.pitch.goalTopTopLeft.x + 10;
  fixture.ball.position.y = fixture.config.pitch.goalTopTopLeft.y + 0.5;
  fixture.ball.velocity.y = -10;

  advancePhysics(fixture, 0.1, "ballOnly");

  assertTrue(fixture.ball.velocity.y > 0);
  assertTrue(fixture.ball.position.y > fixture.config.pitch.goalTopTopLeft.y);
});

test("Physics ball-player contact kicks the ball outward", function () {
  var fixture = makeFixture();
  fixture.playerHome.position.x = 100;
  fixture.playerHome.position.y = 100;
  fixture.playerHome.velocity.x = 20;
  fixture.playerHome.velocity.y = 0;
  fixture.ball.position.x = 104;
  fixture.ball.position.y = 100;
  fixture.ball.position.z = 0;

  advancePhysics(fixture, 0);

  assertTrue(fixture.ball.velocity.x > 0);
  assertTrue(fixture.ball.velocity.z > 0);
  assertNear(fixture.ball.position.x, 106.01, 0.0001);
  assertEqual(fixture.ball.lastTouchedBy, "home");
  assertTrue(fixture.ball.lastTouchedPlayer === fixture.playerHome);
});

test("Disabled out-of-play restarts preserve reflective pitch boundaries", function () {
  var fixture = makeFixture({ outOfPlayRestartsEnabled: false });
  fixture.ball.position.x = fixture.config.pitch.boxTopLeft.x + 1;
  fixture.ball.position.y = fixture.config.pitch.aiCenterY;
  fixture.ball.velocity.x = -100;

  advancePhysics(fixture, 0.1, "ballOnly");

  assertTrue(fixture.ball.velocity.x > 0);
  assertTrue(fixture.ball.position.x > fixture.config.pitch.boxTopLeft.x);
});

test("Enabled out-of-play restarts allow the ball to cross pitch boundaries", function () {
  var fixture = makeFixture({ outOfPlayRestartsEnabled: true });
  fixture.ball.position.x = fixture.config.pitch.fieldLeft + 1;
  fixture.ball.position.y = fixture.config.pitch.aiCenterY;
  fixture.ball.velocity.x = -100;

  advancePhysics(fixture, 0.1, "ballOnly");

  assertTrue(fixture.ball.velocity.x < 0);
  assertTrue(fixture.ball.position.x < fixture.config.pitch.fieldLeft);
});

test("Physics player-only update advances players without touching the ball", function () {
  var fixture = makeFixture();
  fixture.playerHome.position.x = 100;
  fixture.playerHome.position.y = 100;
  fixture.playerHome.velocity.x = 20;
  fixture.ball.position.x = 104;
  fixture.ball.position.y = 100;
  fixture.ball.velocity.x = 100;
  fixture.physics.lastUpdated = new Date().getTime() - 100;

  fixture.physics.update("playersOnly");

  assertEqual(fixture.ball.position.x, 104);
  assertEqual(fixture.ball.position.y, 100);
  assertEqual(fixture.ball.velocity.x, 100);
  assertTrue(fixture.playerHome.position.x > 100);
});

test("Physics keeps a rounded throttled FPS display value", function () {
  var fixture = makeFixture();
  fixture.physics.lastUpdated = 0;

  advancePhysics(fixture, 0.016, "playersOnly");
  var firstDisplay = fixture.physics.displayFps;
  advancePhysics(fixture, 0.016, "playersOnly");

  assertEqual(firstDisplay, 63);
  assertEqual(fixture.physics.displayFps, firstDisplay);

  advancePhysics(fixture, 0.24, "playersOnly");

  assertTrue(fixture.physics.fps > 0);
  assertEqual(fixture.physics.displayFps, Math.round(fixture.physics.fps));
});
