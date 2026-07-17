import { Formation } from "../../ai/formation";
import { math as MathLib } from "../../math/math";
import { Vector2 as Vector2d, Vector3 as Vector3d } from "../../math/vector";
import { RestartPositioning } from "./restartPositioning";
export { CornerRestart };

class CornerRestart {
  [key: string]: any;
  public constructor(config) {
    this.config = config;
    this.allowEarlyResume = true;
  }

  private ballPosition(request) {
    const clearance =
      this.config.ball.radius + this.config.restarts.placementClearance;
    const left = request.position.x <= this.config.pitch.initialBallPosition.x;
    return new Vector3d(
      left
        ? this.config.pitch.fieldLeft + clearance
        : this.config.pitch.fieldRight - clearance,
      request.boundary == "top"
        ? this.config.pitch.fieldTop + clearance
        : this.config.pitch.fieldBottom - clearance,
      0,
    );
  }

  public createScene(context, request) {
    const ballPosition = this.ballPosition(request);
    const offset =
      this.config.player.radius +
      this.config.ball.radius +
      this.config.restarts.takerClearance;
    const goalX =
      (this.config.pitch.goalTopTopLeft.x +
        this.config.pitch.goalTopTopRight.x) /
      2;
    const goalY =
      request.awardedTo == "home"
        ? this.config.pitch.fieldTop
        : this.config.pitch.fieldBottom;
    const toGoal = MathLib.normalizeVector(
      goalX - ballPosition.x,
      goalY - ballPosition.y,
      0,
      request.awardedTo == "home" ? -1 : 1,
    );
    const takerIndex = this.takerIndex(context, request, ballPosition);
    const cornerPlan = new Formation(this.config).cornerAttackingPlan(
      request.awardedTo,
      this.awardedTeamSize(context, request),
      takerIndex,
      ballPosition.x <= this.config.pitch.initialBallPosition.x,
    );
    return RestartPositioning.createScene(
      this.config,
      context,
      request,
      ballPosition,
      new Vector2d(
        ballPosition.x - toGoal.x * offset,
        ballPosition.y - toGoal.y * offset,
      ),
      takerIndex,
      "cornerUs",
      cornerPlan.positions,
    );
  }

  private awardedTeamSize(context, request) {
    for (let i = 0; i < context.teams.length; i++) {
      if (context.teams[i].side == request.awardedTo)
        return context.teams[i].players.length;
    }
    return 1;
  }

  private takerIndex(context, request, ballPosition) {
    let team = null;
    for (let i = 0; i < context.teams.length; i++) {
      if (context.teams[i].side == request.awardedTo) {
        team = context.teams[i];
        break;
      }
    }
    if (team == null) return 0;

    const formation = new Formation(this.config);
    const roles = formation.rolesForSize(team.players.length);
    const coverIndexes = formation.cornerCoverIndexes(team.players.length);
    let closestIndex = -1;
    let closestDistance = Infinity;

    for (let j = 0; j < team.players.length; j++) {
      if (roles[j] == "goalie" || coverIndexes.indexOf(j) >= 0) continue;
      const distance = MathLib.computeDistance(
        team.players[j].position,
        ballPosition,
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = j;
      }
    }

    return closestIndex < 0
      ? RestartPositioning.closestPlayerIndex(team.players, ballPosition)
      : closestIndex;
  }

  public teamAiState(team, request) {
    return RestartPositioning.stateFor("corner", team, request);
  }

  public canTeamMove(team, request) {
    return team.side == request.awardedTo;
  }

  public attackTarget(team, request) {
    if (team.side != request.awardedTo) return null;
    return new Vector2d(
      this.config.pitch.initialBallPosition.x,
      request.awardedTo == "home"
        ? this.config.pitch.fieldTop + this.config.restarts.cornerCrossDistance
        : this.config.pitch.fieldBottom -
            this.config.restarts.cornerCrossDistance,
    );
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
