import { TeamAi } from "../ai/teamAi";
import type { Vector2 } from "../math/vector";
import { TEAM_SIDES } from "../types";
import type { GameContext, RestartRequest, TeamSideMap } from "../types";
import { HumanController } from "../input/humanController";
import { Ball } from "../world/ball";
import { BoundaryDetector } from "../world/detectors/boundaryDetector";
import { GoalDetector } from "../world/detectors/goalDetector";
import { Physics } from "../world/physics";
import { Stadium } from "../world/stadium";
import { Team } from "../world/team";
import { Camera } from "./camera";
import type { Configuration } from "./configuration";
import { DebugTool } from "./debugTool";
import { MatchFlow } from "./matchFlow";
import { CornerRestart } from "./restarts/cornerRestart";
import { GoalKickRestart } from "./restarts/goalKickRestart";
import { KickoffRestart } from "./restarts/kickoffRestart";
import { PositioningController } from "./restarts/positioningController";
import { RestartController } from "./restarts/restartController";
import { RestartRegistry } from "./restarts/restartRegistry";
import { ThrowInRestart } from "./restarts/throwInRestart";
export { Game, createContext, createGame, resizeContext };

export interface TeamRuntime {
  readonly team: Team;
  readonly ai: TeamAi;
}

interface GameOptions {
  config: Configuration;
  stadium: Stadium;
  sides: TeamSideMap<TeamRuntime>;
  camera: Camera;
  physics: Physics;
  humanController: HumanController;
  matchFlow: MatchFlow;
  debugTool: DebugTool;
}

function createTeamRuntime(
  config: Configuration,
  team: Team,
  opponentTeam: Team,
  ball: Ball,
): TeamRuntime {
  return {
    team: team,
    ai: new TeamAi(config, team, opponentTeam, ball),
  };
}

class Game {
  public readonly config: Configuration;
  public readonly stadium: Stadium;
  public readonly sides: TeamSideMap<TeamRuntime>;
  public readonly camera: Camera;
  public readonly physics: Physics;
  public readonly humanController: HumanController;
  public readonly matchFlow: MatchFlow;
  public readonly debugTool: DebugTool;

  public constructor(options: GameOptions) {
    this.config = options.config;
    this.stadium = options.stadium;
    this.sides = options.sides;
    this.camera = options.camera;
    this.physics = options.physics;
    this.humanController = options.humanController;
    this.matchFlow = options.matchFlow;
    this.debugTool = options.debugTool;
  }

  public context(): GameContext {
    return {
      config: this.config,
      stadium: this.stadium,
      ball: this.stadium.ball,
      teams: {
        home: this.sides.home.team,
        away: this.sides.away.team,
      },
      humanController: this.humanController,
      camera: this.camera,
    };
  }

  public isPaused(): boolean {
    return this.matchFlow.isPaused();
  }

  public togglePause(): void {
    if (this.matchFlow.isPaused()) {
      this.matchFlow.resume();
    } else {
      this.matchFlow.pause();
    }
  }

  public resumeFromInput(direction: Vector2 | null): boolean {
    return this.matchFlow.resumeFromInput(this.context(), direction);
  }

  public resumeFromKeyboardInput(direction: Vector2): boolean {
    return this.matchFlow.resumeFromKeyboardInput(this.context(), direction);
  }

  public beginRestart(request: RestartRequest): boolean {
    return this.matchFlow.beginRestart(request, this.context());
  }

  public update(): void {
    const context = this.context();
    const mode = this.matchFlow.simulationMode();
    if (mode == "none") {
      this.physics.resetClock();
    } else if (mode == "ballOnly") {
      this.physics.update("ballOnly");
      this.matchFlow.updateAfterPhysics(context, this.physics.lastDt);
    } else if (mode == "playersOnly" || mode == "cutscene") {
      this.matchFlow.updateBeforePhysics(context);
      this.physics.update(mode);
      this.matchFlow.updateAfterPhysics(context, this.physics.lastDt);
    } else {
      this.updateAi();
      const canMove = this.matchFlow.canTeamMove("home");
      this.humanController.update(canMove);
      this.physics.update("full");
      this.matchFlow.updateAfterPhysics(context, this.physics.lastDt);
      this.matchFlow.detectPostPhysicsEvents(context);
    }
    this.debugTool.record(this);
  }

  public render(ctx: CanvasRenderingContext2D): void {
    this.camera.windowToViewport(ctx);
    const showHumanPlayerMarker =
      this.matchFlow.simulationMode() == "full" &&
      this.matchFlow.canTeamMove("home");
    this.stadium.draw(ctx, showHumanPlayerMarker);
    if (this.isPaused()) this.debugTool.draw(ctx, this.sides);
    this.camera.renderOverlay(ctx, this.physics.displayFps);
  }

  // Private helpers

  private updateAi(): void {
    this.humanController.selectPlayer();
    for (let i = 0; i < TEAM_SIDES.length; i++) {
      const side = TEAM_SIDES[i];
      const runtime = this.sides[side];
      runtime.ai.update(
        this.physics.lastDt,
        this.matchFlow.teamAiContext(side),
      );
    }
  }
}

function createGame(config: Configuration): Game {
  const ball = new Ball(
    config.assets.ball,
    config.pitch.initialBallPosition,
    config.ball,
  );
  const homeTeam = new Team(config, "home");
  const awayTeam = new Team(config, "away");
  const stadium = new Stadium(config.assets.pitch, ball, homeTeam, awayTeam);
  const sides: TeamSideMap<TeamRuntime> = {
    home: createTeamRuntime(config, homeTeam, awayTeam, ball),
    away: createTeamRuntime(config, awayTeam, homeTeam, ball),
  };
  const camera = new Camera(config, stadium);
  const physics = new Physics(config, stadium);
  const goalDetector = new GoalDetector(config, ball);
  const boundaryDetector = new BoundaryDetector(config, ball);
  const humanController = new HumanController(config, homeTeam, ball);
  const positioningController = new PositioningController(config);
  const registry = new RestartRegistry();
  registry.register("kickoff", new KickoffRestart(config));
  registry.register("throwIn", new ThrowInRestart(config));
  registry.register("corner", new CornerRestart(config));
  registry.register("goalKick", new GoalKickRestart(config));
  const restartController = new RestartController(
    registry,
    positioningController,
  );
  const matchFlow = new MatchFlow(
    restartController,
    goalDetector,
    boundaryDetector,
  );
  const game = new Game({
    config: config,
    stadium: stadium,
    sides: sides,
    camera: camera,
    physics: physics,
    humanController: humanController,
    matchFlow: matchFlow,
    debugTool: new DebugTool(config),
  });
  matchFlow.beginRestart(
    { type: "kickoff", awardedTo: config.restarts.kickoffSide },
    game.context(),
    { positioningMode: "immediate" },
  );
  return game;
}

function createContext(game: Game): CanvasRenderingContext2D {
  const canvas = game.config.assets.canvas;
  const ctx = canvas.getContext("2d");
  if (ctx == null) throw new Error("Canvas 2D context is unavailable");
  resizeContext(
    game,
    ctx,
    game.config.viewport.width,
    game.config.viewport.height,
  );
  return ctx;
}

function resizeContext(
  game: Game,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const canvas = game.config.assets.canvas;
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  game.config.viewport.width = width;
  game.config.viewport.height = height;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
