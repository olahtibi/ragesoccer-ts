import { math as MathLib } from "../../math/math";
import { Vector2 as Vector2d, Vector3 as Vector3d } from "../../math/vector";
import { RestartPositioning } from "./restartPositioning";
export { ThrowInRestart };

class ThrowInRestart {
  [key: string]: any;
  public constructor(config) {
    this.config = config;
    this.allowEarlyResume = true;
    this.launched = false;
    this.taker = null;
  }

  private ballPosition(request) {
    const clearance =
      this.config.ball.radius + this.config.restarts.placementClearance;
    const x =
      request.boundary == "left"
        ? this.config.pitch.fieldLeft + clearance
        : this.config.pitch.fieldRight - clearance;
    const minY = this.config.pitch.fieldTop + clearance;
    const maxY = this.config.pitch.fieldBottom - clearance;
    return new Vector3d(
      x,
      Math.max(minY, Math.min(maxY, request.position.y)),
      0,
    );
  }

  public createScene(context, request) {
    this.launched = false;
    const ballPosition = this.ballPosition(request);
    const offset =
      this.config.player.radius +
      this.config.ball.radius +
      this.config.restarts.takerClearance;
    const takerX =
      request.boundary == "left"
        ? this.config.pitch.fieldLeft - offset
        : this.config.pitch.fieldRight + offset;
    this.taker = this.findTaker(context, request, ballPosition);
    context.ball.heldBy = this.taker;
    return RestartPositioning.createScene(
      this.config,
      context,
      request,
      ballPosition,
      new Vector2d(takerX, ballPosition.y),
    );
  }

  private findTaker(context, request, ballPosition) {
    for (let i = 0; i < context.teams.length; i++) {
      if (context.teams[i].side == request.awardedTo) {
        const team = context.teams[i];
        return team.players[
          RestartPositioning.closestPlayerIndex(team.players, ballPosition)
        ];
      }
    }
    return null;
  }

  public onPositioned(context, request) {
    if (this.taker == null) return;
    this.taker.facingX = request.boundary == "left" ? 1 : -1;
    this.taker.facingY = 0;
  }

  public teamAiState(team, request) {
    return RestartPositioning.stateFor("throwIn", team, request);
  }

  public canTeamMove(team, request) {
    return team.side == request.awardedTo;
  }

  public resume(context, request, direction) {
    const inwardX = request.boundary == "left" ? 1 : -1;
    const attackY = request.awardedTo == "home" ? -1 : 1;
    let dx;
    let dy;
    if (request.awardedTo == "away" || direction == null) {
      dx = inwardX;
      dy = attackY;
    } else {
      dx = direction.x || 0;
      dy = direction.y || 0;
      if (dx * inwardX < 0.35) dx = inwardX * 0.35;
    }
    const normalized = MathLib.normalizeVector(dx, dy, inwardX, attackY);
    const heldPosition = context.ball.heldPosition();
    context.ball.position.x = heldPosition.x;
    context.ball.position.y = heldPosition.y;
    context.ball.position.z = 0;
    context.ball.heldBy = null;
    context.ball.velocity.x = normalized.x * this.config.restarts.throwInSpeed;
    context.ball.velocity.y = normalized.y * this.config.restarts.throwInSpeed;
    context.ball.velocity.z = this.config.restarts.throwInLoft;
    context.ball.lastTouchedBy = request.awardedTo;
    this.launched = true;
    return true;
  }

  public enforceRules() {}

  public isComplete(context) {
    if (!this.launched) return false;
    const velocity = context.ball.velocity;
    const minSpeed = this.config.physics.minVelocity || 0;
    return (
      velocity.x * velocity.x + velocity.y * velocity.y > minSpeed * minSpeed
    );
  }
}
