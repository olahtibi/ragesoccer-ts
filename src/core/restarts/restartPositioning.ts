import { Formation } from "../../ai/formation";
import { math as MathLib } from "../../math/math";
import { Vector2 as Vector2d } from "../../math/vector";
import type { Vector2 } from "../../math/vector";
import type { Configuration } from "../configuration";
import { TEAM_SIDES } from "../../types";
import type {
  GameContext,
  RestartRequest,
  RestartPlacements,
  RestartScene,
  RestartType,
  TeamAiState,
  TeamSide,
} from "../../types";
import type { Player } from "../../world/player";
export { RestartPositioning };

interface RestartPositioningApi {
  createScene(
    config: Configuration,
    context: GameContext,
    request: RestartRequest,
    ballPosition: Vector2,
    takerPosition: Vector2,
    takerIndex?: number | null,
    awardedState?: TeamAiState | null,
    awardedPositions?: Vector2[] | null,
  ): RestartScene;
  randomizePositions(
    config: Configuration,
    formation: Formation,
    positions: Vector2[],
    request: RestartRequest,
    teamSide: TeamSide,
    protectedIndex: number,
  ): Vector2[];
  randomValue(
    seed: number | undefined,
    teamSide: TeamSide,
    playerIndex: number,
    salt: number,
  ): number;
  closestPlayerIndex(players: Player[], position: Vector2): number;
  applyOpponentDistance(
    config: Configuration,
    formation: Formation,
    positions: Vector2[],
    ballPosition: Vector2,
  ): Vector2[];
  clampToPlayingField(config: Configuration, position: Vector2): Vector2;
  stateFor(
    type: Exclude<RestartType, "kickoff">,
    side: TeamSide,
    request: RestartRequest,
  ): TeamAiState;
}

const RestartPositioning: RestartPositioningApi = {
  createScene: function (
    config,
    context,
    request,
    ballPosition,
    takerPosition,
    takerIndex = null,
    awardedState = null,
    awardedPositions = null,
  ) {
    var formation = new Formation(config);
    var placements: RestartPlacements = { home: [], away: [] };
    var readyPlayer: Player | null = null;
    for (var i = 0; i < TEAM_SIDES.length; i++) {
      var team = context.teams[TEAM_SIDES[i]];
      var awarded = team.side == request.awardedTo;
      var positions =
        awarded && awardedPositions != null
          ? awardedPositions.slice()
          : formation.positions(
              awarded ? (awardedState ?? "attack") : "defense",
              team.side,
              team.players.length,
            );
      var selectedIndex = -1;
      if (awarded) {
        selectedIndex =
          takerIndex == null
            ? this.closestPlayerIndex(team.players, ballPosition)
            : takerIndex;
      }
      positions = this.randomizePositions(
        config,
        formation,
        positions,
        request,
        team.side,
        selectedIndex,
      );
      if (awarded) {
        positions[selectedIndex] = takerPosition;
        readyPlayer = team.players[selectedIndex];
      } else {
        positions = this.applyOpponentDistance(
          config,
          formation,
          positions,
          ballPosition,
        );
      }
      placements[team.side] = team.players.map(function (player, index) {
        return { player: player, target: positions[index] };
      });
    }
    return {
      ballPosition: ballPosition,
      placements: placements,
      readyPlayer: readyPlayer,
    };
  },

  randomizePositions: function (
    config,
    formation,
    positions,
    request,
    teamSide,
    protectedIndex,
  ) {
    var result: Vector2[] = [];
    var variationX = config.restarts.positionVariationX;
    var variationY = config.restarts.positionVariationY;
    for (var i = 0; i < positions.length; i++) {
      if (i == protectedIndex) {
        result.push(positions[i]);
        continue;
      }
      var x =
        positions[i].x +
        this.randomValue(request.positioningSeed, teamSide, i, 1) * variationX;
      var y =
        positions[i].y +
        this.randomValue(request.positioningSeed, teamSide, i, 2) * variationY;
      result.push(formation.clampToField(new Vector2d(x, y)));
    }
    return result;
  },

  randomValue: function (seed, teamSide, playerIndex, salt) {
    seed = seed ?? 0;
    var sideSeed = teamSide == "away" ? 0x9e3779b9 : 0x85ebca6b;
    var value =
      sideSeed ^
      Math.imul(seed + 1, 0x27d4eb2d) ^
      Math.imul(playerIndex + 1, 0x165667b1) ^
      Math.imul(salt + 1, 0x2c1b3c6d);
    value = Math.imul(value ^ (value >>> 15), 0x297a2d39);
    value = Math.imul(value ^ (value >>> 12), 0x1b873593);
    value = (value ^ (value >>> 15)) >>> 0;
    return value / 2147483647.5 - 1;
  },

  closestPlayerIndex: function (players, position) {
    var closestIndex = 0;
    var closestDistance = Infinity;
    for (var i = 0; i < players.length; i++) {
      var distance = MathLib.computeDistance(players[i].position, position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }
    return closestIndex;
  },

  applyOpponentDistance: function (config, formation, positions, ballPosition) {
    var result: Vector2[] = [];
    var minimum = config.restarts.opponentDistance;
    for (var i = 0; i < positions.length; i++) {
      var target = positions[i];
      var dx = target.x - ballPosition.x;
      var dy = target.y - ballPosition.y;
      var distance = MathLib.vectorLength(dx, dy);
      if (distance < minimum) {
        if (distance < config.physics.zeroDistanceEpsilon) {
          dx = config.pitch.initialBallPosition.x - ballPosition.x;
          dy = config.pitch.aiCenterY - ballPosition.y;
          distance = MathLib.vectorLength(dx, dy);
        }
        target = new Vector2d(
          ballPosition.x + (dx / distance) * minimum,
          ballPosition.y + (dy / distance) * minimum,
        );
      }
      result.push(this.clampToPlayingField(config, target));
    }
    return result;
  },

  clampToPlayingField: function (config, position) {
    return new Vector2d(
      Math.max(
        config.pitch.fieldLeft,
        Math.min(config.pitch.fieldRight, position.x),
      ),
      Math.max(
        config.pitch.fieldTop,
        Math.min(config.pitch.fieldBottom, position.y),
      ),
    );
  },

  stateFor: function (type, side, request) {
    return (type +
      (side == request.awardedTo ? "Us" : "Opponent")) as TeamAiState;
  },
};
