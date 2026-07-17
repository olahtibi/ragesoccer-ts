import { math as MathLib } from "../math/math";
import { Vector2 as Vector2d } from "../math/vector";
import { createIndividualAiCommandRegistry } from "./commands/commandRegistry";
export { IndividualAi };

class IndividualAi {
  [key: string]: any;
  public constructor(config, team, player) {
    this.config = config;
    this.team = team;
    this.player = player;
    this.command = "inactive";
    this.target = null;
    this.tPos = null;
    this.commands = createIndividualAiCommandRegistry();
    this.activeCommand = this.commands[this.command];
    this.formationPaceMultiplier = 1;
  }

  public setCommand(command, target) {
    if (
      this.command != command &&
      this.activeCommand != null &&
      this.activeCommand.reset != null
    ) {
      this.activeCommand.reset(this);
    }
    this.command = command;
    this.target = target || null;
    this.activeCommand = this.commands[this.command] || null;
  }

  public update(context) {
    if (this.activeCommand == null) {
      this.stop();
      return;
    }

    this.activeCommand.update(this, context);
  }

  public toOpponentGoal(ballPosition) {
    let goal;
    if (this.team.side == "home") {
      goal = new Vector2d(
        (this.config.pitch.goalTopTopLeft.x +
          this.config.pitch.goalTopTopRight.x) /
          2,
        (this.config.pitch.goalTopTopLeft.y +
          this.config.pitch.goalTopBottomLeft.y) /
          2,
      );
    } else {
      goal = new Vector2d(
        (this.config.pitch.goalBottomTopLeft.x +
          this.config.pitch.goalBottomTopRight.x) /
          2,
        (this.config.pitch.goalBottomTopLeft.y +
          this.config.pitch.goalBottomBottomLeft.y) /
          2,
      );
    }

    const dx = goal.x - ballPosition.x;
    const dy = goal.y - ballPosition.y;
    return MathLib.normalizeVector(dx, dy, 0, 1);
  }

  public isAlignedBehindBall(ballPosition, toGoal, tolerance) {
    const dx = this.player.position.x - ballPosition.x;
    const dy = this.player.position.y - ballPosition.y;
    if (dx * dx + dy * dy < 0.0001) {
      return false;
    }
    const anglePlayer = MathLib.computeAngleRadians(dx, dy);
    const angleBehind = MathLib.computeAngleRadians(-toGoal.x, -toGoal.y);
    tolerance =
      tolerance == null ? this.config.ai.attackAimToleranceRadians : tolerance;
    return (
      Math.abs(MathLib.angleDeltaRadians(angleBehind, anglePlayer)) <= tolerance
    );
  }

  public moveTo(target, targetReachedRadius) {
    this.tPos = target;

    const dx = target.x - this.player.position.x;
    const dy = target.y - this.player.position.y;
    const distance = MathLib.vectorLength(dx, dy);
    const reachedRadius =
      targetReachedRadius == null
        ? this.config.ai.targetReachedRadius
        : targetReachedRadius;
    if (distance <= reachedRadius) {
      return this.stop();
    }

    const speed = this.config.teamVelocity(this.team.side);
    this.player.velocity.x = (dx / distance) * speed;
    this.player.velocity.y = (dy / distance) * speed;
    return "moving";
  }

  public moveToFormationPosition(target, resumeFromStop) {
    this.tPos = target;

    const dx = target.x - this.player.position.x;
    const dy = target.y - this.player.position.y;
    const distance = MathLib.vectorLength(dx, dy);
    const deadband =
      this.config.ai.targetDeadband || this.config.ai.targetReachedRadius;
    const resumeRadius = this.config.ai.targetResumeRadius || deadband;
    const reachedRadius = resumeFromStop
      ? Math.max(deadband, resumeRadius)
      : deadband;
    if (distance <= reachedRadius) {
      return this.stop();
    }

    const arrivalRadius = this.config.ai.arrivalSlowRadius || 0;
    let arrivalFactor = 1;
    if (arrivalRadius > 0 && distance < arrivalRadius) {
      const minFactor = this.config.ai.arrivalMinSpeedFactor || 0;
      arrivalFactor = minFactor + ((1 - minFactor) * distance) / arrivalRadius;
    }

    const speed =
      this.config.teamVelocity(this.team.side) *
      this.formationPaceMultiplier *
      arrivalFactor;
    this.player.velocity.x = (dx / distance) * speed;
    this.player.velocity.y = (dy / distance) * speed;
    return "moving";
  }

  public stop() {
    this.player.velocity.x = 0;
    this.player.velocity.y = 0;
    return "stopped";
  }

  public debugSnapshot() {
    const snapshot = {
      command: this.command,
      state: this.activeCommand != null ? this.activeCommand.state : "stopped",
      target: this.tPos,
    };
    if (
      this.activeCommand != null &&
      this.activeCommand.debugSnapshot != null
    ) {
      const commandSnapshot = this.activeCommand.debugSnapshot(this);
      for (const key in commandSnapshot) {
        snapshot[key] = commandSnapshot[key];
      }
    }
    return snapshot;
  }
}
