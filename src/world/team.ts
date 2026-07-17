import { Formation } from "../ai/formation";
import type { Configuration } from "../core/configuration";
import type { TeamSide } from "../types";
import { Player } from "./player";
export { Team };

class Team {
  public readonly config: Configuration;
  public readonly side: TeamSide;
  public readonly players: Player[];
  public humanPlayer: Player | null;
  public score: number;

  public constructor(config: Configuration, side: TeamSide) {
    this.config = config;
    this.side = side;
    this.players = this.createPlayers();
    this.humanPlayer = side == "home" ? this.players[0] : null;
    this.score = 0;
  }

  // Private helpers

  private createPlayers(): Player[] {
    const size =
      this.side == "home"
        ? this.config.teams.homeSize
        : this.config.teams.awaySize;
    const kickoffState =
      this.config.restarts.kickoffSide == this.side
        ? "kickoffUs"
        : "kickoffOpponent";
    const positions = new Formation(this.config).positions(
      kickoffState,
      this.side,
      size,
    );
    const players: Player[] = [];
    const img =
      this.side == "home"
        ? this.config.assets.playerHome
        : this.config.assets.playerAway;

    for (let i = 0; i < positions.length; i++) {
      const player = new Player(
        img,
        positions[i],
        this.config.player.spriteWidth,
        this.config.player.spriteHeight,
        this.config.player.spriteCenterX,
        this.config.player.spriteCenterY,
        this.config.player,
      );
      player.teamSide = this.side;
      if (this.side == "away") {
        player.facingY = 1;
      }
      players.push(player);
    }

    return players;
  }
}
