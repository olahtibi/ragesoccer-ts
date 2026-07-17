import { math as MathLib } from "../math/math";
export { Physics };

class Physics {
  [key: string]: any;
  public constructor(config, stadium) {
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

  public update() {
    const currentTime = new Date().getTime();
    const dt = this.computeDt(currentTime);
    if (dt == null) {
      return;
    }
    this.lastDt = dt;
    this.updatePlayerPositions(dt);
    this.resolveBallPlayerContacts();
    this.updateBallPosition(dt);
    this.updateStats(currentTime);
  }

  public updatePlayersOnly() {
    const currentTime = new Date().getTime();
    const dt = this.computeDt(currentTime);
    if (dt == null) {
      return;
    }
    this.lastDt = dt;
    this.updatePlayerPositions(dt);
    this.updateStats(currentTime);
  }

  public updateBallOnly() {
    const currentTime = new Date().getTime();
    const dt = this.computeDt(currentTime);
    if (dt == null) return;
    this.lastDt = dt;
    this.updateBallPosition(dt);
    this.updateStats(currentTime);
  }

  // Private helpers

  private computeDt(currentTime) {
    let dt = (currentTime - this.lastUpdated) / 1000.0;
    // Clamp dt so a paused/backgrounded tab doesn't teleport bodies on resume.
    if (dt > this.config.physics.maxDeltaSeconds)
      dt = this.config.physics.maxDeltaSeconds;
    if (dt < 0) dt = 0;
    return dt;
  }

  public resetClock() {
    this.lastUpdated = new Date().getTime();
    this.lastDt = 0;
  }

  private updateStats(currentTime) {
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

  private updatePlayerPositions(dt) {
    for (let i = 0; i < this.stadium.players.length; i++) {
      const p = this.stadium.players[i];
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
    }
  }

  // Circle-circle contact + impulse-based response. Runs once per frame after
  // the players have moved but before the ball has integrated its own velocity.
  private resolveBallPlayerContacts() {
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
      // Contact normal (unit vector from player toward ball).
      const d = Math.sqrt(d2);
      let nx, ny;
      if (d > this.config.physics.zeroDistanceEpsilon) {
        nx = dx / d;
        ny = dy / d;
      } else {
        // Degenerate overlap: fall back to the direction the player is facing.
        const fx = p.facingX || 0;
        const fy = p.facingY || -1;
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

      const jTotal = jBounce + jKick;
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

  private updateBallPosition(dt) {
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

    const moveArray = [ball.velocity.x * dt, ball.velocity.y * dt];

    if (!this.config.restarts.outOfPlayEnabled) {
      this.checkBoxCollision(moveArray);
    }
    this.checkGoalCollision(moveArray);

    ball.position.x += moveArray[0];
    ball.position.y += moveArray[1];
  }

  // Reflect the ball off a vertical-normal wall (horizontal surface, ball crossing pY).
  private reflectY(moveArray) {
    const e = this.config.physics.wallRestitution;
    moveArray[1] = -moveArray[1] * e;
    this.stadium.ball.velocity.y = -this.stadium.ball.velocity.y * e;
  }

  // Reflect the ball off a horizontal-normal wall (vertical surface, ball crossing pX).
  private reflectX(moveArray) {
    const e = this.config.physics.wallRestitution;
    moveArray[0] = -moveArray[0] * e;
    this.stadium.ball.velocity.x = -this.stadium.ball.velocity.x * e;
  }

  private checkGoalCollision(moveArray) {
    if (
      MathLib.isIntersectedVertically(
        this.config.pitch.goalTopTopLeft.x,
        this.config.pitch.goalTopTopRight.x,
        this.config.pitch.goalTopTopLeft.y,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[1],
      )
    ) {
      this.reflectY(moveArray);
    } else if (
      MathLib.isIntersectedVertically(
        this.config.pitch.goalBottomBottomLeft.x,
        this.config.pitch.goalBottomBottomRight.x,
        this.config.pitch.goalBottomBottomLeft.y,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[1],
      )
    ) {
      this.reflectY(moveArray);
    }
    if (
      MathLib.isIntersectedHorizontally(
        this.config.pitch.goalTopTopLeft.y,
        this.config.pitch.goalTopBottomLeft.y,
        this.config.pitch.goalTopTopLeft.x,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[0],
      )
    ) {
      this.reflectX(moveArray);
    } else if (
      MathLib.isIntersectedHorizontally(
        this.config.pitch.goalTopTopRight.y,
        this.config.pitch.goalTopBottomRight.y,
        this.config.pitch.goalTopTopRight.x,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[0],
      )
    ) {
      this.reflectX(moveArray);
    } else if (
      MathLib.isIntersectedHorizontally(
        this.config.pitch.goalBottomTopLeft.y,
        this.config.pitch.goalBottomBottomLeft.y,
        this.config.pitch.goalBottomTopLeft.x,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[0],
      )
    ) {
      this.reflectX(moveArray);
    } else if (
      MathLib.isIntersectedHorizontally(
        this.config.pitch.goalBottomTopRight.y,
        this.config.pitch.goalBottomBottomRight.y,
        this.config.pitch.goalBottomTopRight.x,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[0],
      )
    ) {
      this.reflectX(moveArray);
    }
  }

  private checkBoxCollision(moveArray) {
    if (
      MathLib.isIntersectedVertically(
        this.config.pitch.boxTopLeft.x,
        this.config.pitch.boxTopRight.x,
        this.config.pitch.boxTopLeft.y,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[1],
      )
    ) {
      this.reflectY(moveArray);
    } else if (
      MathLib.isIntersectedVertically(
        this.config.pitch.boxBottomLeft.x,
        this.config.pitch.boxBottomRight.x,
        this.config.pitch.boxBottomLeft.y,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[1],
      )
    ) {
      this.reflectY(moveArray);
    }
    if (
      MathLib.isIntersectedHorizontally(
        this.config.pitch.boxTopLeft.y,
        this.config.pitch.boxBottomLeft.y,
        this.config.pitch.boxTopLeft.x,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[0],
      )
    ) {
      this.reflectX(moveArray);
    } else if (
      MathLib.isIntersectedHorizontally(
        this.config.pitch.boxTopRight.y,
        this.config.pitch.boxBottomRight.y,
        this.config.pitch.boxTopRight.x,
        this.stadium.ball.position.x,
        this.stadium.ball.position.y,
        moveArray[0],
      )
    ) {
      this.reflectX(moveArray);
    }
  }
}
