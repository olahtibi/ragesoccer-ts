import { assertEqual, assertTrue, test } from "../testlib";
import {
  canvasContext,
  makeFixture,
  replayDebugLog,
  type FixtureOptions,
  type ReplayPayload,
} from "../helpers";
import { DebugTool } from "../../src/core/debugTool";
import { TEAM_SIDES } from "../../src/types";
import { Vector2 as Vector2d } from "../../src/math/vector";
import { vi } from "vitest";

function makeDebugGame(options: FixtureOptions = {}) {
  var fixture = makeFixture(options);
  var game = fixture.game;
  return {
    fixture: fixture,
    game: game,
  };
}

test("DebugTool records no snapshots when debug is false", function () {
  var setup = makeDebugGame();
  setup.fixture.config.debug.enabled = false;

  setup.game.debugTool.record(setup.game);

  assertEqual(setup.game.debugTool.snapshots.length, 0);
});

test("DebugTool records snapshots when debug is true", function () {
  var setup = makeDebugGame();
  setup.fixture.config.debug.enabled = true;
  setup.fixture.config.debug.logEveryNFrames = 1;

  setup.game.debugTool.record(setup.game);

  assertEqual(setup.game.debugTool.snapshots.length, 1);
});

test("DebugTool samples snapshots by configured frame interval", function () {
  var setup = makeDebugGame();
  setup.fixture.config.debug.enabled = true;
  setup.fixture.config.debug.logEveryNFrames = 3;

  for (var i = 0; i < 7; i++) {
    setup.game.debugTool.record(setup.game);
  }

  assertEqual(setup.game.debugTool.snapshots.length, 3);
  assertEqual(setup.game.debugTool.snapshots[0].frame, 0);
  assertEqual(setup.game.debugTool.snapshots[1].frame, 3);
  assertEqual(setup.game.debugTool.snapshots[2].frame, 6);
});

test("DebugTool trims snapshots older than configured seconds", function () {
  var setup = makeDebugGame();
  var now = 0;
  setup.fixture.config.debug.enabled = true;
  setup.fixture.config.debug.logEveryNFrames = 1;
  setup.fixture.config.debug.logSeconds = 0.05;
  vi.spyOn(performance, "now").mockImplementation(function () {
    now += 25;
    return now;
  });

  for (var i = 0; i < 5; i++) {
    setup.game.debugTool.record(setup.game);
  }

  assertEqual(setup.game.debugTool.snapshots.length, 3);
  assertEqual(setup.game.debugTool.snapshots[0].time, 0.05);
  assertEqual(setup.game.debugTool.snapshots[2].time, 0.1);
});

test("DebugTool snapshot includes ball, players, and AI commands states and targets", function () {
  var setup = makeDebugGame({ homeTeamSize: 3, awayTeamSize: 3 });
  setup.fixture.config.debug.enabled = true;
  setup.fixture.config.debug.logEveryNFrames = 1;
  setup.fixture.ball.position.x = 12.345;
  setup.fixture.ball.velocity.y = -6.789;
  setup.fixture.ball.lastTouchedBy = "away";
  setup.game.matchFlow.state = "normalPlay";
  setup.fixture.ball.position.x = setup.fixture.awayPlayers[0].position.x + 20;
  setup.fixture.ball.position.y = setup.fixture.awayPlayers[0].position.y;
  for (const side of TEAM_SIDES) {
    setup.game.sides[side].ai.update(0, { restart: null });
  }

  setup.game.debugTool.record(setup.game);

  var snapshot = setup.game.debugTool.snapshots[0];
  assertEqual(snapshot.dt, 0);
  assertEqual(
    snapshot.ball.pos.x,
    Math.round(setup.fixture.ball.position.x * 100) / 100,
  );
  assertEqual(snapshot.ball.vel.y, -6.79);
  assertEqual(snapshot.ball.lastTouchedBy, "away");
  assertEqual(snapshot.players.length, 6);
  assertEqual(snapshot.players[0].team, "home");
  assertEqual(snapshot.players[0].i, 0);
  assertTrue(
    snapshot.players[0].human ||
      snapshot.players[1].human ||
      snapshot.players[2].human,
  );
  assertEqual(snapshot.ai.length, 6);
  assertEqual(snapshot.ai[3].team, "away");
  assertEqual(snapshot.ai[3].i, 0);
  assertEqual(snapshot.ai[3].command, "attackBall");
  assertTrue(
    snapshot.ai[3].state == "approach" ||
      snapshot.ai[3].state == "detour" ||
      snapshot.ai[3].state == "shoot",
  );
  assertTrue(snapshot.ai[3].target !== null);
});

