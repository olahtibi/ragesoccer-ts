import { math as MathLib } from "../math/math";
import { Vector2 as Vector2d, Vector3 as Vector3d } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { TeamSide } from "../types";
import type { Player } from "./player";
export { Ball };

class Ball {
  public readonly imgBall: HTMLImageElement;
  public readonly ballRadius: number;
  public readonly position: Vector3d;
  public readonly velocity: Vector3d;
  public phaseIndex: number;
  public lastTouchedBy: TeamSide | null;
  public lastTouchedPlayer: Player | null;
  public heldBy: Player | null;
  public rollDistance: number;
  private readonly spinPxPerPhase: number;
  private readonly spritePhases: number;
  private readonly lastAnimationPosition: Vector2d;
  private readonly heldOffsetX: number;
  private readonly heldOffsetY: number;
  private readonly shadowFrame: number;
  private readonly shadowOffset: number;

  public constructor(
    imgBall: HTMLImageElement,
    position: { x: number; y: number; z?: number },
    ballConfig: Configuration["ball"],
  ) {
    this.imgBall = imgBall;
    this.ballRadius = ballConfig.radius;
    this.position = new Vector3d(position.x, position.y, position.z ?? 0);
    this.velocity = new Vector3d(0, 0, 0);
    this.phaseIndex = 0;
    this.lastTouchedBy = null;
    this.lastTouchedPlayer = null;
    this.heldBy = null;
    // Accumulated distance rolled since the last sprite phase change.
    this.rollDistance = 0;
    this.spinPxPerPhase = ballConfig.spinPxPerPhase;
    this.spritePhases = ballConfig.spritePhases;
    this.lastAnimationPosition = new Vector2d(this.position.x, this.position.y);
    this.heldOffsetX = ballConfig.heldOffsetX;
    this.heldOffsetY = ballConfig.heldOffsetY;
    this.shadowFrame = ballConfig.shadowFrame;
    this.shadowOffset = ballConfig.shadowOffset;
  }

  public stop(): void {
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.velocity.z = 0;
  }

  public placeAt(position: { x: number; y: number; z?: number }): void {
    this.position.x = position.x;
    this.position.y = position.y;
    this.position.z = position.z ?? 0;
    this.stop();
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (this.heldBy != null) {
      const held = this.heldPosition();
      this.holdAnimationAt(held);
      const heldSize = this.ballRadius * 2;
      ctx.drawImage(
        this.imgBall,
        this.phaseIndex * heldSize,
        0,
        heldSize,
        heldSize,
        held.x - this.ballRadius,
        held.y - this.ballRadius,
        heldSize,
        heldSize,
      );
      return;
    }
    this.updateAnimation(this.position);
    const size = this.ballRadius * 2;
    ctx.drawImage(
      this.imgBall,
      size * this.shadowFrame,
      0,
      size,
      size,
      this.position.x - this.ballRadius + this.shadowOffset + this.position.z,
      this.position.y - this.ballRadius + this.shadowOffset + this.position.z,
      size,
      size,
    );
    ctx.drawImage(
      this.imgBall,
      this.phaseIndex * size,
      0,
      size,
      size,
      this.position.x - this.ballRadius,
      this.position.y - this.ballRadius,
      size,
      size,
    );
  }

  public heldPosition(): Vector3d {
    if (this.heldBy == null) {
      return new Vector3d(this.position.x, this.position.y, this.position.z);
    }
    return new Vector3d(
      this.heldBy.position.x + this.heldBy.facingX * this.heldOffsetX,
      this.heldBy.position.y + this.heldOffsetY,
      0,
    );
  }

  private updateAnimation(position: Vector2d): void {
    const dx = position.x - this.lastAnimationPosition.x;
    const dy = position.y - this.lastAnimationPosition.y;
    const distance = MathLib.vectorLength(dx, dy);
    if (distance > 0) {
      this.rollDistance += distance;
      while (this.rollDistance >= this.spinPxPerPhase) {
        this.phaseIndex = (this.phaseIndex + 1) % this.spritePhases;
        this.rollDistance -= this.spinPxPerPhase;
      }
    } else {
      this.rollDistance = 0;
    }
    this.rememberAnimationPosition(position);
  }

  private holdAnimationAt(position: Vector2d): void {
    this.rollDistance = 0;
    this.rememberAnimationPosition(position);
  }

  private rememberAnimationPosition(position: Vector2d): void {
    this.lastAnimationPosition.x = position.x;
    this.lastAnimationPosition.y = position.y;
  }
}
