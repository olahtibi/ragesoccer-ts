import { math as MathLib } from "../math/math";
import { Vector2 as Vector2d } from "../math/vector";
import type { Vector2 } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { TeamAiState } from "../types";
import type { Ball } from "../world/ball";
import type { Player } from "../world/player";
import type { Team } from "../world/team";
import { Formation, type FormationRole } from "./formation";
import { IndividualAi, type IndividualAiDebugSnapshot } from "./individualAi";
export { TeamAi };

export interface TeamAiUpdateContext {
  deltaSeconds: number;
  restartActive: boolean;
  canMove: boolean;
  restartTaker: Player | null;
  positioningTargets: Vector2[] | null;
  attackTarget: Vector2 | null;
}

export interface TeamAiDebugSnapshot extends IndividualAiDebugSnapshot {
  teamState: TeamAiState;
}

interface MovementProfile {
  role: FormationRole;
  paceValue: number;
  paceMultiplier: number;
  lateralBias: number;
  depthBias: number;
  responseRate: number;
  ballResponseMultiplier: number;
  smoothedTarget: Vector2 | null;
  wanderStep: number;
  wanderElapsed: number;
  wanderDuration: number;
  wanderFrom: Vector2;
  wanderTo: Vector2;
}

class TeamAi {
  public readonly config: Configuration;
  public readonly team: Team;
  public readonly opponentTeam: Team;
  public readonly ball: Ball;
  public readonly formation: Formation;
  public state: TeamAiState;
  public ballAttacker: Player | null;
  public cornerTakerIndex: number;
  public cornerPositioningTargets: Vector2[] | null;
  private readonly individualAis: IndividualAi[];
  public readonly movementProfiles: MovementProfile[];

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
    this.state =
      config.restarts.kickoffSide == team.side
        ? "kickoffUs"
        : "kickoffOpponent";
    this.ballAttacker = null;
    this.cornerTakerIndex = -1;
    this.cornerPositioningTargets = null;
    this.individualAis = [];
    this.movementProfiles = this.createMovementProfiles();

