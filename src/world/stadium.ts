import type { Ball } from "./ball";
import type { Player } from "./player";
import type { Team } from "./team";

export { Stadium };

class Stadium {
  public readonly imgStadium: HTMLImageElement;
  public readonly ball: Ball;
  public readonly homeTeam: Team;
  public readonly awayTeam: Team;
  public readonly teams: Team[];
  public readonly players: Player[];

  public constructor(
    imgStadium: HTMLImageElement,
    ball: Ball,
    homeTeam: Team,
    awayTeam: Team,
  ) {
    this.imgStadium = imgStadium;
    this.ball = ball;
    this.homeTeam = homeTeam;
    this.awayTeam = awayTeam;
    this.teams = [this.homeTeam, this.awayTeam];
    this.players = homeTeam.players.concat(awayTeam.players);
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    showHumanPlayerMarker: boolean = true,
  ): void {
    ctx.drawImage(this.imgStadium, 0, 0);
    if (this.ball.heldBy == null) this.ball.drawShadow(ctx);
    const bodies: Array<{
      groundY: number;
      order: number;
      draw: () => void;
    }> = [];
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      bodies.push({
        groundY: player.position.y,
        order: i,
        draw: () => {
          if (showHumanPlayerMarker && player === this.homeTeam.humanPlayer) {
            this.drawHumanPlayerMarker(ctx, player);
          }
          player.draw(ctx);
        },
      });
    }
    if (this.ball.heldBy == null) {
      bodies.push({
        groundY: this.ball.position.y,
        order: this.players.length,
        draw: () => this.ball.drawBody(ctx),
      });
    }
    bodies.sort(
      (left, right) => left.groundY - right.groundY || left.order - right.order,
    );
    for (const body of bodies) body.draw();
    if (this.ball.heldBy != null) this.ball.drawBody(ctx);
  }

  // Private helpers

  private drawHumanPlayerMarker(
    ctx: CanvasRenderingContext2D,
    player: Player,
  ): void {
    const marker = this.homeTeam.config.player;
    const centerX = player.position.x + marker.markerOffsetX;
    const centerY = player.position.y + marker.markerOffsetY;
    const outerRadius = marker.markerOuterRadius;
    const innerRadius = marker.markerInnerRadius;
    const points = 5;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 == 0 ? outerRadius : innerRadius;
      const angle = -Math.PI / 2 + (i * Math.PI) / points;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      if (i == 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.lineWidth = marker.markerLineWidth;
    ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
    ctx.stroke();
  }
}
