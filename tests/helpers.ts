import { BrowserInput } from "../src/input/io";
import { Vector2 } from "../src/math/vector";
import { Configuration, type GameAssets } from "../src/core/configuration";
import { createGame } from "../src/core/game";

interface FixtureOptions {
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
  const homeTeam = game.teams[0];
  const awayTeam = game.teams[1];
  const restartController = game.matchFlow._restartController;

  return {
    config,
    ball,
    playerHome: homeTeam.players[0],
    playerAway: awayTeam.players[0],
    homeTeam,
    awayTeam,
    homePlayers: homeTeam.players,
    awayPlayers: awayTeam.players,
    goalDetector: game.matchFlow._goalDetector,
    boundaryDetector: game.matchFlow._boundaryDetector,
    stadium: game.stadium,
    physics: game.physics,
    teamAis: game.teamAis,
    homeTeamAi: game.teamAis[0],
    awayTeamAi: game.teamAis[1],
    restartController,
    positioningController: restartController._positioningController,
    game,
  };
}

export function replayDebugLog(payload, fixture) {
  const game = fixture.game;
  game.camera = { position: new Vector2(0, 0), showStats: false };
  const input = new BrowserInput(game, window);
  const events = (payload.events || []).slice();
  let eventIndex = 0;
  for (const frame of payload.frames || []) {
    while (
      eventIndex < events.length &&
      events[eventIndex].frame <= frame.frame
    ) {
      applyReplayEvent(events[eventIndex], game, input);
      eventIndex++;
    }
    advanceReplayFrame(game, frame.dt || 0);
  }
  return game;
}

function applyReplayEvent(event, game, input): void {
  if (event.type === "keydown" || event.type === "keyup") {
    input.handleKey({ type: event.type, keyCode: event.keyCode });
    return;
  }
  if (event.type === "touch") {
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

function advanceReplayFrame(game, dt: number): void {
  if (game.matchFlow.simulationMode() === "ballOnly") {
    game.physics.lastDt = dt;
    game.physics.updateBallPosition(dt);
    game.matchFlow.updateAfterPhysics(game.context(), dt);
    return;
  }
  game.updateAi();
  game.humanController.update(game.matchFlow.canTeamMove(game.teams[0]));
  game.physics.lastDt = dt;
  game.physics.updatePlayerPositions(dt);
  game.physics.resolveBallPlayerContacts();
  game.physics.updateBallPosition(dt);
  game.matchFlow.updateAfterPhysics(game.context(), dt);
  game.matchFlow.detectPostPhysicsEvents(game.context());
}
