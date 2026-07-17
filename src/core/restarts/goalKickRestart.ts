import { Formation } from "../../ai/formation";
import { Vector2 as Vector2d, Vector3 as Vector3d } from "../../math/vector";
import type {
  GameContext,
  RestartRequest,
  RestartScene,
  RestartStrategy,
  TeamAiState,
} from "../../types";
import type { Team } from "../../world/team";
import type { Configuration } from "../configuration";
import { RestartPositioning } from "./restartPositioning";
export { GoalKickRestart };

class GoalKickRestart implements RestartStrategy {
  public readonly config: Configuration;
  public readonly allowEarlyResume: boolean;

  public constructor(config: Configuration) {
    this.config = config;
    this.allowEarlyResume = true;
  }

  private ballPosition(request: RestartRequest): Vector3d {
    return new Vector3d(
      this.config.pitch.initialBallPosition.x,
      request.boundary == "top"
        ? this.config.pitch.fieldTop + this.config.restarts.goalKickDistance
        : this.config.pitch.fieldBottom - this.config.restarts.goalKickDistance,
      0,
    );
  }

  public createScene(
    context: GameContext,
    request: RestartRequest,
  ): RestartScene {
    const ballPosition = this.ballPosition(request);
    const offset = this.config.restarts.goalKickTakerDistance;
    const takerY =
      request.boundary == "top"
        ? ballPosition.y - offset
        : ballPosition.y + offset;
    return RestartPositioning.createScene(
      this.config,
      context,
      request,
      ballPosition,
      new Vector2d(ballPosition.x, takerY),
      this.goalkeeperIndex(context, request),
    );
  }

  private goalkeeperIndex(
    context: GameContext,
    request: RestartRequest,
  ): number {
    for (let i = 0; i < context.teams.length; i++) {
      const team = context.teams[i];
      if (team.side != request.awardedTo) continue;
      const roles = new Formation(this.config).rolesForSize(
        team.players.length,
      );
      for (let j = 0; j < roles.length; j++) {
        if (roles[j] == "goalie") return j;
      }
    }
    return 0;
  }

  public teamAiState(team: Team, request: RestartRequest): TeamAiState {
    return RestartPositioning.stateFor("goalKick", team, request);
  }

  public canTeamMove(team: Team, request: RestartRequest): boolean {
    return team.side == request.awardedTo;
  }

  public enforceRules(): void {}

  public isComplete(context: GameContext): boolean {
    const velocity = context.ball.velocity;
    const minSpeed = this.config.physics.minVelocity || 0;
    return (
      velocity.x * velocity.x + velocity.y * velocity.y > minSpeed * minSpeed
    );
  }
}
