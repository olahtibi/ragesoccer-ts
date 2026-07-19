import { Formation } from "../../ai/formation";
import { Vector2 as Vector2d } from "../../math/vector";
import type { Vector2 } from "../../math/vector";
import { TEAM_SIDES } from "../../types";
import type {
  GameContext,
  RestartRequest,
  RestartScene,
  TeamSide,
} from "../../types";
import type { Configuration } from "../configuration";
import { RestartPositioning } from "./restartPositioning";
import { assertRestartType, BaseRestartStrategy } from "./baseRestartStrategy";
export { KickoffRestart };

class KickoffRestart extends BaseRestartStrategy {
  public readonly formation: Formation;
  public readonly opponentAutoResumeAfterPositioning: boolean;

  public constructor(config: Configuration) {
    super(config);
    this.formation = new Formation(config);
    this.opponentAutoResumeAfterPositioning = true;
  }

  public createScene(
    context: GameContext,
    request: RestartRequest,
  ): RestartScene {
    assertRestartType(request, "kickoff");
    const placements: RestartScene["placements"] = { home: [], away: [] };
    let readyPlayer: RestartScene["readyPlayer"] = null;
    for (let i = 0; i < TEAM_SIDES.length; i++) {
      const team = context.teams[TEAM_SIDES[i]];
      const state = this.teamAiState(team.side, request);
      let takerIndex = -1;
      if (team.side == request.awardedTo) {
        takerIndex = this.formation.kickoffTakerIndex(team.players.length);
        readyPlayer = team.players[takerIndex];
      }
      let positions = RestartPositioning.randomizePositions(
        this.config,
        this.formation,
        this.formation.positions(state, team.side, team.players.length),
        request,
        team.side,
        takerIndex,
      );
      positions = this.applyPositioningRules(positions, team.side, takerIndex);
      placements[team.side] = team.players.map((player, index) => ({
        player,
        target: positions[index],
      }));
    }
    return {
      ballPosition: this.config.pitch.initialBallPosition,
      placements: placements,
      readyPlayer: readyPlayer,
    };
  }

  public resume(
    context: GameContext,
    request: RestartRequest,
    direction: Vector2 | null,
  ): boolean {
    assertRestartType(request, "kickoff");
    void direction;
    context.ball.scaleNextKickImpulse(
      this.config.restarts.kickoffImpulseMultiplier,
    );
    return true;
  }

  public override attackTarget(
    side: TeamSide,
    request: RestartRequest,
  ): Vector2 | null {
    assertRestartType(request, "kickoff");
    if (side != "away" || side != request.awardedTo) return null;
    return new Vector2d(
      this.config.pitch.initialBallPosition.x,
      this.config.pitch.aiCenterY - this.config.ai.formationFallbackDepth,
    );
  }

  private applyPositioningRules(
    positions: Vector2[],
    side: TeamSide,
    takerIndex: number,
  ): Vector2[] {
    const result: Vector2[] = [];
    const centerX = this.config.pitch.initialBallPosition.x;
    const centerY = this.config.pitch.aiCenterY;
    const radiusX =
      this.config.pitch.centerCircleRadiusX + this.config.player.radius + 1;
    const radiusY =
      this.config.pitch.centerCircleRadiusY + this.config.player.radius + 1;

    for (let i = 0; i < positions.length; i++) {
      if (i == takerIndex) {
        result.push(positions[i]);
        continue;
      }
      let target = positions[i];
      const y =
        side == "home"
          ? Math.max(target.y, centerY + this.config.player.radius)
          : Math.min(target.y, centerY - this.config.player.radius);
      const dx = target.x - centerX;
      const dy = y - centerY;
      const ellipseDistance =
        (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
      if (ellipseDistance < 1) {
        const scale = 1 / Math.sqrt(ellipseDistance || 0.0001);
        target = new Vector2d(centerX + dx * scale, centerY + dy * scale);
      } else {
        target = new Vector2d(target.x, y);
      }
      result.push(RestartPositioning.clampToPlayingField(this.config, target));
    }
    return result;
  }

  public override enforceRules(
    context: GameContext,
    request: RestartRequest,
  ): void {
    if (request.awardedTo != "home") return;
    const player = context.humanController.player();
    if (player == null) return;

    const centerX = this.config.pitch.initialBallPosition.x;
    const centerY = this.config.pitch.aiCenterY;
    const radiusX = this.config.pitch.centerCircleRadiusX;
    const radiusY = this.config.pitch.centerCircleRadiusY;
    const dx = player.position.x - centerX;
    const dy = player.position.y - centerY;
    const distance =
      (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
    if (distance <= 1) return;

    const scale = 1 / Math.sqrt(distance);
    player.position.x = centerX + dx * scale;
    player.position.y = centerY + dy * scale;
    const outward =
      (player.velocity.x * dx) / (radiusX * radiusX) +
      (player.velocity.y * dy) / (radiusY * radiusY);
    if (outward > 0) {
      player.stop();
    }
  }
}
