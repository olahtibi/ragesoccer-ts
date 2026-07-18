import { math as MathLib } from "../math/math";
import { Vector2 as Vector2d } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { TeamSide } from "../types";
export { Player };

export interface SpriteFrame {
  phaseIndex: number;
  topLeftY: number;
}

class Player {
  public readonly imgPlayer: HTMLImageElement;
  public readonly position: Vector2d;
  public readonly playerSpriteWidth: number;
  public readonly playerSpriteHeight: number;
  public readonly playerSpriteCenterX: number;
  public readonly playerSpriteCenterY: number;
  public facingX: number;
  public facingY: number;
  public velocity: Vector2d;
  public animationFacingX: number;
  public animationFacingY: number;
  public animationDirectionX: number;
  public animationDirectionY: number;
  public animationMoving: boolean;
  public animationIdleSeconds: number;
  public animationLastTimeMs: number | null;
  public readonly animationDirectionResponseRate: number;
  public readonly animationDirectionConfidenceThreshold: number;
  public readonly animationIdleGraceSeconds: number;
  public readonly animationMaxDeltaSeconds: number;
  public readonly spriteSourceRowHeight: number;
  public phaseIndex: number;
  public stepDistance: number;
  public readonly teamSide: TeamSide;
  private readonly stepPxPerPhase: number;
  private readonly spritePhases: number;
  private readonly lastAnimationPosition: Vector2d;

  public constructor(
    imgPlayer: HTMLImageElement,
    position: Vector2d,
    teamSide: TeamSide,
    playerConfig: Configuration["player"],
  ) {
    this.imgPlayer = imgPlayer;
    this.position = position;
    this.playerSpriteWidth = playerConfig.spriteWidth;
    this.playerSpriteHeight = playerConfig.spriteHeight;
    this.playerSpriteCenterX = playerConfig.spriteCenterX;
    this.playerSpriteCenterY = playerConfig.spriteCenterY;
    this.facingX = 0;
    this.facingY = -1;
    this.velocity = new Vector2d(0, 0);
    // Rendering keeps a filtered direction separate from gameplay facing so
    // brief steering changes cannot flash a different sprite row.
    this.animationFacingX = this.facingX;
    this.animationFacingY = this.facingY;
    this.animationDirectionX = this.facingX;
    this.animationDirectionY = this.facingY;
    this.animationMoving = false;
    this.animationIdleSeconds = 0;
    this.animationLastTimeMs = null;
    this.animationDirectionResponseRate =
      playerConfig.animationDirectionResponseRate;
    this.animationDirectionConfidenceThreshold =
      playerConfig.animationDirectionConfidenceThreshold;
    this.animationIdleGraceSeconds = playerConfig.animationIdleGraceSeconds;
    this.animationMaxDeltaSeconds = playerConfig.animationMaxDeltaSeconds;
    this.spriteSourceRowHeight = playerConfig.spriteSourceRowHeight;
    this.stepPxPerPhase = playerConfig.stepPxPerPhase;
    this.spritePhases = playerConfig.spritePhases;
    this.lastAnimationPosition = new Vector2d(this.position.x, this.position.y);
    // Walk-cycle state advances with rendered travel rather than wall-clock
    // time, so the animation naturally freezes when the player does.
    this.phaseIndex = 0;
    this.stepDistance = 0;
    this.teamSide = teamSide;
  }

  public stop(): void {
    this.velocity.x = 0;
    this.velocity.y = 0;
  }

  public placeAt(position: Vector2d): void {
    this.position.x = position.x;
    this.position.y = position.y;
    this.stop();
  }

  public updateFacing(): void {
    if (this.velocity.x == 0 && this.velocity.y == 0) {
      return;
    }
    const facing = this.facingForDirection(this.velocity.x, this.velocity.y);
    this.facingX = facing.x;
    this.facingY = facing.y;
  }

  public facingForDirection(x: number, y: number): Vector2d {
    const alpha = MathLib.computeAngleRadians(x, y);
    const eastNorth = Math.PI / 8; // 22.5 degrees
    const southEast = (3 * Math.PI) / 8; // 67.5 degrees
    const southWest = (5 * Math.PI) / 8; // 112.5 degrees
    const westSouth = (7 * Math.PI) / 8; // 157.5 degrees
    const westNorth = (9 * Math.PI) / 8; // 202.5 degrees
    const northWest = (11 * Math.PI) / 8; // 247.5 degrees
    const northEast = (13 * Math.PI) / 8; // 292.5 degrees
    const eastSouth = (15 * Math.PI) / 8; // 337.5 degrees
    if (alpha <= eastNorth || alpha >= eastSouth) {
      return new Vector2d(1, 0);
    } else if (alpha <= southEast && alpha >= eastNorth) {
      return new Vector2d(1, 1);
    } else if (alpha <= southWest && alpha >= southEast) {
      return new Vector2d(0, 1);
    } else if (alpha <= westSouth && alpha >= southWest) {
      return new Vector2d(-1, 1);
    } else if (alpha <= westNorth && alpha >= westSouth) {
      return new Vector2d(-1, 0);
    } else if (alpha <= northWest && alpha >= westNorth) {
      return new Vector2d(-1, -1);
    } else if (alpha <= northEast && alpha >= northWest) {
      return new Vector2d(0, -1);
    }
    return new Vector2d(1, -1);
  }

