import type { Vector2 } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { TeamAiState } from "../types";
import type { Ball } from "../world/ball";
import type { Player } from "../world/player";
import type { Team } from "../world/team";
import { BallAttackerSelector } from "./ballAttackerSelector";
import { CornerFormation } from "./cornerFormation";
import { Formation } from "./formation";
import { FormationMotionPlanner } from "./formationMotionPlanner";
import { IndividualAi, type IndividualAiDebugSnapshot } from "./individualAi";
export { TeamAi };

export interface TeamAiUpdateContext {
  restart: TeamAiRestartContext | null;
}

export interface TeamAiRestartContext {
  sequence: number;
  state: TeamAiState;
  canMove: boolean;
  taker: Player | null;
  positioningTargets: Vector2[] | null;
  attackTarget: Vector2 | null;
}

export interface TeamAiDebugSnapshot extends IndividualAiDebugSnapshot {
  teamState: TeamAiState;
}

class TeamAi {
  public readonly config: Configuration;
  public readonly team: Team;
  public readonly opponentTeam: Team;
  public readonly ball: Ball;
  public readonly formation: Formation;
  private readonly cornerFormation: CornerFormation;
  public state: TeamAiState;
  private cornerTakerIndex: number;
  private cornerPositioningTargets: Vector2[] | null;
  private lastRestartSequence: number | null;
  private readonly individualAis: IndividualAi[];
  private readonly motionPlanner: FormationMotionPlanner;
  private readonly attackerSelector: BallAttackerSelector;

  public constructor(
    config: Configuration,
    team: Team,
    opponentTeam: Team,
    ball: Ball,
  ) {
    this.config = config;
    this.team = team;
    this.opponentTeam = opponentTeam;
    this.ball = ball;
    this.formation = new Formation(config);
    this.cornerFormation = new CornerFormation(config);
    this.state =
      config.restarts.kickoffSide == team.side
        ? "kickoffUs"
        : "kickoffOpponent";
    this.cornerTakerIndex = -1;
    this.cornerPositioningTargets = null;
    this.lastRestartSequence = null;
    this.individualAis = [];
    this.motionPlanner = new FormationMotionPlanner(config, team, ball);
    this.attackerSelector = new BallAttackerSelector(config, team, ball);

    for (let i = 0; i < team.players.length; i++) {
      const individualAi = new IndividualAi(config, team, team.players[i]);
      individualAi.formationPaceMultiplier =
        this.motionPlanner.paceMultiplier(i);
      this.individualAis.push(individualAi);
    }
  }

  public update(deltaSeconds: number, context: TeamAiUpdateContext): void {
    if (!this.config.ai.enabled) {
      return;
    }

    const restartActive = context.restart != null;
    if (
      context.restart != null &&
      context.restart.sequence != this.lastRestartSequence
    ) {
      this.applyRestartState(context.restart.state);
      this.lastRestartSequence = context.restart.sequence;
    }
    this.state = this.nextState(restartActive);
    this.updateCornerContext(context);
    let targets =
      (context.restart != null ? context.restart.positioningTargets : null) ||
      (this.state == "cornerUs" && this.cornerPositioningTargets != null
        ? this.cornerPositioningTargets
        : this.formation.positions(
            this.state,
            this.team.side,
            this.team.players.length,
          ));
    const goalkeeperIndex = this.formation
      .rolesForSize(this.team.players.length)
      .indexOf("goalie");
    if (goalkeeperIndex >= 0) {
      this.team.players[goalkeeperIndex].faceTowards(this.ball.position);
    }
    if (!restartActive && goalkeeperIndex >= 0) {
      targets[goalkeeperIndex] = this.goalkeeperTarget(
        targets[goalkeeperIndex],
      );
    }
    const openPlayFormation =
      !restartActive && (this.state == "attack" || this.state == "defense");
    targets = this.motionPlanner.targets(
      targets,
      deltaSeconds,
      openPlayFormation,
    );
    const chasingCornerCross = this.state == "cornerUs" && !restartActive;
    const closest = chasingCornerCross
      ? this.team.side == "home"
        ? this.team.humanPlayer
        : null
      : this.team.side == "home"
        ? this.team.humanPlayer
        : (context.restart != null ? context.restart.taker : null) ||
          this.attackerSelector.select();
    const commandContext = {
      ball: this.ball,
      team: this.team,
      opponentTeam: this.opponentTeam,
      attackTarget:
        context.restart != null ? context.restart.attackTarget : null,
    };

    for (let i = 0; i < this.individualAis.length; i++) {
      const ai = this.individualAis[i];
      if (context.restart != null && context.restart.canMove == false) {
        ai.player.stop();
        ai.setCommand("inactive", null);
      } else if (this.team.side == "home" && ai.player === closest) {
        ai.player.stop();
        ai.setCommand("inactive", null);
      } else if (chasingCornerCross && this.shouldChaseCorner(i)) {
        ai.setCommand("attackBall", null);
      } else if (this.team.side != "home" && ai.player === closest) {
        ai.setCommand("attackBall", null);
      } else {
        ai.setCommand("moveToPosition", targets[i]);
      }
      ai.update(commandContext);
    }
  }

