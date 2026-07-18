import { Formation } from "../../ai/formation";
import { Vector2 as Vector2d, Vector3 as Vector3d } from "../../math/vector";
import type { GameContext, RestartRequest, RestartScene } from "../../types";
import type { Configuration } from "../configuration";
import { RestartPositioning } from "./restartPositioning";
import { assertRestartType, BaseRestartStrategy } from "./baseRestartStrategy";
export { GoalKickRestart };

class GoalKickRestart extends BaseRestartStrategy {
  public readonly allowEarlyResume: boolean;

  public constructor(config: Configuration) {
    super(config);
    this.allowEarlyResume = true;
  }

  private ballPosition(request: RestartRequest): Vector3d {
    assertRestartType(request, "goalKick");
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
    assertRestartType(request, "goalKick");
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
    const team = context.teams[request.awardedTo];
    const roles = new Formation(this.config).rolesForSize(team.players.length);
    for (let j = 0; j < roles.length; j++) {
      if (roles[j] == "goalie") return j;
    }
    return 0;
  }
}
