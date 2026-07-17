import { math as MathLib } from "../../math/math";
import { Vector2 as Vector2d } from "../../math/vector";
export { AttackBallCommand };

class AttackBallCommand {
  [key: string]: any;
  public constructor() {
    this.state = "stopped";
    this.attackOrbitDir = 0;
    this.correctingAim = false;
  }

  public reset() {
    this.state = "stopped";
    this.attackOrbitDir = 0;
    this.correctingAim = false;
  }

  public update(ai, context) {
    const target = this.attackBallTarget(ai, context);
    const reachedRadius = this.correctingAim
      ? ai.config.ai.attackCorrectionReachedRadius
      : null;
    ai.moveTo(target, reachedRadius);
  }

  private attackBallTarget(ai, context) {
    const ball = context.ball;
    const toTarget =
      context.attackTarget == null
        ? ai.toOpponentGoal(ball.position)
        : MathLib.normalizeVector(
            context.attackTarget.x - ball.position.x,
            context.attackTarget.y - ball.position.y,
            0,
            ai.team.side == "home" ? -1 : 1,
          );
    const wasShooting = this.state == "shoot";
    const aimError = this.attackAimError(ai, ball.position, toTarget);
    const alignmentTolerance = wasShooting
      ? ai.config.ai.attackAimReleaseToleranceRadians
      : ai.config.ai.attackAimToleranceRadians;
    if (aimError <= alignmentTolerance) {
      this.state = "shoot";
      if (wasShooting && aimError > ai.config.ai.attackAimToleranceRadians) {
        this.correctingAim = true;
      }
      if (
        this.correctingAim &&
        aimError > ai.config.ai.attackAimCorrectionToleranceRadians
      ) {
        return this.attackDetourTarget(ai, ball.position, toTarget);
      }
      this.correctingAim = false;
      this.attackOrbitDir = 0;
      return new Vector2d(
        ball.position.x + toTarget.x * ai.config.ai.attackRunThroughDistance,
        ball.position.y + toTarget.y * ai.config.ai.attackRunThroughDistance,
      );
    }

    this.correctingAim = false;
    if (
      MathLib.computeDistance(ai.player.position, ball.position) <=
      ai.config.ai.attackCloseDistance
    ) {
      this.state = "detour";
      return this.attackDetourTarget(ai, ball.position, toTarget);
    }

    this.attackOrbitDir = 0;
    this.state = "approach";
    return new Vector2d(
      ball.position.x - toTarget.x * ai.config.ai.attackSetupDistance,
      ball.position.y - toTarget.y * ai.config.ai.attackSetupDistance,
    );
  }

  private attackAimError(ai, ballPosition, toTarget) {
    const dx = ai.player.position.x - ballPosition.x;
    const dy = ai.player.position.y - ballPosition.y;
    if (dx * dx + dy * dy < 0.0001) {
      return Math.PI;
    }
    const anglePlayer = MathLib.computeAngleRadians(dx, dy);
    const angleBehind = MathLib.computeAngleRadians(-toTarget.x, -toTarget.y);
    return Math.abs(MathLib.angleDeltaRadians(angleBehind, anglePlayer));
  }

  private attackDetourTarget(ai, ballPosition, toGoal) {
    const dx = ai.player.position.x - ballPosition.x;
    const dy = ai.player.position.y - ballPosition.y;
    const anglePlayer = MathLib.computeAngleRadians(dx, dy);
    const angleBehind = MathLib.computeAngleRadians(-toGoal.x, -toGoal.y);
    const delta = MathLib.angleDeltaRadians(angleBehind, anglePlayer);
    const absDelta = Math.abs(delta);

    if (this.attackOrbitDir === 0) {
      this.attackOrbitDir = delta >= 0 ? 1 : -1;
    } else if (absDelta < ai.config.ai.attackOrbitCommitAngle) {
      const wanted = delta >= 0 ? 1 : -1;
      if (wanted !== this.attackOrbitDir) {
        this.attackOrbitDir = wanted;
      }
    }

    const step = Math.min(ai.config.ai.attackDetourStepRadians, absDelta);
    const angle = anglePlayer + this.attackOrbitDir * step;
    const radius = ai.config.ai.attackDetourRadius;
    const offset = MathLib.vectorFromAngleRadians(angle, radius);
    return new Vector2d(ballPosition.x + offset.x, ballPosition.y + offset.y);
  }

  public debugSnapshot() {
    return {
      state: this.state,
      attackOrbitDir: this.attackOrbitDir,
      correctingAim: this.correctingAim,
    };
  }
}
