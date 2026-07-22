import { math as MathLib } from "../math/math";
import { Vector2 } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { Stadium } from "./stadium";
export { Physics };

export type PhysicsUpdateMode =
  "full" | "playersOnly" | "ballOnly" | "cutscene";

interface CollisionSegment {
  name: string;
  axis: "x" | "y";
  fixed: number;
  start: number;
  end: number;
}

class Physics {
  public readonly config: Configuration;
  public readonly stadium: Stadium;
  public lastUpdated: number;
  public fps: number;
  public displayFps: number;
  public readonly deltaArr: number[];
  public readonly fpsDisplayIntervalMs: number;
  public lastFpsDisplayUpdated: number;
  public frameNumber: number;
  public lastDt: number;

  public constructor(config: Configuration, stadium: Stadium) {
    this.config = config;
    this.stadium = stadium;
    this.lastUpdated = new Date().getTime();
    this.fps = 0.0;
    this.displayFps = 0;
    this.deltaArr = [];
    this.fpsDisplayIntervalMs = config.physics.fpsDisplayIntervalMs;
    this.lastFpsDisplayUpdated = 0;
    this.frameNumber = 0;
    this.lastDt = 0;
  }

  public update(mode: PhysicsUpdateMode): void {
    const currentTime = new Date().getTime();
    const dt = this.computeDt(currentTime);
    this.lastDt = dt;
    if (mode != "ballOnly") this.updatePlayerPositions(dt);
    if (mode == "full") this.resolveBallPlayerContacts();
    if (mode != "playersOnly") this.updateBallPosition(dt);
    this.updateStats(currentTime);
  }

  // Private helpers

  private computeDt(currentTime: number): number {
    let dt = (currentTime - this.lastUpdated) / 1000.0;
    // Clamp dt so a paused/backgrounded tab doesn't teleport bodies on resume.
    if (dt > this.config.physics.maxDeltaSeconds)
      dt = this.config.physics.maxDeltaSeconds;
    if (dt < 0) dt = 0;
    return dt;
  }

  public resetClock(): void {
    this.lastUpdated = new Date().getTime();
    this.lastDt = 0;
  }

  private updateStats(currentTime: number): void {
    this.frameNumber++;
    const deltaT = currentTime - this.lastUpdated;
    const sampleFrames = this.config.physics.statsSampleFrames;
    if (this.deltaArr.length < sampleFrames) {
      this.deltaArr.push(deltaT);
    } else {
      this.deltaArr[this.frameNumber % sampleFrames] = deltaT;
    }
    let avg = 0.0;
    for (let i = 0; i < this.deltaArr.length; i++) {
      avg += this.deltaArr[i];
    }
    avg /= this.deltaArr.length;
    this.fps = avg > 0 ? 1000.0 / avg : 0;
    if (
      this.displayFps === 0 ||
      currentTime - this.lastFpsDisplayUpdated >= this.fpsDisplayIntervalMs
    ) {
      this.displayFps = Math.round(this.fps);
      this.lastFpsDisplayUpdated = currentTime;
    }
    this.lastUpdated = currentTime;
  }

  private updatePlayerPositions(dt: number): void {
    for (let i = 0; i < this.stadium.players.length; i++) {
      const p = this.stadium.players[i];
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
    }
  }

