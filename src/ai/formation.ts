import { Vector2 as Vector2d } from "../math/vector";
import type { Vector2 } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { TeamAiState, TeamSide } from "../types";
export { Formation };

export type FormationRole = "goalie" | "defender" | "midfielder" | "striker";
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
    const roles = this.rolesForSize(teamSize);
    const roleIndexes: Partial<Record<FormationRole, number>> = {};
    const result: Vector2[] = [];

    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const roleIndex = roleIndexes[role] ?? 0;
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
    return sizes[teamSize] ?? sizes[Math.max(1, Math.min(11, teamSize))];
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
            ? this.config.restarts.kickoffTakerDistance
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
    const radiusX = this.config.pitch.centerCircleRadiusX;
    const radiusY = this.config.pitch.centerCircleRadiusY;
    const xOffset = this.lane(index, count) * 90;
    const normalizedX = Math.min(1, Math.abs(xOffset) / radiusX);
    const boundaryY =
      radiusY * Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX));
    return -(
      boundaryY +
      this.config.player.radius +
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
