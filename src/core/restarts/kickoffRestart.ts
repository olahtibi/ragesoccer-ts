import { Formation } from "../../ai/formation";
import { Vector2 as Vector2d } from "../../math/vector";
import { RestartPositioning } from "./restartPositioning";
export { KickoffRestart };

class KickoffRestart {
  [key: string]: any;
  public constructor(config) {
    this.config = config;
    this.formation = new Formation(config);
    this.opponentAutoResumeAfterPositioning = true;
  }

  public createScene(context, request) {
    const sceneTeams = [];
    let readyPlayer = null;
    for (let i = 0; i < context.teams.length; i++) {
      const team = context.teams[i];
      const state = this.teamAiState(team, request);
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
      sceneTeams.push({
        side: team.side,
        players: team.players,
        positions: positions,
      });
    }
    return {
      ballPosition: this.config.pitch.initialBallPosition,
      sceneTeams: sceneTeams,
      readyPlayer: readyPlayer,
    };
  }

  private applyPositioningRules(positions, side, takerIndex) {
    const result = [];
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

  public teamAiState(team, request) {
    return team.side == request.awardedTo ? "kickoffUs" : "kickoffOpponent";
  }

  public canTeamMove(team, request) {
    return team.side == request.awardedTo;
  }

  public enforceRules(context, request) {
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
      player.velocity.x = 0;
      player.velocity.y = 0;
    }
  }

  public isComplete(context) {
    const velocity = context.ball.velocity;
    const minSpeed = this.config.physics.minVelocity || 0;
    return (
      velocity.x * velocity.x + velocity.y * velocity.y > minSpeed * minSpeed
    );
  }
}
