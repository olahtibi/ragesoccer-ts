import type { Configuration } from "../core/configuration";
import { math } from "../math/math";
import { Vector2 } from "../math/vector";
import type { Ball } from "../world/ball";
import type { Team } from "../world/team";
import { Formation, type FormationRole } from "./formation";

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

export interface FormationMotionDebugSnapshot {
  role: FormationRole;
  paceMultiplier: number;
  lateralBias: number;
  depthBias: number;
  smoothedTarget: Vector2 | null;
  wanderStep: number;
}

export class FormationMotionPlanner {
  private readonly config: Configuration;
  private readonly team: Team;
  private readonly ball: Ball;
  private readonly formation: Formation;
  private readonly profiles: MovementProfile[];

  public constructor(config: Configuration, team: Team, ball: Ball) {
    this.config = config;
    this.team = team;
    this.ball = ball;
    this.formation = new Formation(config);
    this.profiles = this.createProfiles();
  }

  public paceMultiplier(playerIndex: number): number {
    return this.profiles[playerIndex].paceMultiplier;
  }

  public targets(
    baseTargets: Vector2[],
    deltaSeconds: number,
    openPlay: boolean,
  ): Vector2[] {
    if (!openPlay) {
      for (const profile of this.profiles) profile.smoothedTarget = null;
      return baseTargets;
    }

    let desiredTargets: Vector2[] = [];
    const attackDir = this.team.side == "home" ? -1 : 1;
    for (let i = 0; i < baseTargets.length; i++) {
      const profile = this.profiles[i];
      if (profile.role == "goalie") {
        desiredTargets.push(baseTargets[i]);
        continue;
      }
      const ballShift = this.ballShiftForRole(profile.role);
      const wander = this.updateWander(profile, i, deltaSeconds);
      desiredTargets.push(
        this.formation.clampToField(
          new Vector2(
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
    desiredTargets = this.separateTargets(desiredTargets);

    const dt = deltaSeconds > 0 ? Math.min(deltaSeconds, 0.1) : 1 / 60;
    return desiredTargets.map((target, index) => {
      const profile = this.profiles[index];
      if (profile.role == "goalie") {
        profile.smoothedTarget = null;
        return baseTargets[index];
      }
      profile.smoothedTarget ??= new Vector2(
        this.team.players[index].position.x,
        this.team.players[index].position.y,
      );
      const alpha = 1 - Math.exp(-profile.responseRate * dt);
      profile.smoothedTarget = this.formation.clampToField(
        new Vector2(
          profile.smoothedTarget.x +
            (target.x - profile.smoothedTarget.x) * alpha,
          profile.smoothedTarget.y +
            (target.y - profile.smoothedTarget.y) * alpha,
        ),
      );
      return profile.smoothedTarget;
    });
  }

  public debugSnapshot(): FormationMotionDebugSnapshot[] {
    return this.profiles.map((profile) => ({
      role: profile.role,
      paceMultiplier: profile.paceMultiplier,
      lateralBias: profile.lateralBias,
      depthBias: profile.depthBias,
      smoothedTarget: profile.smoothedTarget,
      wanderStep: profile.wanderStep,
    }));
  }

  private createProfiles(): MovementProfile[] {
    const roles = this.formation.rolesForSize(this.team.players.length);
    const profiles: MovementProfile[] = [];
    const paceValues: number[] = [];
    let paceTotal = 0;
    for (let i = 0; i < roles.length; i++) {
      const goalie = roles[i] == "goalie";
      const paceValue = goalie ? 0 : this.profileValue(i, 1);
      profiles.push({
        role: roles[i],
        paceValue,
        paceMultiplier: 1,
        lateralBias: goalie
          ? 0
          : this.profileValue(i, 2) * this.config.ai.formationLateralVariation,
        depthBias: goalie
          ? 0
          : this.profileValue(i, 3) * this.config.ai.formationDepthVariation,
        responseRate: goalie
          ? 0
          : this.profileRange(
              i,
              4,
              this.config.ai.formationTargetResponseMin,
              this.config.ai.formationTargetResponseMax,
            ),
        ballResponseMultiplier: goalie
          ? 1
          : 1 +
            this.profileValue(i, 5) *
              this.config.ai.formationBallResponseVariation,
        smoothedTarget: null,
        wanderStep: 0,
        wanderElapsed: 0,
        wanderDuration: 0,
        wanderFrom: new Vector2(0, 0),
        wanderTo: new Vector2(0, 0),
      });
      if (!goalie) {
        paceValues.push(paceValue);
        paceTotal += paceValue;
      }
    }
    const mean = paceValues.length == 0 ? 0 : paceTotal / paceValues.length;
    let maxDeviation = 0;
    for (const profile of profiles) {
      if (profile.role != "goalie") {
        maxDeviation = Math.max(
          maxDeviation,
          Math.abs(profile.paceValue - mean),
        );
      }
    }
    for (const profile of profiles) {
      if (profile.role == "goalie" || maxDeviation == 0) continue;
      profile.paceMultiplier =
        1 +
        ((profile.paceValue - mean) / maxDeviation) *
          this.config.ai.formationPaceVariation;
    }
    return profiles;
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
    const smooth = progress * progress * (3 - 2 * progress);
    return new Vector2(
      profile.wanderFrom.x +
        (profile.wanderTo.x - profile.wanderFrom.x) * smooth,
      profile.wanderFrom.y +
        (profile.wanderTo.y - profile.wanderFrom.y) * smooth,
    );
  }

  private wanderOffset(playerIndex: number, step: number): Vector2 {
    return new Vector2(
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
    if (influence <= 0 || maxShift <= 0) return new Vector2(0, 0);
    const center = this.config.pitch.initialBallPosition;
    return new Vector2(
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

  private separateTargets(targets: Vector2[]): Vector2[] {
    const spacing = this.config.ai.minTeammateSpacing;
    const maxShift = this.config.ai.formationSeparationMaxShift;
    if (spacing <= 0 || maxShift <= 0) return targets;
    return targets.map((target, i) => {
      if (this.profiles[i].role == "goalie") return target;
      let shiftX = 0;
      let shiftY = 0;
      const player = this.team.players[i];
      for (let j = 0; j < this.team.players.length; j++) {
        if (i == j) continue;
        const other = this.team.players[j];
        let dx = player.position.x - other.position.x;
        let dy = player.position.y - other.position.y;
        let distance = math.vectorLength(dx, dy);
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
      const length = math.vectorLength(shiftX, shiftY);
      if (length > maxShift) {
        shiftX = (shiftX / length) * maxShift;
        shiftY = (shiftY / length) * maxShift;
      }
      return this.formation.clampToField(
        new Vector2(target.x + shiftX, target.y + shiftY),
      );
    });
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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
