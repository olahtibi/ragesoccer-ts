import { Formation } from "../../ai/formation";
import { math as MathLib } from "../../math/math";
import { Vector2 as Vector2d, Vector3 as Vector3d } from "../../math/vector";
import type { Vector2 } from "../../math/vector";
import type { GameContext, RestartRequest, RestartScene } from "../../types";
import type { Player } from "../../world/player";
import type { Configuration } from "../configuration";
import { RestartPositioning } from "./restartPositioning";
import { assertRestartType, BaseRestartStrategy } from "./baseRestartStrategy";
export { ThrowInRestart };

class ThrowInRestart extends BaseRestartStrategy {
  public readonly allowEarlyResume: boolean;
  public launched: boolean;
  public taker: Player | null;
  private receiver: Player | null;

  public constructor(config: Configuration) {
    super(config);
    this.allowEarlyResume = true;
    this.launched = false;
    this.taker = null;
    this.receiver = null;
  }

  private ballPosition(request: RestartRequest): Vector3d {
    assertRestartType(request, "throwIn");
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

  public createScene(
    context: GameContext,
    request: RestartRequest,
  ): RestartScene {
    assertRestartType(request, "throwIn");
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
    this.receiver = this.findReceiver(context, request, ballPosition);
    context.ball.heldBy = this.taker;
    const takerIndex =
      this.taker == null
        ? null
        : context.teams[request.awardedTo].players.indexOf(this.taker);
    const scene = RestartPositioning.createScene(
      this.config,
      context,
      request,
      ballPosition,
      new Vector2d(takerX, ballPosition.y),
      takerIndex,
    );
    if (this.receiver != null) {
      const target = this.receiverTarget(request, ballPosition);
      const placement = scene.placements[request.awardedTo].find(
        (candidate) => candidate.player === this.receiver,
      );
      if (placement != null) placement.target = target;
      if (request.awardedTo == "away") {
        scene.additionalReadyPlayers = [this.receiver];
      }
    }
    return scene;
  }

  private findTaker(
    context: GameContext,
    request: RestartRequest,
    ballPosition: Vector2,
  ): Player | null {
    const team = context.teams[request.awardedTo];
    return team.players[
      RestartPositioning.closestPlayerIndex(team.players, ballPosition)
    ];
  }

  private findReceiver(
    context: GameContext,
    request: RestartRequest,
    ballPosition: Vector2,
  ): Player | null {
    const players = context.teams[request.awardedTo].players;
    const roles = new Formation(this.config).rolesForSize(players.length);
    let receiver: Player | null = null;
    let closestDistance = Infinity;
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (player === this.taker || roles[i] == "goalie") continue;
      const distance = MathLib.computeDistance(player.position, ballPosition);
      if (distance < closestDistance) {
        receiver = player;
        closestDistance = distance;
      }
    }
    return receiver;
  }

  private receiverTarget(
    request: RestartRequest,
    ballPosition: Vector2,
  ): Vector2 {
    assertRestartType(request, "throwIn");
    const inwardX = request.boundary == "left" ? 1 : -1;
    const attackY = request.awardedTo == "home" ? -1 : 1;
    const attackingGoalLine =
      attackY < 0 ? this.config.pitch.fieldTop : this.config.pitch.fieldBottom;
    const attackingSpace = Math.abs(attackingGoalLine - ballPosition.y);
    const receiverY =
      attackingSpace < this.config.restarts.throwInGoalLineSafetyDistance
        ? -attackY
        : attackY;
    const direction = MathLib.normalizeVector(
      inwardX,
      receiverY,
      inwardX,
      receiverY,
    );
    const distance = this.config.restarts.throwInReceiverDistance;
    return RestartPositioning.clampToPlayingField(
      this.config,
      new Vector2d(
        ballPosition.x + direction.x * distance,
        ballPosition.y + direction.y * distance,
      ),
    );
  }

  public onPositioned(context: GameContext, request: RestartRequest): void {
    assertRestartType(request, "throwIn");
    if (this.taker == null) return;
    this.taker.facingX = request.boundary == "left" ? 1 : -1;
    this.taker.facingY = 0;
  }

  public resume(
    context: GameContext,
    request: RestartRequest,
    direction: Vector2 | null,
  ): boolean {
    assertRestartType(request, "throwIn");
    const inwardX = request.boundary == "left" ? 1 : -1;
    const attackY = request.awardedTo == "home" ? -1 : 1;
    const heldPosition = context.ball.heldPosition();
    let dx: number;
    let dy: number;
    if (request.awardedTo == "away" && this.receiver != null) {
      dx = this.receiver.position.x - heldPosition.x;
      dy = this.receiver.position.y - heldPosition.y;
    } else if (request.awardedTo == "away" || direction == null) {
      dx = inwardX;
      const attackingGoalLine =
        attackY < 0
          ? this.config.pitch.fieldTop
          : this.config.pitch.fieldBottom;
      const attackingSpace = Math.abs(attackingGoalLine - heldPosition.y);
      dy =
        attackingSpace < this.config.restarts.throwInGoalLineSafetyDistance
          ? 0
          : attackY;
    } else {
      dx = direction.x;
      dy = direction.y;
      if (dx * inwardX < 0.35) dx = inwardX * 0.35;
    }
    const normalized = MathLib.normalizeVector(dx, dy, inwardX, attackY);
    context.ball.position.x = heldPosition.x;
    context.ball.position.y = heldPosition.y;
    context.ball.position.z = 0;
    context.ball.heldBy = null;
    context.ball.velocity.x = normalized.x * this.config.restarts.throwInSpeed;
    context.ball.velocity.y = normalized.y * this.config.restarts.throwInSpeed;
    context.ball.velocity.z = this.config.restarts.throwInLoft;
    context.ball.lastTouchedBy = request.awardedTo;
    context.ball.lastTouchedPlayer = this.taker;
    context.ball.intendedReceiver = this.receiver;
    if (request.awardedTo == "home") context.humanController.clearInput();
    this.launched = true;
    return true;
  }

  public override isComplete(context: GameContext): boolean {
    if (!this.launched) return false;
    const velocity = context.ball.velocity;
    const minSpeed = this.config.physics.minVelocity;
    return (
      velocity.x * velocity.x + velocity.y * velocity.y > minSpeed * minSpeed
    );
  }
}