    for (let i = 0; i < team.players.length; i++) {
      const individualAi = new IndividualAi(config, team, team.players[i]);
      individualAi.formationPaceMultiplier =
        this.movementProfiles[i].paceMultiplier;
      this.individualAis.push(individualAi);
    }
  }

  public update(context: TeamAiUpdateContext): void {
    if (!this.config.ai.enabled) {
      return;
    }

    const restartActive = context.restartActive == true;
    this.state = this.nextState(restartActive);
    this.updateCornerContext(context);
    let targets =
      context.positioningTargets ||
      (this.state == "cornerUs" && this.cornerPositioningTargets != null
        ? this.cornerPositioningTargets
        : this.formation.positions(
            this.state,
            this.team.side,
            this.team.players.length,
          ));
    const openPlayFormation =
      !restartActive && (this.state == "attack" || this.state == "defense");
    targets = openPlayFormation
      ? this.openPlayTargets(targets, context.deltaSeconds)
      : this.exactTargets(targets);
    const chasingCornerCross = this.state == "cornerUs" && !restartActive;
    const closest = chasingCornerCross
      ? this.team.side == "home"
        ? this.team.humanPlayer
        : null
      : this.team.side == "home"
        ? this.team.humanPlayer
        : context.restartTaker || this.selectedBallAttacker();
    const commandContext = {
      ball: this.ball,
      team: this.team,
      opponentTeam: this.opponentTeam,
      attackTarget: context.attackTarget || null,
    };

    for (let i = 0; i < this.individualAis.length; i++) {
      const ai = this.individualAis[i];
      if (context.canMove == false) {
        ai.player.velocity.x = 0;
        ai.player.velocity.y = 0;
        ai.setCommand("inactive", null);
      } else if (this.team.side == "home" && ai.player === closest) {
        ai.player.velocity.x = 0;
        ai.player.velocity.y = 0;
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
    if (context.restartTaker != null) {
      this.cornerTakerIndex = this.team.players.indexOf(context.restartTaker);
    }
    if (context.positioningTargets != null) {
      this.cornerPositioningTargets = context.positioningTargets;
    }
  }

  private createMovementProfiles(): MovementProfile[] {
    const roles = this.formation.rolesForSize(this.team.players.length);
    const profiles: MovementProfile[] = [];
    const paceValues: number[] = [];
    let paceTotal = 0;

    for (let i = 0; i < roles.length; i++) {
      const isGoalie = roles[i] == "goalie";
      const paceValue = isGoalie ? 0 : this.profileValue(i, 1);
      profiles.push({
        role: roles[i],
        paceValue: paceValue,
        paceMultiplier: 1,
        lateralBias: isGoalie
          ? 0
          : this.profileValue(i, 2) * this.config.ai.formationLateralVariation,
        depthBias: isGoalie
          ? 0
          : this.profileValue(i, 3) * this.config.ai.formationDepthVariation,
        responseRate: isGoalie
          ? 0
          : this.profileRange(
              i,
              4,
              this.config.ai.formationTargetResponseMin,
              this.config.ai.formationTargetResponseMax,
            ),
        ballResponseMultiplier: isGoalie
          ? 1
          : 1 +
            this.profileValue(i, 5) *
              this.config.ai.formationBallResponseVariation,
        smoothedTarget: null,
        wanderStep: 0,
        wanderElapsed: 0,
        wanderDuration: 0,
        wanderFrom: new Vector2d(0, 0),
        wanderTo: new Vector2d(0, 0),
      });
      if (!isGoalie) {
        paceValues.push(paceValue);
        paceTotal += paceValue;
      }
    }

    const paceMean = paceValues.length == 0 ? 0 : paceTotal / paceValues.length;
    let maxDeviation = 0;
    for (let j = 0; j < profiles.length; j++) {
      if (profiles[j].role == "goalie") continue;
      const deviation = profiles[j].paceValue - paceMean;
      maxDeviation = Math.max(maxDeviation, Math.abs(deviation));
    }

    for (let k = 0; k < profiles.length; k++) {
      if (profiles[k].role == "goalie" || maxDeviation == 0) continue;
      profiles[k].paceMultiplier =
        1 +
        ((profiles[k].paceValue - paceMean) / maxDeviation) *
          this.config.ai.formationPaceVariation;
    }

    return profiles;
  }

  private profileValue(playerIndex: number, salt: number): number {
    const sideSeed = this.team.side == "away" ? 0x9e3779b9 : 0x85ebca6b;
    let value =
      sideSeed ^
      Math.imul(playerIndex + 1, 0x27d4eb2d) ^
      Math.imul(salt + 1, 0x165667b1);
    value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
    value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
    value = (value ^ (value >>> 15)) >>> 0;
    return value / 2147483647.5 - 1;
  }

  private profileRange(
    playerIndex: number,
    salt: number,
    min: number,
    max: number,
  ): number {
    const unit = (this.profileValue(playerIndex, salt) + 1) / 2;
    return min + (max - min) * unit;
  }

  private exactTargets(targets: Vector2[]): Vector2[] {
    for (let i = 0; i < this.movementProfiles.length; i++) {
      this.movementProfiles[i].smoothedTarget = null;
    }
    return targets;
  }

  private openPlayTargets(
    baseTargets: Vector2[],
    deltaSeconds: number,
  ): Vector2[] {
    let desiredTargets: Vector2[] = [];
    const attackDir = this.team.side == "home" ? -1 : 1;

    for (let i = 0; i < baseTargets.length; i++) {
      const profile = this.movementProfiles[i];
      if (profile.role == "goalie") {
        desiredTargets.push(baseTargets[i]);
        continue;
      }

      const ballShift = this.ballShiftForRole(profile.role);
      const wander = this.updateWander(profile, i, deltaSeconds);
      desiredTargets.push(
        this.formation.clampToField(
          new Vector2d(
            baseTargets[i].x +
              profile.lateralBias +
              wander.x +
              ballShift.x * profile.ballResponseMultiplier,
            baseTargets[i].y +
              (profile.depthBias + wander.y) * attackDir +
              ballShift.y * profile.ballResponseMultiplier,
          ),
        ),
      );
    }

    desiredTargets = this.separateFormationTargets(desiredTargets);
    const dt = deltaSeconds > 0 ? Math.min(deltaSeconds, 0.1) : 1 / 60;
    const result: Vector2[] = [];
    for (let j = 0; j < desiredTargets.length; j++) {
      const movementProfile = this.movementProfiles[j];
      if (movementProfile.role == "goalie") {
        movementProfile.smoothedTarget = null;
        result.push(baseTargets[j]);
        continue;
      }

      if (movementProfile.smoothedTarget == null) {
        movementProfile.smoothedTarget = new Vector2d(
          this.team.players[j].position.x,
          this.team.players[j].position.y,
        );
      }
      const alpha = 1 - Math.exp(-movementProfile.responseRate * dt);
      movementProfile.smoothedTarget = this.formation.clampToField(
        new Vector2d(
          movementProfile.smoothedTarget.x +
            (desiredTargets[j].x - movementProfile.smoothedTarget.x) * alpha,
          movementProfile.smoothedTarget.y +
            (desiredTargets[j].y - movementProfile.smoothedTarget.y) * alpha,
        ),
      );
      result.push(movementProfile.smoothedTarget);
    }
    return result;
  }

  private updateWander(
    profile: MovementProfile,
    playerIndex: number,
    deltaSeconds: number,
  ): Vector2 {
    const dt = deltaSeconds > 0 ? Math.min(deltaSeconds, 0.1) : 1 / 60;
    if (profile.wanderDuration <= 0) {
      profile.wanderFrom = this.wanderOffset(playerIndex, 0);
      profile.wanderTo = this.wanderOffset(playerIndex, 1);
      profile.wanderDuration = this.wanderDuration(playerIndex, 0);
      profile.wanderElapsed =
        this.profileRange(playerIndex, 20, 0, 0.65) * profile.wanderDuration;
    }

    profile.wanderElapsed += dt;
    while (profile.wanderElapsed >= profile.wanderDuration) {
      profile.wanderElapsed -= profile.wanderDuration;
      profile.wanderStep++;
      profile.wanderFrom = profile.wanderTo;
      profile.wanderTo = this.wanderOffset(playerIndex, profile.wanderStep + 1);
      profile.wanderDuration = this.wanderDuration(
        playerIndex,
        profile.wanderStep,
      );
    }

    const progress = profile.wanderElapsed / profile.wanderDuration;
    const smoothProgress = progress * progress * (3 - 2 * progress);
    return new Vector2d(
      profile.wanderFrom.x +
        (profile.wanderTo.x - profile.wanderFrom.x) * smoothProgress,
      profile.wanderFrom.y +
        (profile.wanderTo.y - profile.wanderFrom.y) * smoothProgress,
    );
  }

  private wanderOffset(playerIndex: number, step: number): Vector2 {
    return new Vector2d(
      this.profileValue(playerIndex, 30 + step * 2) *
        this.config.ai.formationWanderLateral,
      this.profileValue(playerIndex, 31 + step * 2) *
        this.config.ai.formationWanderDepth,
    );
  }

  private wanderDuration(playerIndex: number, step: number): number {
    return this.profileRange(
      playerIndex,
      100 + step,
      this.config.ai.formationWanderIntervalMin,
      this.config.ai.formationWanderIntervalMax,
    );
  }

  private ballShiftForRole(role: FormationRole): Vector2 {
    const influence =
      role == "defender"
        ? this.config.ai.formationDefenderBallInfluence
        : role == "midfielder"
          ? this.config.ai.formationMidfielderBallInfluence
          : this.config.ai.formationStrikerBallInfluence;
    const maxShift =
      role == "defender"
        ? this.config.ai.formationDefenderMaxShift
        : role == "midfielder"
          ? this.config.ai.formationMidfielderMaxShift
          : this.config.ai.formationStrikerMaxShift;
    const center = this.config.pitch.initialBallPosition;
    if (influence <= 0 || maxShift <= 0) {
      return new Vector2d(0, 0);
    }
    return new Vector2d(
      this.clamp(
        this.ball.position.x - center.x,
        -maxShift / influence,
        maxShift / influence,
      ) * influence,
      this.clamp(
        this.ball.position.y - center.y,
        -maxShift / influence,
        maxShift / influence,
      ) * influence,
    );
  }

  private separateFormationTargets(targets: Vector2[]): Vector2[] {
    const spacing = this.config.ai.minTeammateSpacing || 0;
    const maxShift = this.config.ai.formationSeparationMaxShift || 0;
    if (spacing <= 0 || maxShift <= 0) return targets;

    const result: Vector2[] = [];
    for (let i = 0; i < targets.length; i++) {
      if (this.movementProfiles[i].role == "goalie") {
        result.push(targets[i]);
        continue;
      }

      let shiftX = 0;
      let shiftY = 0;
      const player = this.team.players[i];
      for (let j = 0; j < this.team.players.length; j++) {
        if (i == j) continue;
        const other = this.team.players[j];
        let dx = player.position.x - other.position.x;
        let dy = player.position.y - other.position.y;
        let distance = MathLib.vectorLength(dx, dy);
        if (distance >= spacing) continue;
        if (distance < 0.0001) {
          dx = i < j ? -1 : 1;
          dy = 0;
          distance = 1;
        }
        const strength = ((spacing - distance) / spacing) * maxShift;
        shiftX += (dx / distance) * strength;
        shiftY += (dy / distance) * strength;
      }

      const shiftLength = MathLib.vectorLength(shiftX, shiftY);
      if (shiftLength > maxShift) {
        shiftX = (shiftX / shiftLength) * maxShift;
        shiftY = (shiftY / shiftLength) * maxShift;
      }
      result.push(
        this.formation.clampToField(
          new Vector2d(targets[i].x + shiftX, targets[i].y + shiftY),
        ),
      );
    }
    return result;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private shouldChaseCorner(playerIndex: number): boolean {
    const groups = this.formation.cornerAssignments(
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

  public setRestartState(state: TeamAiState): boolean {
    if (typeof state != "string" || state.length == 0) {
      return false;
    }
    this.state = state;
    this.ballAttacker = null;
    return true;
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

  private closestPlayerToBall(): Player | null {
    let closest: Player | null = null;
    let closestDistance = Infinity;
    for (let i = 0; i < this.team.players.length; i++) {
      const player = this.team.players[i];
      const distance = MathLib.computeDistance(
        player.position,
        this.ball.position,
      );
      if (distance < closestDistance) {
        closest = player;
        closestDistance = distance;
      }
    }
    return closest;
  }

  private selectedBallAttacker(): Player | null {
    const closest = this.closestPlayerToBall();
    if (closest == null) return this.ballAttacker;
    if (this.ballAttacker != null && closest !== this.ballAttacker) {
      const currentDistance = MathLib.computeDistance(
        this.ballAttacker.position,
        this.ball.position,
      );
      const closestDistance = MathLib.computeDistance(
        closest.position,
        this.ball.position,
      );
      const hysteresis = this.config.ai.attackerSwitchHysteresisDistance || 0;
      if (currentDistance <= closestDistance + hysteresis) {
        return this.ballAttacker;
      }
    }
    this.ballAttacker = closest;
    return closest;
  }

  public debugSnapshot(): TeamAiDebugSnapshot[] {
    const result: TeamAiDebugSnapshot[] = [];
    for (let i = 0; i < this.individualAis.length; i++) {
      const snapshot = this.individualAis[i].debugSnapshot();
      result.push({ ...snapshot, teamState: this.state });
    }
    return result;
  }
}
