import { vi } from "vitest";
import { BrowserInput } from "../src/input/io";
import { Vector2 } from "../src/math/vector";
import { Configuration, type GameAssets } from "../src/core/configuration";
import { createGame, type Game } from "../src/core/game";
import type { DebugInputEvent } from "../src/types";
import { TEAM_SIDES } from "../src/types";

export interface FixtureOptions {
  homeTeamSize?: number;
  awayTeamSize?: number;
  playerStrength?: number;
  opponentStrength?: number;
  kickoffSide?: "home" | "away";
  outOfPlayRestartsEnabled?: boolean;
  search?: string;
}

function testAssets(): GameAssets {
  return {
    pitch: document.createElement("img"),
    ball: document.createElement("img"),
    playerHome: document.createElement("img"),
    playerAway: document.createElement("img"),
    canvas: document.createElement("canvas"),
  };
}

export function makeConfig(options: FixtureOptions = {}): Configuration {
  const config = new Configuration(testAssets(), {
    search: options.search ?? "",
    width: 640,
    height: 480,
  });
  if (options.search === undefined || options.homeTeamSize !== undefined) {
    config.teams.homeSize = options.homeTeamSize ?? 1;
  }
  if (options.search === undefined || options.awayTeamSize !== undefined) {
    config.teams.awaySize = options.awayTeamSize ?? 1;
  }
  config.teams.homeStrength =
    options.playerStrength ?? config.teams.homeStrength;
  config.teams.awayStrength =
    options.opponentStrength ?? config.teams.awayStrength;
  config.restarts.kickoffSide =
    options.kickoffSide ?? config.restarts.kickoffSide;
  config.restarts.outOfPlayEnabled =
    options.outOfPlayRestartsEnabled ?? config.restarts.outOfPlayEnabled;
  return config;
}

export function makeFixture(options: FixtureOptions = {}) {
  const config = makeConfig(options);
  const game = createGame(config);
  const ball = game.stadium.ball;
  const homeTeam = game.sides.home.team;
  const awayTeam = game.sides.away.team;
  const restartController = game.matchFlow.restartController;

  return {
    config,
    ball,
    playerHome: homeTeam.players[0],
    playerAway: awayTeam.players[0],
    homeTeam,
    awayTeam,
    homePlayers: homeTeam.players,
    awayPlayers: awayTeam.players,
    goalDetector: game.matchFlow.goalDetector,
    boundaryDetector: game.matchFlow.boundaryDetector,
    stadium: game.stadium,
    physics: game.physics,
    homeTeamAi: game.sides.home.ai,
    awayTeamAi: game.sides.away.ai,
    restartController,
    positioningController: restartController.positioningController,
    game,
  };
}

export type TestFixture = ReturnType<typeof makeFixture>;

export interface ReplayFrame {
  frame: number;
  dt: number;
}

export interface ReplayPayload {
  frames: ReplayFrame[];
  events: DebugInputEvent[];
}

export function canvasContext(
  overrides: Partial<CanvasRenderingContext2D>,
): CanvasRenderingContext2D {
  return overrides as CanvasRenderingContext2D;
}

export function touchEventAt(clientX: number, clientY: number): TouchEvent {
  return {
    touches: [{ clientX, clientY }],
  } as unknown as TouchEvent;
}

export function completePositioning(fixture: TestFixture): void {
  const controller = fixture.positioningController;
  const placements = controller.placements();
  if (placements == null) return;
  for (const side of TEAM_SIDES) {
    for (const placement of placements[side]) {
      placement.player.placeAt(placement.target);
    }
  }
  vi.spyOn(fixture.game.camera, "hasArrivedAtFocus").mockReturnValue(true);
  controller.updateAfterPhysics(fixture.game.context());
}

export function advancePhysics(
  fixture: TestFixture,
  deltaSeconds: number,
  mode: "full" | "playersOnly" | "ballOnly" = "full",
): void {
  vi.useFakeTimers();
  vi.setSystemTime(fixture.physics.lastUpdated + deltaSeconds * 1000);
  fixture.physics.update(mode);
}

export function updateTeamAis(fixture: TestFixture): void {
  for (const side of TEAM_SIDES) {
    fixture.game.sides[side].ai.update(
      fixture.physics.lastDt,
      fixture.game.matchFlow.teamAiContext(side),
    );
  }
}

export function replayDebugLog(
  payload: ReplayPayload,
  fixture: TestFixture,
): Game {
  const game = fixture.game;
  game.camera.position.x = 0;
  game.camera.position.y = 0;
  game.camera.showStats = false;
  const input = new BrowserInput(game, window);
  const events = payload.events.slice();
  let eventIndex = 0;
  vi.useFakeTimers();
  vi.setSystemTime(game.physics.lastUpdated);
  try {
    for (const frame of payload.frames) {
      while (
        eventIndex < events.length &&
        events[eventIndex].frame <= frame.frame
      ) {
        applyReplayEvent(events[eventIndex], game, input);
        eventIndex++;
      }
      vi.advanceTimersByTime(frame.dt * 1000);
      game.update();
    }
  } finally {
    vi.useRealTimers();
  }
  return game;
}

function applyReplayEvent(
  event: DebugInputEvent,
  game: Game,
  input: BrowserInput,
): void {
  if (event.type === "keydown" || event.type === "keyup") {
    if (event.keyCode === undefined) return;
    input.handleKey({ type: event.type, keyCode: event.keyCode });
    return;
  }
  if (event.type === "touch" && event.target !== undefined) {
    const target = new Vector2(event.target.x, event.target.y);
    game.humanController.setTouchTarget(target);
    game.resumeFromInput(
      new Vector2(
        target.x - game.stadium.ball.position.x,
        target.y - game.stadium.ball.position.y,
      ),
    );
  }
}
