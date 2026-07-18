import { Formation } from "../../ai/formation";
import { math as MathLib } from "../../math/math";
import { Vector2 as Vector2d, Vector3 as Vector3d } from "../../math/vector";
import type { Vector2 } from "../../math/vector";
import type {
  GameContext,
  RestartRequest,
  RestartScene,
  RestartStrategy,
  TeamAiState,
  TeamSide,
} from "../../types";
import type { Configuration } from "../configuration";
import { RestartPositioning } from "./restartPositioning";
export { CornerRestart };

class CornerRestart implements RestartStrategy {
  public readonly config: Configuration;
  public readonly allowEarlyResume: boolean;

  public constructor(config: Configuration) {
    this.config = config;
    this.allowEarlyResume = true;
  }

  private ballPosition(request: RestartRequest): Vector3d {
    if (request.position == null || request.boundary == null)
      throw new Error("Corner restart requires a boundary position");
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

  public createScene(
    context: GameContext,
    request: RestartRequest,
  ): RestartScene {
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

  private awardedTeamSize(
    context: GameContext,
    request: RestartRequest,
  ): number {
    return context.teams[request.awardedTo].players.length;
  }

  private takerIndex(
    context: GameContext,
    request: RestartRequest,
    ballPosition: Vector2,
  ): number {
    const team = context.teams[request.awardedTo];

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

  public teamAiState(side: TeamSide, request: RestartRequest): TeamAiState {
    return RestartPositioning.stateFor("corner", side, request);
  }

  public canTeamMove(side: TeamSide, request: RestartRequest): boolean {
    return side == request.awardedTo;
  }

  public attackTarget(side: TeamSide, request: RestartRequest): Vector2 | null {
    if (side != request.awardedTo) return null;
    return new Vector2d(
      this.config.pitch.initialBallPosition.x,
      request.awardedTo == "home"
        ? this.config.pitch.fieldTop + this.config.restarts.cornerCrossDistance
        : this.config.pitch.fieldBottom -
            this.config.restarts.cornerCrossDistance,
    );
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
