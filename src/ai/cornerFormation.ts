import type { Configuration } from "../core/configuration";
import { Vector2 } from "../math/vector";
import type { TeamSide } from "../types";
import { Formation, type FormationRole } from "./formation";

export type CornerAssignment =
  "goalie" | "cover" | "taker" | "short" | "late" | "edge" | "box";

export interface CornerAttackingPlan {
  positions: Vector2[];
  groups: CornerAssignment[];
}

export class CornerFormation {
  private readonly config: Configuration;
  private readonly formation: Formation;

  public constructor(config: Configuration) {
    this.config = config;
    this.formation = new Formation(config);
  }

  public attackingPlan(
    side: TeamSide,
    teamSize: number,
    takerIndex: number,
    cornerLeft: boolean,
  ): CornerAttackingPlan {
    const positions = this.formation.positions("attack", side, teamSize);
    const groups = this.assignments(teamSize, takerIndex);
    const indexes: Partial<Record<CornerAssignment, number>> = {};
    const counts: Partial<Record<CornerAssignment, number>> = {};
    for (const group of groups) counts[group] = (counts[group] ?? 0) + 1;
    const goalX =
      (this.config.pitch.goalTopTopLeft.x +
        this.config.pitch.goalTopTopRight.x) /
      2;
    const goalY =
      side == "home"
        ? this.config.pitch.fieldTop
        : this.config.pitch.fieldBottom;
    const attackDir = side == "home" ? 1 : -1;
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const index = indexes[group] ?? 0;
      indexes[group] = index + 1;
      let x: number;
      let depth: number;
      if (group == "box") {
        x =
          goalX +
          this.lane(index, counts[group] ?? 0) *
            this.config.restarts.cornerBoxSpacing;
        depth =
          this.config.restarts.cornerBoxDepth +
          index * this.config.restarts.cornerBoxDepthStep;
      } else if (group == "late") {
        x =
          goalX +
          this.lane(index, counts[group] ?? 0) *
            this.config.restarts.cornerBoxSpacing *
            2;
        depth = this.config.restarts.cornerLateDepth;
      } else if (group == "edge") {
        x = goalX;
        depth = this.config.restarts.cornerEdgeDepth;
      } else if (group == "short") {
        x = cornerLeft
          ? this.config.pitch.fieldLeft + this.config.restarts.cornerShortInset
          : this.config.pitch.fieldRight -
            this.config.restarts.cornerShortInset;
        depth = this.config.restarts.cornerShortDepth;
      } else {
        continue;
      }
      positions[i] = this.formation.clampToField(
        new Vector2(x, goalY + attackDir * depth),
      );
    }
    return { positions, groups };
  }

  public coverIndexes(teamSize: number): number[] {
    const roles = this.formation.rolesForSize(teamSize);
    const outfieldCount = roles.filter((role) => role != "goalie").length;
    const coverLimit = Math.min(2, Math.max(0, outfieldCount - 2));
    const defenders = roles
      .map((role, index) => ({ role, index }))
      .filter(({ role }) => role == "defender")
      .map(({ index }) => index);
    const result: number[] = [];
    if (coverLimit >= 1 && defenders.length > 0) result.push(defenders[0]);
    if (coverLimit >= 2 && defenders.length > 1)
      result.push(defenders[defenders.length - 1]);
    return result;
  }

  public assignments(teamSize: number, takerIndex: number): CornerAssignment[] {
    const roles = this.formation.rolesForSize(teamSize);
    const covers = this.coverIndexes(teamSize);
    const groups: CornerAssignment[] = [];
    const candidates: number[] = [];
    for (let i = 0; i < roles.length; i++) {
      if (roles[i] == "goalie") groups[i] = "goalie";
      else if (covers.includes(i)) groups[i] = "cover";
      else if (i == takerIndex) groups[i] = "taker";
      else candidates.push(i);
    }
    const advancedCount = candidates.length;
    if (advancedCount >= 2)
      groups[
        this.takeCandidate(
          candidates,
          roles,
          ["midfielder", "striker", "defender"],
          false,
        )
      ] = "short";
    if (advancedCount >= 4)
      groups[
        this.takeCandidate(
          candidates,
          roles,
          ["midfielder", "defender", "striker"],
          false,
        )
      ] = "late";
    if (advancedCount >= 6)
      groups[
        this.takeCandidate(
          candidates,
          roles,
          ["midfielder", "defender", "striker"],
          true,
        )
      ] = "edge";
    for (const candidate of candidates) groups[candidate] = "box";
    return groups;
  }

  private takeCandidate(
    candidates: number[],
    roles: FormationRole[],
    preferences: FormationRole[],
    fromEnd: boolean,
  ): number {
    for (const preference of preferences) {
      const indexes = fromEnd
        ? [...candidates.keys()].reverse()
        : [...candidates.keys()];
      for (const index of indexes) {
        if (roles[candidates[index]] == preference)
          return candidates.splice(index, 1)[0];
      }
    }
    const candidate = candidates.shift();
    if (candidate == null) throw new Error("No corner candidate available");
    return candidate;
  }

  private lane(index: number, count: number): number {
    return count <= 1 ? 0 : index - (count - 1) / 2;
  }
}