test("DebugTool draws public AI targets from current player positions", function () {
  var fixture = makeFixture({ homeTeamSize: 1, awayTeamSize: 2 });
  var tool = new DebugTool(fixture.config);
  fixture.awayTeamAi.setRestartState("attack");
  fixture.awayTeamAi.update(0.1, { restart: null });
  var calls: string[] = [];
  var ctx = canvasContext({
    beginPath: function () {
      calls.push("begin");
    },
    moveTo: function (x: number, y: number) {
      calls.push("move:" + x + "," + y);
    },
    lineTo: function (x: number, y: number) {
      calls.push("line:" + x + "," + y);
    },
    stroke: function () {
      calls.push("stroke");
    },
  });

  tool.draw(ctx, fixture.game.sides);

  assertTrue(calls.includes("begin"));
  assertTrue(calls.some((call) => call.startsWith("move:")));
  assertTrue(calls.some((call) => call.startsWith("line:")));
  assertTrue(calls.includes("stroke"));
  assertEqual(ctx.lineWidth, 1);
  assertEqual(ctx.strokeStyle, "blue");
});

test("DebugTool records keyboard and touch events when debug is true", function () {
  var setup = makeDebugGame();
  setup.fixture.config.debug.enabled = true;
  vi.spyOn(performance, "now").mockReturnValue(1000);

  setup.game.debugTool.recordKeyEvent({ type: "keydown", keyCode: 39 });
  setup.game.debugTool.recordKeyEvent({ type: "keyup", keyCode: 39 });
  setup.game.debugTool.recordTouchEvent(new Vector2d(12.345, 67.891));

  assertEqual(setup.game.debugTool.events.length, 3);
  assertEqual(setup.game.debugTool.events[0].type, "keydown");
  assertEqual(setup.game.debugTool.events[0].keyCode, 39);
  assertEqual(setup.game.debugTool.events[1].type, "keyup");
  assertEqual(setup.game.debugTool.events[2].type, "touch");
  assertTrue(setup.game.debugTool.events[2].target !== undefined);
  assertEqual(setup.game.debugTool.events[2].target.x, 12.35);
});

test("DebugTool records no input events when debug is false", function () {
  var setup = makeDebugGame();
  setup.fixture.config.debug.enabled = false;

  setup.game.debugTool.recordKeyEvent({ type: "keydown", keyCode: 39 });
  setup.game.debugTool.recordTouchEvent(new Vector2d(10, 20));

  assertEqual(setup.game.debugTool.events.length, 0);
});

test("DebugTool trims events older than configured seconds", function () {
  var setup = makeDebugGame();
  var now = 0;
  setup.fixture.config.debug.enabled = true;
  setup.fixture.config.debug.logSeconds = 0.05;
  vi.spyOn(performance, "now").mockImplementation(function () {
    now += 25;
    return now;
  });

  for (var i = 0; i < 5; i++) {
    setup.game.debugTool.recordKeyEvent({ type: "keydown", keyCode: 39 });
  }

  assertEqual(setup.game.debugTool.events.length, 3);
  assertEqual(setup.game.debugTool.events[0].time, 0.05);
  assertEqual(setup.game.debugTool.events[2].time, 0.1);
});

test("DebugTool dump includes compact frames and events payload", function () {
  var setup = makeDebugGame();
  setup.fixture.config.debug.enabled = true;
  setup.fixture.config.debug.logEveryNFrames = 1;
  var log = vi.spyOn(console, "log").mockImplementation(() => undefined);

  setup.game.debugTool.recordKeyEvent({ type: "keydown", keyCode: 39 });
  setup.game.debugTool.record(setup.game);
  setup.game.debugTool.dump();

  var logged = log.mock.calls[0][0];
  assertTrue(typeof logged === "string");
  var payload = JSON.parse(logged) as {
    type: string;
    frames: unknown[];
    events: unknown[];
  };
  assertEqual(payload.type, "debugLog");
  assertEqual(payload.frames.length, 1);
  assertEqual(payload.events.length, 1);
});

test("Replay helper applies input events and frame dt without rendering", function () {
  var fixture = makeFixture({ homeTeamSize: 1, awayTeamSize: 1 });
  var startX = fixture.playerHome.position.x;
  var payload: ReplayPayload = {
    frames: [
      { frame: 0, dt: 0.1 },
      { frame: 1, dt: 0.1 },
    ],
    events: [
      { frame: 0, type: "keydown", keyCode: 39 },
      { frame: 1, type: "keyup", keyCode: 39 },
    ],
  };

  replayDebugLog(payload, fixture);

  assertEqual(fixture.physics.lastDt, 0.1);
  assertTrue(fixture.playerHome.position.x > startX);
  assertEqual(fixture.playerHome.velocity.x, 0);
});
