export { Stadium };

class Stadium {
  [key: string]: any;
  public constructor(imgStadium, ball, homeTeam, awayTeam) {
    this.imgStadium = imgStadium;
    this.ball = ball;
    this.homeTeam = homeTeam;
    this.awayTeam = awayTeam;
    this.teams = [this.homeTeam, this.awayTeam];
    this.players = homeTeam.players.concat(awayTeam.players);
  }

  public draw(ctx) {
    ctx.drawImage(this.imgStadium, 0, 0);
    if (this.ball.heldBy == null) this.ball.draw(ctx);
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i] === this.homeTeam.humanPlayer) {
        this.drawHumanPlayerMarker(ctx, this.players[i]);
      }
      this.players[i].draw(ctx);
    }
    if (this.ball.heldBy != null) this.ball.draw(ctx);
  }

  // Private helpers

  private drawHumanPlayerMarker(ctx, player) {
    const centerX = player.position.x - 1;
    const centerY = player.position.y - 2;
    const outerRadius = 10;
    const innerRadius = 4;
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
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
    ctx.stroke();
  }
}
