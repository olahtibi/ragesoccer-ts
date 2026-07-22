import { math as MathLib } from "../math/math";
import { Vector2 as Vector2d } from "../math/vector";
import type { Stadium } from "../world/stadium";
import type { Configuration } from "./configuration";
export { Camera };

class Camera {
  public readonly config: Configuration;
  public readonly stadium: Stadium;
  public readonly position: Vector2d;
  public focusTarget: Vector2d | null;
  public showStats: boolean;

  public constructor(config: Configuration, stadium: Stadium) {
    this.config = config;
    this.stadium = stadium;
    this.position = new Vector2d(0, 0);
    this.focusTarget = null;
    this.showStats = false;
  }

  public windowToViewport(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const scaleBy = this.config.computeScaleBy();
    ctx.scale(scaleBy, scaleBy);
    const target = this.focusTarget ?? this.stadium.ball.position;
    const desired = this.viewportPositionForTarget(target, scaleBy);
    if (this.focusTarget != null) {
      const lerp = this.config.cutscene.cameraLerp;
      this.position.x += (desired.x - this.position.x) * lerp;
      this.position.y += (desired.y - this.position.y) * lerp;
    } else {
      this.position.x = desired.x;
      this.position.y = desired.y;
    }
    ctx.translate(this.position.x, this.position.y);
  }

  // Private helpers

  private viewportPositionForTarget(
    target: Vector2d,
    scaleBy: number,
  ): Vector2d {
    const position = new Vector2d(0, 0);
    if (
      target.x * scaleBy >=
      this.config.pitch.stadiumWidth * scaleBy - this.config.viewport.width / 2
    ) {
      position.x =
        (this.config.viewport.width -
          this.config.pitch.stadiumWidth * scaleBy) /
        scaleBy;
    } else if (target.x * scaleBy <= this.config.viewport.width / 2) {
      position.x = 0;
    } else {
      position.x =
        (this.config.viewport.width / 2 - target.x * scaleBy) / scaleBy;
    }
    if (
      target.y * scaleBy >=
      this.config.pitch.stadiumHeight * scaleBy -
        this.config.viewport.height / 2
    ) {
      position.y =
        (this.config.viewport.height -
          this.config.pitch.stadiumHeight * scaleBy) /
        scaleBy;
    } else if (target.y * scaleBy <= this.config.viewport.height / 2) {
      position.y = 0;
    } else {
      position.y =
        (this.config.viewport.height / 2 - target.y * scaleBy) / scaleBy;
    }
    return position;
  }

  public setFocusTarget(target: Vector2d): void {
    this.focusTarget = target;
  }

  public clearFocusTarget(): void {
    this.focusTarget = null;
  }

  public hasArrivedAtFocus(): boolean {
    if (this.focusTarget == null) {
      return true;
    }
    const desired = this.viewportPositionForTarget(
      this.focusTarget,
      this.config.computeScaleBy(),
    );
    return (
      MathLib.computeDistance(this.position, desired) <=
      this.config.cutscene.cameraArrivedRadius
    );
  }

  public renderOverlay(
    ctx: CanvasRenderingContext2D,
    displayFps: number,
  ): void {
    ctx.restore();
    ctx.save();

    const screenWidth = ctx.canvas?.width || this.config.viewport.width;
    const margin = 8;
    const panelWidth = Math.max(0, Math.min(176, screenWidth - margin * 2));
    const panelHeight = 28;
    const panelX = margin;
    const panelY = margin;

    this.drawScorePanel(ctx, panelX, panelY, panelWidth, panelHeight);
    if (this.showStats) {
      this.drawFpsPanel(
        ctx,
        displayFps,
        screenWidth,
        panelX,
        panelY,
        panelWidth,
        panelHeight,
      );
    }

    ctx.restore();
  }

  private drawScorePanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    this.drawHudPanel(ctx, x, y, width, height);

    const centerY = y + height / 2;
    ctx.fillStyle = "#e4473a";
    ctx.fillRect(x + 1, y + 1, 4, Math.max(0, height - 2));
    ctx.fillStyle = "#3974d9";
    ctx.fillRect(x + width - 5, y + 1, 4, Math.max(0, height - 2));

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 11px "Arial Narrow", Arial, sans-serif';
    this.drawHudText(
      ctx,
      this.stadium.homeTeam.shortName,
      x + 27,
      centerY,
      "#ffffff",
    );
    this.drawHudText(
      ctx,
      this.stadium.awayTeam.shortName,
      x + width - 27,
      centerY,
      "#ffffff",
    );

    ctx.font = 'bold 14px "Arial Narrow", Arial, sans-serif';
    this.drawHudText(
      ctx,
      String(this.stadium.homeTeam.score),
      x + 65,
      centerY,
      "#ffffff",
    );
    this.drawHudText(ctx, "-", x + width / 2, centerY, "#d8d8d8");
    this.drawHudText(
      ctx,
      String(this.stadium.awayTeam.score),
      x + width - 65,
      centerY,
      "#ffffff",
    );
  }

  private drawFpsPanel(
    ctx: CanvasRenderingContext2D,
    displayFps: number,
    screenWidth: number,
    scoreX: number,
    scoreY: number,
    scoreWidth: number,
    scoreHeight: number,
  ): void {
    const margin = 8;
    const width = 68;
    const height = 20;
    const x = Math.max(margin, screenWidth - margin - width);
    const overlapsScore = x < scoreX + scoreWidth + 4;
    const y = overlapsScore ? scoreY + scoreHeight + 6 : margin;

    this.drawHudPanel(ctx, x, y, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 10px "Arial Narrow", Arial, sans-serif';
    this.drawHudText(
      ctx,
      `FPS ${displayFps}`,
      x + width / 2,
      y + height / 2,
      "#8dff8a",
    );
  }

  private drawHudPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    ctx.fillStyle = "rgba(72, 72, 72, 0.3)";
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillRect(x, y, width, 1);
    ctx.fillRect(x, y + height - 1, width, 1);
    ctx.fillRect(x, y + 1, 1, Math.max(0, height - 2));
    ctx.fillRect(x + width - 1, y + 1, 1, Math.max(0, height - 2));
  }

  private drawHudText(
    ctx: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    color: string,
  ): void {
    ctx.fillStyle = "#000000";
    ctx.fillText(value, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }
}
