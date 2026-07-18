import { math as MathLib } from "../math/math";
import { Vector2 as Vector2d } from "../math/vector";
import type { Vector2 } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { IndividualCommandName } from "../types";
import type { Ball } from "../world/ball";
import type { Player } from "../world/player";
import type { Team } from "../world/team";
import {
  createIndividualAiCommandRegistry,
  type IndividualAiCommandRegistry,
} from "./commands/commandRegistry";
export { IndividualAi };

export interface IndividualAiContext {
  ball: Ball;
  attackTarget: Vector2 | null;
}

export interface CommandDebugSnapshot {
  state: string;
  attackOrbitDir?: number;
  correctingAim?: boolean;
}

export interface IndividualAiDebugSnapshot extends CommandDebugSnapshot {
  command: IndividualCommandName;
  target: Vector2 | null;
}

export interface IndividualAiCommand {
  state: string;
  reset?: () => void;
  update: (ai: IndividualAi, context: IndividualAiContext) => void;
  debugSnapshot?: () => CommandDebugSnapshot;
}

class IndividualAi {
  public readonly config: Configuration;
  public readonly team: Team;
  public readonly player: Player;
  public command: IndividualCommandName;
  public target: Vector2 | null;
  public tPos: Vector2 | null;
  public readonly commands: IndividualAiCommandRegistry;
  public activeCommand: IndividualAiCommand | null;
  public formationPaceMultiplier: number;

  public constructor(config: Configuration, team: Team, player: Player) {
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

  public setCommand(
    command: IndividualCommandName,
    target: Vector2 | null = null,
  ): void {
    if (
      this.command != command &&
      this.activeCommand != null &&
      this.activeCommand.reset != null
    ) {
      this.activeCommand.reset();
    }
    this.command = command;
    this.target = target;
    this.activeCommand = this.commands[this.command];
  }

  public update(context: IndividualAiContext): void {
    if (this.activeCommand == null) {
      this.stop();
      return;
    }

    this.activeCommand.update(this, context);
  }

  public toOpponentGoal(ballPosition: Vector2): Vector2 {
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

  public isAlignedBehindBall(
    ballPosition: Vector2,
    toGoal: Vector2,
    tolerance: number | null = null,
  ): boolean {
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

  public moveTo(
    target: Vector2,
    targetReachedRadius: number | null = null,
  ): "stopped" | "moving" {
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

  public moveToFormationPosition(
    target: Vector2,
    resumeFromStop: boolean,
  ): "stopped" | "moving" {
    this.tPos = target;

    const dx = target.x - this.player.position.x;
    const dy = target.y - this.player.position.y;
    const distance = MathLib.vectorLength(dx, dy);
    const deadband = this.config.ai.targetDeadband;
    const resumeRadius = this.config.ai.targetResumeRadius;
    const reachedRadius = resumeFromStop
      ? Math.max(deadband, resumeRadius)
      : deadband;
    if (distance <= reachedRadius) {
      return this.stop();
    }

    const arrivalRadius = this.config.ai.arrivalSlowRadius;
    let arrivalFactor = 1;
    if (arrivalRadius > 0 && distance < arrivalRadius) {
      const minFactor = this.config.ai.arrivalMinSpeedFactor;
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

  public stop(): "stopped" {
    this.player.velocity.x = 0;
    this.player.velocity.y = 0;
    return "stopped";
  }

  public debugSnapshot(): IndividualAiDebugSnapshot {
    const snapshot: IndividualAiDebugSnapshot = {
      command: this.command,
      state: this.activeCommand != null ? this.activeCommand.state : "stopped",
      target: this.tPos,
    };
    if (
      this.activeCommand != null &&
      this.activeCommand.debugSnapshot != null
    ) {
      Object.assign(snapshot, this.activeCommand.debugSnapshot());
    }
    return snapshot;
  }
}