  private updateCornerContext(context: TeamAiUpdateContext): void {
    if (this.state != "cornerUs") {
      this.cornerTakerIndex = -1;
      this.cornerPositioningTargets = null;
      return;
    }
    if (context.restart != null && context.restart.taker != null) {
      this.cornerTakerIndex = this.team.players.indexOf(context.restart.taker);
    }
    if (context.restart != null && context.restart.positioningTargets != null) {
      this.cornerPositioningTargets = context.restart.positioningTargets;
    }
  }

  private goalkeeperTarget(formationTarget: Vector2): Vector2 {
    const left = this.config.pitch.goalTopTopLeft.x + this.config.player.radius;
    const right =
      this.config.pitch.goalTopTopRight.x - this.config.player.radius;
    const target = formationTarget.clone();
    target.x = Math.max(left, Math.min(right, this.ball.position.x));
    return target;
  }

  private shouldChaseCorner(playerIndex: number): boolean {
    const groups = this.cornerFormation.assignments(
      this.team.players.length,
      this.cornerTakerIndex,
    );
    if (groups[playerIndex] == "box") return true;
    return (
      groups[playerIndex] == "late" &&
      this.cornerBallProgress() >=
        this.config.restarts.cornerLateRunReleaseDistance
    );
  }

  private cornerBallProgress(): number {
    return this.team.side == "home"
      ? this.ball.position.y - this.config.pitch.fieldTop
      : this.config.pitch.fieldBottom - this.ball.position.y;
  }

  private applyRestartState(state: TeamAiState): void {
    this.state = state;
    this.attackerSelector.reset();
  }

  private nextState(restartActive: boolean): TeamAiState {
    if (restartActive) {
      return this.state;
    }

    if (this.state == "cornerUs" && !this.cornerAttackResolved()) {
      return this.state;
    }

    if (this.isBallInOwnHalf()) {
      return "defense";
    }

    if (this.isBallInOpponentHalf()) {
      return "attack";
    }

    if (this.state == "defense" || this.state == "attack") {
      return this.state;
    }
    return "attack";
  }

  private cornerAttackResolved(): boolean {
    if (
      this.ball.lastTouchedBy != null &&
      this.ball.lastTouchedBy != this.team.side
    ) {
      return true;
    }

    if (this.team.side == "home") {
      return (
        this.ball.position.y >=
        this.config.pitch.fieldTop + this.config.restarts.cornerCrossDistance
      );
    }
    return (
      this.ball.position.y <=
      this.config.pitch.fieldBottom - this.config.restarts.cornerCrossDistance
    );
  }

  private isBallInOwnHalf(): boolean {
    const y = this.ball.position.y;
    if (this.team.side == "home") {
      return y > this.config.pitch.aiCenterY;
    }
    return y < this.config.pitch.aiCenterY;
  }

  private isBallInOpponentHalf(): boolean {
    const y = this.ball.position.y;
    if (this.team.side == "home") {
      return y < this.config.pitch.aiCenterY;
    }
    return y > this.config.pitch.aiCenterY;
  }

  public debugSnapshot(): TeamAiDebugSnapshot[] {
    const result: TeamAiDebugSnapshot[] = [];
    for (let i = 0; i < this.individualAis.length; i++) {
      const snapshot = this.individualAis[i].debugSnapshot();
      result.push({ ...snapshot, teamState: this.state });
    }
    return result;
  }

  public coordinatorSnapshot() {
    return {
      attacker: this.attackerSelector.snapshot(),
      cornerTakerIndex: this.cornerTakerIndex,
      motion: this.motionPlanner.debugSnapshot(),
    };
  }
}
