import { Vector2 as Vector2d } from "../math/vector";
import type { Vector2 } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { TeamAiState, TeamSide } from "../types";
export { Formation };

export type FormationRole = "goalie" | "defender" | "midfielder" | "striker";
export type CornerAssignment =
  "goalie" | "cover" | "taker" | "short" | "late" | "edge" | "box";

export interface CornerAttackingPlan {
  positions: Vector2[];
  groups: CornerAssignment[];
}

class Formation {
  public readonly config: Configuration;

  public constructor(config: Configuration) {
    this.config = config;
  }

  public positions(
    state: TeamAiState,
    side: TeamSide,
    teamSize: number,
  ): Vector2[] {
    if (state == "cornerUs") {
      return this.cornerAttackingPositions(side, teamSize);
    }

    const roles = this.rolesForSize(teamSize);
    const roleIndexes: Partial<Record<FormationRole, number>> = {};
    const result: Vector2[] = [];

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const roleIndex = roleIndexes[role] || 0;
      roleIndexes[role] = roleIndex + 1;
      result.push(
        this.positionForRole(
          state,
          side,
          role,
          roleIndex,
          this.roleCount(roles, role),
        ),
      );
    }

    return result;
  }

  private cornerAttackingPositions(
    side: TeamSide,
    teamSize: number,
  ): Vector2[] {
    return this.cornerAttackingPlan(side, teamSize, -1, true).positions;
  }

  public cornerAttackingPlan(
    side: TeamSide,
    teamSize: number,
    takerIndex: number,
    cornerLeft: boolean,
  ): CornerAttackingPlan {
    const result = this.positions("attack", side, teamSize);
    const groups = this.cornerAssignments(teamSize, takerIndex);
    const groupIndexes: Partial<Record<CornerAssignment, number>> = {};
    const groupCounts: Partial<Record<CornerAssignment, number>> = {};

    for (let i = 0; i < groups.length; i++) {
      groupCounts[groups[i]] = (groupCounts[groups[i]] ?? 0) + 1;
    }

    const goalX =
      (this.config.pitch.goalTopTopLeft.x +
        this.config.pitch.goalTopTopRight.x) /
      2;
    const goalY =
      side == "home"
        ? this.config.pitch.fieldTop
        : this.config.pitch.fieldBottom;
    const attackDir = side == "home" ? 1 : -1;
    for (let j = 0; j < groups.length; j++) {
      const group = groups[j];
      const groupIndex = groupIndexes[group] ?? 0;
      groupIndexes[group] = groupIndex + 1;
      let x: number;
      let depth: number;
      if (group == "box") {
        x =
          goalX +
          this.lane(groupIndex, groupCounts[group] ?? 0) *
            this.config.restarts.cornerBoxSpacing;
        depth =
          this.config.restarts.cornerBoxDepth +
          groupIndex * this.config.restarts.cornerBoxDepthStep;
      } else if (group == "late") {
        x =
          goalX +
          this.lane(groupIndex, groupCounts[group] ?? 0) *
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
      result[j] = this.clampToField(new Vector2d(x, goalY + attackDir * depth));
    }

    return { positions: result, groups: groups };
  }

  private cornerCoverIndex(teamSize: number): number {
    const indexes = this.cornerCoverIndexes(teamSize);
    return indexes.length == 0 ? -1 : indexes[0];
  }

  public cornerCoverIndexes(teamSize: number): number[] {
    const roles = this.rolesForSize(teamSize);
    let outfieldCount = 0;
    for (var i = 0; i < roles.length; i++) {
      if (roles[i] != "goalie") outfieldCount++;
    }
    const coverLimit = Math.min(2, Math.max(0, outfieldCount - 2));
    const defenders: number[] = [];
    for (var i = 0; i < roles.length; i++) {
      if (roles[i] == "defender") defenders.push(i);
    }
    const result: number[] = [];
    if (coverLimit >= 1 && defenders.length > 0) result.push(defenders[0]);
    if (coverLimit >= 2 && defenders.length > 1)
      result.push(defenders[defenders.length - 1]);
    return result;
  }

  public cornerAssignments(
    teamSize: number,
    takerIndex: number,
  ): CornerAssignment[] {
    const roles = this.rolesForSize(teamSize);
    const covers = this.cornerCoverIndexes(teamSize);
    const groups: CornerAssignment[] = [];
    const candidates: number[] = [];
    for (let i = 0; i < roles.length; i++) {
      if (roles[i] == "goalie") {
        groups[i] = "goalie";
      } else if (covers.indexOf(i) >= 0) {
        groups[i] = "cover";
      } else if (i == takerIndex) {
        groups[i] = "taker";
      } else {
        candidates.push(i);
      }
    }

    const advancedCount = candidates.length;
    if (advancedCount >= 2) {
      const shortIndex = this.takeCornerCandidate(
        candidates,
        roles,
        ["midfielder", "striker", "defender"],
        false,
      );
      groups[shortIndex] = "short";
    }
    if (advancedCount >= 4) {
      const lateIndex = this.takeCornerCandidate(
        candidates,
        roles,
        ["midfielder", "defender", "striker"],
        false,
      );
      groups[lateIndex] = "late";
    }
    if (advancedCount >= 6) {
      const edgeIndex = this.takeCornerCandidate(
        candidates,
        roles,
        ["midfielder", "defender", "striker"],
        true,
      );
      groups[edgeIndex] = "edge";
    }
    for (let j = 0; j < candidates.length; j++) {
      groups[candidates[j]] = "box";
    }
    return groups;
  }

  private takeCornerCandidate(
    candidates: number[],
    roles: FormationRole[],
    preferences: FormationRole[],
    fromEnd: boolean,
  ): number {
    for (let p = 0; p < preferences.length; p++) {
      if (fromEnd) {
        for (let i = candidates.length - 1; i >= 0; i--) {
          if (roles[candidates[i]] == preferences[p])
            return candidates.splice(i, 1)[0];
        }
      } else {
        for (let j = 0; j < candidates.length; j++) {
          if (roles[candidates[j]] == preferences[p])
            return candidates.splice(j, 1)[0];
        }
      }
    }
    const candidate = candidates.shift();
    if (candidate == null) throw new Error("No corner candidate available");
    return candidate;
  }

  public kickoffTakerIndex(teamSize: number): number {
    const roles = this.rolesForSize(teamSize);
    for (let i = 0; i < roles.length; i++) {
      if (roles[i] == "striker") return i;
    }
    return -1;
  }

  public rolesForSize(teamSize: number): FormationRole[] {
    const sizes: Record<number, FormationRole[]> = {
      1: ["striker"],
      2: ["goalie", "striker"],
      3: ["goalie", "defender", "striker"],
      4: ["goalie", "defender", "defender", "striker"],
      5: ["goalie", "defender", "defender", "striker", "striker"],
      6: ["goalie", "defender", "defender", "midfielder", "striker", "striker"],
      7: [
        "goalie",
        "defender",
        "defender",
        "midfielder",
        "midfielder",
        "striker",
        "striker",
      ],
      8: [
        "goalie",
        "defender",
        "defender",
        "defender",
        "midfielder",
        "midfielder",
        "striker",
        "striker",
      ],
      9: [
        "goalie",
        "defender",
        "defender",
        "defender",
        "midfielder",
        "midfielder",
        "midfielder",
        "striker",
        "striker",
      ],
      10: [
        "goalie",
        "defender",
        "defender",
        "defender",
        "defender",
        "midfielder",
        "midfielder",
        "midfielder",
        "striker",
        "striker",
      ],
      11: [
        "goalie",
        "defender",
        "defender",
        "defender",
        "defender",
        "midfielder",
        "midfielder",
        "midfielder",
        "midfielder",
        "striker",
        "striker",
      ],
    };
    return sizes[teamSize] || sizes[Math.max(1, Math.min(11, teamSize))];
  }

  private roleCount(roles: FormationRole[], role: FormationRole): number {
    let count = 0;
    for (let i = 0; i < roles.length; i++) {
      if (roles[i] == role) {
        count++;
      }
    }
    return count;
  }

  private positionForRole(
    state: TeamAiState,
    side: TeamSide,
    role: FormationRole,
    index: number,
    count: number,
  ): Vector2 {
    if (role == "goalie") {
      return this.goaliePosition(side);
    }

    const centerX = this.config.pitch.initialBallPosition.x;
    const centerY = this.config.pitch.aiCenterY;
    const attackDir = side == "home" ? -1 : 1;
    let progress =
      role == "defender"
        ? this.config.ai.formationDefenderProgress
        : role == "midfielder"
          ? this.config.ai.formationMidfielderProgress
          : this.config.ai.formationStrikerProgress;
    const kickingSide = this.kickoffSideForState(state, side);
    const kickoffTaker =
      kickingSide != null &&
      side == kickingSide &&
      role == "striker" &&
      index == 0;

    if (state == "attack") {
      progress += this.config.ai.formationStateShift;
    } else if (state == "defense") {
      progress -=
        role == "defender"
          ? this.config.ai.formationDefenderDefenseShift
          : this.config.ai.formationStateShift;
    } else if (kickingSide != null && role == "striker") {
      progress =
        side == kickingSide
          ? kickoffTaker
            ? -this.config.restarts.kickoffTakerDistance
            : -this.config.ai.formationFallbackDepth
          : this.nonKickingStrikerProgress(index, count);
    } else if (kickingSide != null && role == "midfielder") {
      progress = this.config.ai.kickoffMidfielderProgress;
    }

    const x = kickoffTaker ? centerX : centerX + this.lane(index, count) * 90;
    const y = centerY + attackDir * progress;
    return this.clampToField(new Vector2d(x, y));
  }

  private kickoffSideForState(
    state: TeamAiState,
    side: TeamSide,
  ): TeamSide | null {
    if (state == "kickoffUs") {
      return side;
    }
    if (state == "kickoffOpponent") {
      return side == "home" ? "away" : "home";
    }
    return null;
  }

  private nonKickingStrikerProgress(index: number, count: number): number {
    const radiusX = this.config.pitch.centerCircleRadiusX || 1;
    const radiusY = this.config.pitch.centerCircleRadiusY || 0;
    const xOffset = this.lane(index, count) * 90;
    const normalizedX = Math.min(1, Math.abs(xOffset) / radiusX);
    const boundaryY =
      radiusY * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX));
    return -(
      boundaryY +
      (this.config.player.radius || 0) +
      this.config.ai.fieldClampClearance
    );
  }

  private goaliePosition(side: TeamSide): Vector2 {
    const x = this.config.pitch.initialBallPosition.x;
    let y: number;
    if (side == "home") {
      y = this.config.pitch.goalBottomTopLeft.y - this.config.ai.goalieDistance;
    } else {
      y = this.config.pitch.goalTopBottomLeft.y + this.config.ai.goalieDistance;
    }
    return this.clampToField(new Vector2d(x, y));
  }

  private lane(index: number, count: number): number {
    if (count <= 1) {
      return 0;
    }
    return index - (count - 1) / 2;
  }

  public clampToField(position: Vector2): Vector2 {
    let x = position.x;
    let y = position.y;
    if (x < this.config.pitch.boxTopLeft.x) x = this.config.pitch.boxTopLeft.x;
    if (x > this.config.pitch.boxTopRight.x)
      x = this.config.pitch.boxTopRight.x;
    if (y < this.config.pitch.boxTopLeft.y) y = this.config.pitch.boxTopLeft.y;
    if (y > this.config.pitch.boxBottomLeft.y)
      y = this.config.pitch.boxBottomLeft.y;
    return new Vector2d(x, y);
  }
}
