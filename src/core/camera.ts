import { math as MathLib } from "../math/math";
import { Vector2 as Vector2d } from "../math/vector";
export { Camera };

class Camera {
  [key: string]: any;
  public constructor(config, stadium) {
    this.config = config;
    this.stadium = stadium;
    this.position = new Vector2d(0, 0);
    this.focusTarget = null;
    this.showStats = false;
  }

  public windowToViewport(ctx) {
    ctx.save();
    const scaleBy = this.config.computeScaleBy();
    ctx.scale(scaleBy, scaleBy);
    const target = this.focusTarget || this.stadium.ball.position;
    const desired = this.viewportPositionForTarget(target, scaleBy);
    if (this.focusTarget != null) {
      const lerp = this.config.cutscene.cameraLerp || 1;
      this.position.x += (desired.x - this.position.x) * lerp;
      this.position.y += (desired.y - this.position.y) * lerp;
    } else {
      this.position.x = desired.x;
      this.position.y = desired.y;
    }
    ctx.translate(this.position.x, this.position.y);
  }

  // Private helpers

  private viewportPositionForTarget(target, scaleBy) {
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

  public setFocusTarget(target) {
    this.focusTarget = target;
  }

  public clearFocusTarget() {
    this.focusTarget = null;
  }

  public hasArrivedAtFocus() {
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

  public renderOverlay(ctx, displayFps) {
    if (
      this.config.viewport.ratio >= this.config.viewport.overlayMinRatio &&
      this.config.viewport.ratio <= this.config.viewport.overlayMaxRatio
    ) {
      ctx.font = "30px Arial";
      ctx.fillStyle = "white";
      ctx.fillText(
        this.stadium.homeTeam.score,
        20 - this.position.x,
        40 - this.position.y,
      );
      ctx.fillStyle = "red";
      ctx.fillText(
        this.stadium.homeTeam.score,
        21 - this.position.x,
        39 - this.position.y,
      );
      ctx.fillStyle = "white";
      ctx.fillText("-", 60 - this.position.x, 40 - this.position.y);
      ctx.fillStyle = "black";
      ctx.fillText("-", 61 - this.position.x, 39 - this.position.y);
      ctx.fillStyle = "white";
      ctx.fillText(
        this.stadium.awayTeam.score,
        80 - this.position.x,
        40 - this.position.y,
      );
      ctx.fillStyle = "blue";
      ctx.fillText(
        this.stadium.awayTeam.score,
        81 - this.position.x,
        39 - this.position.y,
      );
      if (this.showStats) {
        ctx.font = "10px Arial";
        ctx.fillStyle = "white";
        ctx.fillText(
          "FPS: " + displayFps,
          350 - this.position.x,
          15 - this.position.y,
        );
      }
    }
    ctx.restore();
  }
}
