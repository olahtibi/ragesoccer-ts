import { math as MathLib } from "../math/math";
import { Vector2 as Vector2d } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { TeamSide } from "../types";
export { Player };

export interface SpriteFrame {
  phaseIndex: number;
  state: PlayerAnimationState;
  topLeftX: number;
  topLeftY: number;
}

export type PlayerAnimationState = "idle" | "run" | "kick";

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
  public phaseIndex: number;
  public stepDistance: number;
  public readonly teamSide: TeamSide;
  private facingTarget: Vector2d | null;
  private readonly stepPxPerPhase: number;
  private readonly spriteFrameWidth: number;
  private readonly spriteFrameHeight: number;
  private readonly idleRowOffset: number;
  private readonly runRowOffset: number;
  private readonly kickRowOffset: number;
  private readonly runPhases: number;
  private readonly kickPhases: number;
  private readonly kickDurationSeconds: number;
  private readonly lastAnimationPosition: Vector2d;
  private kickStartedTimeMs: number | null;
  private kickDirectionX: number;
  private kickDirectionY: number;

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
    this.stepPxPerPhase = playerConfig.stepPxPerPhase;
    this.spriteFrameWidth = playerConfig.spriteFrameWidth;
    this.spriteFrameHeight = playerConfig.spriteFrameHeight;
    this.idleRowOffset = playerConfig.idleRowOffset;
    this.runRowOffset = playerConfig.runRowOffset;
    this.kickRowOffset = playerConfig.kickRowOffset;
    this.runPhases = playerConfig.runPhases;
    this.kickPhases = playerConfig.kickPhases;
    this.kickDurationSeconds = playerConfig.kickDurationSeconds;
    this.lastAnimationPosition = new Vector2d(this.position.x, this.position.y);
    // Walk-cycle state advances with rendered travel rather than wall-clock
    // time, so the animation naturally freezes when the player does.
    this.phaseIndex = 0;
    this.stepDistance = 0;
    this.teamSide = teamSide;
    this.facingTarget = null;
    this.kickStartedTimeMs = null;
    this.kickDirectionX = this.facingX;
    this.kickDirectionY = this.facingY;
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
    if (this.facingTarget != null) {
      const dx = this.facingTarget.x - this.position.x;
      const dy = this.facingTarget.y - this.position.y;
      if (dx != 0 || dy != 0) {
        const facing = this.facingForDirection(dx, dy);
        this.facingX = facing.x;
        this.facingY = facing.y;
      }
      return;
    }
    if (this.velocity.x == 0 && this.velocity.y == 0) {
      return;
    }
    const facing = this.facingForDirection(this.velocity.x, this.velocity.y);
    this.facingX = facing.x;
    this.facingY = facing.y;
  }

  public faceTowards(target: Vector2d | null): void {
    this.facingTarget = target;
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

  public playKick(nowMs: number | null = null): void {
    this.updateFacing();
    this.kickDirectionX = this.facingX;
    this.kickDirectionY = this.facingY;
    this.kickStartedTimeMs = nowMs ?? this.animationNowMs();
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

    const direction =
      this.facingTarget == null
        ? MathLib.normalizeVector(
            this.velocity.x,
            this.velocity.y,
            this.facingX,
            this.facingY,
          )
        : new Vector2d(this.facingX, this.facingY);
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
        this.phaseIndex = (this.phaseIndex + 1) % this.runPhases;
        this.stepDistance -= this.stepPxPerPhase;
      }
    }
    this.lastAnimationPosition.x = this.position.x;
    this.lastAnimationPosition.y = this.position.y;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    const sprite = this.spriteFrame();
    ctx.drawImage(
      this.imgPlayer,
      sprite.topLeftX,
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
    const nowMs = animationTimeMs ?? this.animationNowMs();
    this.updateAnimation(nowMs);
    let state: PlayerAnimationState = this.animationMoving ? "run" : "idle";
    let phaseIndex = this.animationMoving ? this.phaseIndex : 0;
    let directionX = this.animationFacingX;
    let directionY = this.animationFacingY;
    let rowOffset = state == "run" ? this.runRowOffset : this.idleRowOffset;

    if (this.kickStartedTimeMs != null) {
      const elapsedSeconds = Math.max(
        0,
        (nowMs - this.kickStartedTimeMs) / 1000,
      );
      if (elapsedSeconds < this.kickDurationSeconds) {
        state = "kick";
        phaseIndex = Math.min(
          this.kickPhases - 1,
          Math.floor(
            (elapsedSeconds / this.kickDurationSeconds) * this.kickPhases,
          ),
        );
        directionX = this.kickDirectionX;
        directionY = this.kickDirectionY;
        rowOffset = this.kickRowOffset;
      } else {
        this.kickStartedTimeMs = null;
      }
    }
    const directionIndex = this.directionIndex(directionX, directionY);
    return {
      phaseIndex: phaseIndex,
      state: state,
      topLeftX: phaseIndex * this.spriteFrameWidth,
      topLeftY: (rowOffset + directionIndex) * this.spriteFrameHeight,
    };
  }

  private directionIndex(x: number, y: number): number {
    if (x == 0 && y == -1) return 0;
    if (x == 1 && y == -1) return 1;
    if (x == 1 && y == 0) return 2;
    if (x == 1 && y == 1) return 3;
    if (x == 0 && y == 1) return 4;
    if (x == -1 && y == 1) return 5;
    if (x == -1 && y == 0) return 6;
    return 7;
  }
}
