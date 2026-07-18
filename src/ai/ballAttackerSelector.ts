import { math } from "../math/math";
import type { Configuration } from "../core/configuration";
import type { Ball } from "../world/ball";
import type { Player } from "../world/player";
import type { Team } from "../world/team";

export class BallAttackerSelector {
  private readonly config: Configuration;
  private readonly team: Team;
  private readonly ball: Ball;
  private selected: Player | null = null;

  public constructor(config: Configuration, team: Team, ball: Ball) {
    this.config = config;
    this.team = team;
    this.ball = ball;
  }

  public reset(): void {
    this.selected = null;
  }

  public select(): Player | null {
    const closest = this.closestPlayer();
    if (closest == null) return this.selected;
    if (this.selected != null && closest !== this.selected) {
      const currentDistance = math.computeDistance(
        this.selected.position,
        this.ball.position,
      );
      const closestDistance = math.computeDistance(
        closest.position,
        this.ball.position,
      );
      if (
        currentDistance <=
        closestDistance + this.config.ai.attackerSwitchHysteresisDistance
      ) {
        return this.selected;
      }
    }
    this.selected = closest;
    return closest;
  }

  public snapshot(): { selectedIndex: number } {
    return {
      selectedIndex:
        this.selected == null ? -1 : this.team.players.indexOf(this.selected),
    };
  }

  private closestPlayer(): Player | null {
    let closest: Player | null = null;
    let closestDistance = Infinity;
    for (const player of this.team.players) {
      const distance = math.computeDistance(
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
}
