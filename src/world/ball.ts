import { math as MathLib } from "../math/math";
import { Vector2 as Vector2d, Vector3 as Vector3d } from "../math/vector";
export { Ball };

class Ball {
  [key: string]: any;
  public constructor(imgBall, ballRadius, position, ballConfig) {
    ballConfig = ballConfig || {};
    this.imgBall = imgBall;
    this.ballRadius = ballRadius;
    this.position = new Vector3d(position.x, position.y, position.z || 0);
    this.velocity = new Vector3d(0, 0, 0);
    this.phaseIndex = 0;
    this.lastTouchedBy = null;
    this.heldBy = null;
    // Accumulated distance rolled since the last sprite phase change.
    this.rollDistance = 0;
    this._spinPxPerPhase = ballConfig.spinPxPerPhase;
    this._spritePhases = ballConfig.spritePhases;
    this._lastAnimationPosition = new Vector2d(
      this.position.x,
      this.position.y,
    );
    this._heldOffsetX = ballConfig.heldOffsetX || 5;
    this._heldOffsetY = ballConfig.heldOffsetY || -8;
    this._shadowFrame = ballConfig.shadowFrame || 4;
    this._shadowOffset = ballConfig.shadowOffset || 1;
  }

  public draw(ctx) {
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
      size * this._shadowFrame,
      0,
      size,
      size,
      this.position.x - this.ballRadius + this._shadowOffset + this.position.z,
      this.position.y - this.ballRadius + this._shadowOffset + this.position.z,
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

  public heldPosition() {
    if (this.heldBy == null) {
      return new Vector3d(this.position.x, this.position.y, this.position.z);
    }
    return new Vector3d(
      this.heldBy.position.x + this.heldBy.facingX * this._heldOffsetX,
      this.heldBy.position.y + this._heldOffsetY,
      0,
    );
  }

  private updateAnimation(position) {
    const dx = position.x - this._lastAnimationPosition.x;
    const dy = position.y - this._lastAnimationPosition.y;
    const distance = MathLib.vectorLength(dx, dy);
    if (distance > 0) {
      this.rollDistance += distance;
      while (this.rollDistance >= this._spinPxPerPhase) {
        this.phaseIndex = (this.phaseIndex + 1) % this._spritePhases;
        this.rollDistance -= this._spinPxPerPhase;
      }
    } else {
      this.rollDistance = 0;
    }
    this.rememberAnimationPosition(position);
  }

  private holdAnimationAt(position) {
    this.rollDistance = 0;
    this.rememberAnimationPosition(position);
  }

  private rememberAnimationPosition(position) {
    this._lastAnimationPosition.x = position.x;
    this._lastAnimationPosition.y = position.y;
  }
}
