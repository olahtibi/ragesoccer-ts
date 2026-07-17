import { TeamAi } from "../ai/teamAi";
import type { Vector2 } from "../math/vector";
import type {
  GameContext,
  RestartRequest,
  RestartType,
  TeamSide,
} from "../types";
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
export { Game, createContext, createGame };

interface GameOptions {
  config: Configuration;
  stadium: Stadium;
  teams: Team[];
  teamAis: TeamAi[];
  camera: Camera;
  physics: Physics;
  humanController: HumanController;
  matchFlow: MatchFlow;
  debugTool: DebugTool;
}

type RestartDetails = Omit<Partial<RestartRequest>, "type" | "awardedTo">;

class Game {
  public readonly config: Configuration;
  public readonly stadium: Stadium;
  public readonly teams: Team[];
  public readonly teamAis: TeamAi[];
  public readonly camera: Camera;
  public readonly physics: Physics;
  public readonly humanController: HumanController;
  public readonly matchFlow: MatchFlow;
  public readonly debugTool: DebugTool;

  public constructor(options: GameOptions) {
    this.config = options.config;
    this.stadium = options.stadium;
    this.teams = options.teams;
    this.teamAis = options.teamAis;
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
      teams: this.teams,
      teamAis: this.teamAis,
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

  public beginRestart(
    type: RestartType,
    awardedTo: TeamSide,
    details: RestartDetails = {},
  ): boolean {
    const request: RestartRequest = { ...details, type, awardedTo };
    return this.matchFlow.beginRestart(request, this.context());
  }

  public update(): void {
    const context = this.context();
    const mode = this.matchFlow.simulationMode();
    if (mode == "none") {
      this.physics.resetClock();
    } else if (mode == "ballOnly") {
      this.physics.updateBallOnly();
      this.matchFlow.updateAfterPhysics(context, this.physics.lastDt);
    } else if (mode == "playersOnly") {
      this.matchFlow.updateBeforePhysics(context);
      this.physics.updatePlayersOnly();
      this.matchFlow.updateAfterPhysics(context, this.physics.lastDt);
    } else {
      this.updateAi();
      const canMove = this.matchFlow.canTeamMove(this.teams[0]);
      this.humanController.update(canMove);
      this.physics.update();
      this.matchFlow.updateAfterPhysics(context, this.physics.lastDt);
      this.matchFlow.detectPostPhysicsEvents(context);
    }
    this.debugTool.record(this);
  }

  public render(ctx: CanvasRenderingContext2D): void {
    this.camera.windowToViewport(ctx);
    this.stadium.draw(ctx);
    if (this.isPaused()) this.debugTool.draw(ctx, this.teamAis);
    this.camera.renderOverlay(ctx, this.physics.displayFps);
  }

  // Private helpers

  private updateAi(): void {
    this.humanController.selectPlayer();
    for (let i = 0; i < this.teamAis.length; i++) {
      const teamAi = this.teamAis[i];
      teamAi.update({
        deltaSeconds: this.physics.lastDt,
        restartActive: this.matchFlow.isRestartActive(),
        canMove: this.matchFlow.canTeamMove(teamAi.team),
        restartTaker: this.matchFlow.restartTaker(teamAi.team),
        positioningTargets: this.matchFlow.restartPositioningTargets(
          teamAi.team,
        ),
        attackTarget: this.matchFlow.restartAttackTarget(teamAi.team),
      });
    }
  }
}

function createGame(config: Configuration): Game {
  const ball = new Ball(
    config.assets.ball,
    config.ball.radius,
    config.pitch.initialBallPosition,
    config.ball,
  );
  const homeTeam = new Team(config, "home");
  const awayTeam = new Team(config, "away");
  const teams = [homeTeam, awayTeam];
  const stadium = new Stadium(config.assets.pitch, ball, homeTeam, awayTeam);
  const teamAis = [
    new TeamAi(config, homeTeam, awayTeam, ball),
    new TeamAi(config, awayTeam, homeTeam, ball),
  ];
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
    teams: teams,
    teamAis: teamAis,
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
  canvas.width = game.config.viewport.width;
  canvas.height = game.config.viewport.height;
  const ctx = canvas.getContext("2d");
  if (ctx == null) throw new Error("Canvas 2D context is unavailable");
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