  public animationNowMs(): number {
    if (typeof performance != "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  public animationElapsedSeconds(nowMs: number): number {
    if (this.animationLastTimeMs == null) {
      this.animationLastTimeMs = nowMs;
      return 0;
    }
    const elapsed = (nowMs - this.animationLastTimeMs) / 1000;
    this.animationLastTimeMs = nowMs;
    return Math.max(0, Math.min(this.animationMaxDeltaSeconds, elapsed));
  }

  public updateAnimation(nowMs: number | null = null): void {
    nowMs = nowMs == null ? this.animationNowMs() : nowMs;
    const elapsed = this.animationElapsedSeconds(nowMs);
    this.updateWalkAnimation();
    const moving = this.velocity.x != 0 || this.velocity.y != 0;
    this.updateFacing();

    if (!moving) {
      this.animationIdleSeconds += elapsed;
      if (
        !this.animationMoving ||
        this.animationIdleSeconds >= this.animationIdleGraceSeconds
      ) {
        this.animationMoving = false;
        this.animationDirectionX = this.facingX;
        this.animationDirectionY = this.facingY;
        this.animationFacingX = this.facingX;
        this.animationFacingY = this.facingY;
      }
      return;
    }

    const direction = MathLib.normalizeVector(
      this.velocity.x,
      this.velocity.y,
      this.facingX,
      this.facingY,
    );
    this.animationIdleSeconds = 0;
    if (!this.animationMoving) {
      this.animationDirectionX = direction.x;
      this.animationDirectionY = direction.y;
      this.animationMoving = true;
    } else {
      const blend =
        1 - Math.exp(-this.animationDirectionResponseRate * elapsed);
      this.animationDirectionX +=
        (direction.x - this.animationDirectionX) * blend;
      this.animationDirectionY +=
        (direction.y - this.animationDirectionY) * blend;
    }

    const directionConfidence = MathLib.vectorLength(
      this.animationDirectionX,
      this.animationDirectionY,
    );
    if (directionConfidence >= this.animationDirectionConfidenceThreshold) {
      const animationFacing = this.facingForDirection(
        this.animationDirectionX,
        this.animationDirectionY,
      );
      this.animationFacingX = animationFacing.x;
      this.animationFacingY = animationFacing.y;
    }
  }

  private updateWalkAnimation(): void {
    const dx = this.position.x - this.lastAnimationPosition.x;
    const dy = this.position.y - this.lastAnimationPosition.y;
    const distance = MathLib.vectorLength(dx, dy);
    if (distance > 0) {
      this.stepDistance += distance;
      while (this.stepDistance >= this.stepPxPerPhase) {
        this.phaseIndex = (this.phaseIndex + 1) % this.spritePhases;
        this.stepDistance -= this.stepPxPerPhase;
      }
    }
    this.lastAnimationPosition.x = this.position.x;
    this.lastAnimationPosition.y = this.position.y;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const topLeftX = 0;
    const sprite = this.spriteFrame();
    ctx.drawImage(
      this.imgPlayer,
      topLeftX,
      sprite.topLeftY,
      this.playerSpriteWidth,
      this.playerSpriteHeight,
      this.position.x - this.playerSpriteCenterX,
      this.position.y - this.playerSpriteCenterY,
      this.playerSpriteWidth,
      this.playerSpriteHeight,
    );
  }

  public spriteFrame(animationTimeMs: number | null = null): SpriteFrame {
    this.updateAnimation(animationTimeMs);
    const phaseIndex = this.animationMoving ? this.phaseIndex : 0;
    let topLeftY = 0;
    if (this.animationFacingY == -1 && this.animationFacingX == 0) {
      // NORTH
      topLeftY = (6 * 3 + phaseIndex) * this.spriteSourceRowHeight;
    } else if (this.animationFacingY == 1 && this.animationFacingX == 0) {
      // SOUTH
      topLeftY = (7 * 3 + phaseIndex) * this.spriteSourceRowHeight;
    } else if (this.animationFacingY == 0 && this.animationFacingX == -1) {
      // WEST
      topLeftY = (1 * 3 + phaseIndex) * this.spriteSourceRowHeight;
    } else if (this.animationFacingY == 0 && this.animationFacingX == 1) {
      // EAST
      topLeftY = (0 * 3 + phaseIndex) * this.spriteSourceRowHeight;
    } else if (this.animationFacingY == -1 && this.animationFacingX == 1) {
      // NE
      topLeftY = (5 * 3 + phaseIndex) * this.spriteSourceRowHeight;
    } else if (this.animationFacingY == -1 && this.animationFacingX == -1) {
      // NW
      topLeftY = (4 * 3 + phaseIndex) * this.spriteSourceRowHeight;
    } else if (this.animationFacingY == 1 && this.animationFacingX == 1) {
      // SE
      topLeftY = (3 * 3 + phaseIndex) * this.spriteSourceRowHeight;
    } else if (this.animationFacingY == 1 && this.animationFacingX == -1) {
      // SW
      topLeftY = (2 * 3 + phaseIndex) * this.spriteSourceRowHeight;
    }
    return {
      phaseIndex: phaseIndex,
      topLeftY: topLeftY,
    };
  }
}