  // Circle-circle contact + impulse-based response. Runs once per frame after
  // the players have moved but before the ball has integrated its own velocity.
  private resolveBallPlayerContacts(): void {
    const ball = this.stadium.ball;
    // A high, lofted ball flies over the player and cannot be touched.
    if (ball.position.z > this.config.physics.ballContactMaxZ) {
      return;
    }
    const contactDist = this.config.ball.radius + this.config.player.radius;
    const contactDist2 = contactDist * contactDist;

    for (let i = 0; i < this.stadium.players.length; i++) {
      const p = this.stadium.players[i];
      const dx = ball.position.x - p.position.x;
      const dy = ball.position.y - p.position.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= contactDist2) {
        continue;
      }
      ball.lastTouchedBy = p.teamSide;
      ball.lastTouchedPlayer = p;
      ball.intendedReceiver = null;
      // Contact normal (unit vector from player toward ball).
      const d = Math.sqrt(d2);
      let nx: number;
      let ny: number;
      if (d > this.config.physics.zeroDistanceEpsilon) {
        nx = dx / d;
        ny = dy / d;
      } else {
        // Degenerate overlap: fall back to the direction the player is facing.
        const fx = p.facingX;
        const fy = p.facingY;
        const fallback = MathLib.normalizeVector(fx, fy, 0, -1);
        nx = fallback.x;
        ny = fallback.y;
      }

      // Player and ball velocities projected onto the normal.
      const vpN = p.velocity.x * nx + p.velocity.y * ny; // player toward ball (positive = closing in)
      const vbN = ball.velocity.x * nx + ball.velocity.y * ny; // ball along +n

      // Relative approach along the normal. Only apply the bounce impulse if
      // the pair is actually closing; otherwise we'd suck the ball back in.
      const vRel = vbN - vpN;
      const restitution = this.config.physics.ballPlayerRestitution;
      const jBounce = vRel < 0 ? -(1 + restitution) * vRel : 0;

      // Active kick impulse: a small base "tap" plus a boost from the player's
      // closing speed. Both are along the outward normal.
      const approach = Math.max(0, vpN);
      const jKick =
        this.config.physics.baseKickBoost +
        approach * this.config.physics.playerMomentumTransfer;

      const jTotal = (jBounce + jKick) * ball.consumeKickImpulseMultiplier();
      if (jTotal > 0) p.playKick();
      // Applied along +n (outward from the player).
      ball.velocity.x += nx * jTotal;
      ball.velocity.y += ny * jTotal;

      // Cap the resulting horizontal speed so pathological momentum stacks
      // never produce absurd velocities.
      const sp2 =
        ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y;
      const maxSp = this.config.physics.maxKickSpeed;
      if (sp2 > maxSp * maxSp) {
        const sp = Math.sqrt(sp2);
        ball.velocity.x = (ball.velocity.x / sp) * maxSp;
        ball.velocity.y = (ball.velocity.y / sp) * maxSp;
      }

      // Loft: scale with the total outgoing impulse so harder kicks fly higher,
      // and add a small base lift so even taps show a visible hop.
      const loft =
        this.config.physics.baseLoft +
        jTotal * this.config.physics.kickLoftFactor;
      if (loft > ball.velocity.z) {
        ball.velocity.z = loft;
      }

      // Positional correction: push the ball to just outside the contact circle
      // so the pair doesn't stay overlapping and re-trigger every frame.
      const eps = this.config.physics.contactEpsilon;
      ball.position.x = p.position.x + nx * (contactDist + eps);
      ball.position.y = p.position.y + ny * (contactDist + eps);
    }
  }

  private updateBallPosition(dt: number): void {
    const ball = this.stadium.ball;

    // Vertical motion: gravity + ground bounce with restitution.
    if (ball.position.z > 0 || ball.velocity.z > 0) {
      ball.velocity.z -= this.config.physics.gravity * dt;
      ball.position.z += ball.velocity.z * dt;
      if (ball.position.z <= 0) {
        ball.position.z = 0;
        if (ball.velocity.z < 0) {
          ball.velocity.z =
            -ball.velocity.z * this.config.physics.ballGroundRestitution;
          if (ball.velocity.z < this.config.physics.minBounceVelocity) {
            ball.velocity.z = 0;
          }
          // Landing scrubs a bit of horizontal speed.
          ball.velocity.x *= this.config.physics.groundImpactDamping;
          ball.velocity.y *= this.config.physics.groundImpactDamping;
        }
      }
    }

    // Horizontal friction: exponential decay. Airborne balls decay slower.
    const mu =
      ball.position.z > 0
        ? this.config.physics.ballAirFriction
        : this.config.physics.ballFriction;
    const decay = Math.exp(-mu * dt);
    ball.velocity.x *= decay;
    ball.velocity.y *= decay;

    // Snap sub-threshold velocities to zero to avoid endless jitter.
    const speed2 =
      ball.velocity.x * ball.velocity.x + ball.velocity.y * ball.velocity.y;
    const minV = this.config.physics.minVelocity;
    if (speed2 < minV * minV) {
      ball.velocity.x = 0;
      ball.velocity.y = 0;
    }

    const movement = new Vector2(ball.velocity.x * dt, ball.velocity.y * dt);

    if (!this.config.restarts.outOfPlayEnabled) {
      this.processCollisions(movement, this.fieldWalls());
    }
    this.processCollisions(movement, this.goalWalls());

    ball.position.x += movement.x;
    ball.position.y += movement.y;
  }

  private reflectY(movement: Vector2): void {
    const e = this.config.physics.wallRestitution;
    movement.y = -movement.y * e;
    this.stadium.ball.velocity.y = -this.stadium.ball.velocity.y * e;
  }

  private reflectX(movement: Vector2): void {
    const e = this.config.physics.wallRestitution;
    movement.x = -movement.x * e;
    this.stadium.ball.velocity.x = -this.stadium.ball.velocity.x * e;
  }

  private processCollisions(
    movement: Vector2,
    segments: CollisionSegment[],
  ): void {
    let reflectedX = false;
    let reflectedY = false;
    const ball = this.stadium.ball;
    for (const segment of segments) {
      if (segment.axis == "y" && !reflectedY) {
        if (
          MathLib.isIntersectedVertically(
            segment.start,
            segment.end,
            segment.fixed,
            ball.position.x,
            ball.position.y,
            movement.y,
          )
        ) {
          this.reflectY(movement);
          reflectedY = true;
        }
      } else if (segment.axis == "x" && !reflectedX) {
        if (
          MathLib.isIntersectedHorizontally(
            segment.start,
            segment.end,
            segment.fixed,
            ball.position.x,
            ball.position.y,
            movement.x,
          )
        ) {
          this.reflectX(movement);
          reflectedX = true;
        }
      }
    }
  }

  private fieldWalls(): CollisionSegment[] {
    const p = this.config.pitch;
    return [
      {
        name: "fieldTop",
        axis: "y",
        fixed: p.boxTopLeft.y,
        start: p.boxTopLeft.x,
        end: p.boxTopRight.x,
      },
      {
        name: "fieldBottom",
        axis: "y",
        fixed: p.boxBottomLeft.y,
        start: p.boxBottomLeft.x,
        end: p.boxBottomRight.x,
      },
      {
        name: "fieldLeft",
        axis: "x",
        fixed: p.boxTopLeft.x,
        start: p.boxTopLeft.y,
        end: p.boxBottomLeft.y,
      },
      {
        name: "fieldRight",
        axis: "x",
        fixed: p.boxTopRight.x,
        start: p.boxTopRight.y,
        end: p.boxBottomRight.y,
      },
    ];
  }

  private goalWalls(): CollisionSegment[] {
    const p = this.config.pitch;
    return [
      {
        name: "topGoalBack",
        axis: "y",
        fixed: p.goalTopTopLeft.y,
        start: p.goalTopTopLeft.x,
        end: p.goalTopTopRight.x,
      },
      {
        name: "bottomGoalBack",
        axis: "y",
        fixed: p.goalBottomBottomLeft.y,
        start: p.goalBottomBottomLeft.x,
        end: p.goalBottomBottomRight.x,
      },
      {
        name: "topGoalLeft",
        axis: "x",
        fixed: p.goalTopTopLeft.x,
        start: p.goalTopTopLeft.y,
        end: p.goalTopBottomLeft.y,
      },
      {
        name: "topGoalRight",
        axis: "x",
        fixed: p.goalTopTopRight.x,
        start: p.goalTopTopRight.y,
        end: p.goalTopBottomRight.y,
      },
      {
        name: "bottomGoalLeft",
        axis: "x",
        fixed: p.goalBottomTopLeft.x,
        start: p.goalBottomTopLeft.y,
        end: p.goalBottomBottomLeft.y,
      },
      {
        name: "bottomGoalRight",
        axis: "x",
        fixed: p.goalBottomTopRight.x,
        start: p.goalBottomTopRight.y,
        end: p.goalBottomBottomRight.y,
      },
    ];
  }
}
