import { Formation } from "../../ai/formation";
import { Vector2 as Vector2d, Vector3 as Vector3d } from "../../math/vector";
import { RestartPositioning } from "./restartPositioning";
export { GoalKickRestart };

class GoalKickRestart {
  [key: string]: any;
  public constructor(config) {
    this.config = config;
    this.allowEarlyResume = true;
  }

  private ballPosition(request) {
    return new Vector3d(
      this.config.pitch.initialBallPosition.x,
      request.boundary == "top"
        ? this.config.pitch.fieldTop + this.config.restarts.goalKickDistance
        : this.config.pitch.fieldBottom - this.config.restarts.goalKickDistance,
      0,
    );
  }

  public createScene(context, request) {
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

  private goalkeeperIndex(context, request) {
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

  public teamAiState(team, request) {
    return RestartPositioning.stateFor("goalKick", team, request);
  }

  public canTeamMove(team, request) {
    return team.side == request.awardedTo;
  }

  public enforceRules() {}

  public isComplete(context) {
    const velocity = context.ball.velocity;
    const minSpeed = this.config.physics.minVelocity || 0;
    return (
      velocity.x * velocity.x + velocity.y * velocity.y > minSpeed * minSpeed
    );
  }
}
