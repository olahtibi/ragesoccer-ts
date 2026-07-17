import { Vector2 as Vector2d } from "../../math/vector";
export { BoundaryDetector };

class BoundaryDetector {
  [key: string]: any;
  public constructor(config, ball) {
    this._config = config;
    this._ball = ball;
    this._previousPosition = new Vector2d(ball.position.x, ball.position.y);
    this._outside = false;
  }

  public update() {
    const current = new Vector2d(this._ball.position.x, this._ball.position.y);
    if (!this._config.restarts.outOfPlayEnabled) {
      this._previousPosition = current;
      this._outside = false;
      return null;
    }

    const crossing = this.firstCrossing(this._previousPosition, current);
    const currentlyOutside = this.isOutside(current);
    if (!currentlyOutside) {
      this._previousPosition = current;
      this._outside = false;
      return null;
    }
    if (this._outside) return null;

    this._outside = true;
    const lastInBounds = this._previousPosition;
    this._previousPosition = current;
    if (crossing == null) return null;
    crossing.lastTouchedBy = this._ball.lastTouchedBy;
    crossing.lastInBounds = new Vector2d(lastInBounds.x, lastInBounds.y);
    return crossing;
  }

  // Private helpers

  private isOutside(position) {
    const bounds = this.bounds();
    return (
      position.x < bounds.left ||
      position.x > bounds.right ||
      position.y < bounds.top ||
      position.y > bounds.bottom
    );
  }

  private bounds() {
    const radius = this._ball.ballRadius || this._config.ball.radius || 0;
    return {
      left: this._config.pitch.fieldLeft - radius,
      right: this._config.pitch.fieldRight + radius,
      top: this._config.pitch.fieldTop - radius,
      bottom: this._config.pitch.fieldBottom + radius,
    };
  }

  private firstCrossing(from, to) {
    const bounds = this.bounds();
    const candidates = [];
    this.addVerticalCrossing(candidates, "left", bounds.left, from, to);
    this.addVerticalCrossing(candidates, "right", bounds.right, from, to);
    this.addHorizontalCrossing(candidates, "top", bounds.top, from, to);
    this.addHorizontalCrossing(candidates, "bottom", bounds.bottom, from, to);
    if (candidates.length == 0) return null;
    candidates.sort(function (a, b) {
      return a.t - b.t;
    });
    return candidates[0];
  }

  private addVerticalCrossing(candidates, boundary, x, from, to) {
    const dx = to.x - from.x;
    if (dx == 0) return;
    const t = (x - from.x) / dx;
    if (t < 0 || t > 1) return;
    const y = from.y + (to.y - from.y) * t;
    const bounds = this.bounds();
    if (y < bounds.top || y > bounds.bottom) return;
    candidates.push({ boundary: boundary, position: new Vector2d(x, y), t: t });
  }

  private addHorizontalCrossing(candidates, boundary, y, from, to) {
    const dy = to.y - from.y;
    if (dy == 0) return;
    const t = (y - from.y) / dy;
    if (t < 0 || t > 1) return;
    const x = from.x + (to.x - from.x) * t;
    const bounds = this.bounds();
    if (x < bounds.left || x > bounds.right) return;
    candidates.push({ boundary: boundary, position: new Vector2d(x, y), t: t });
  }

  public reset() {
    this._previousPosition = new Vector2d(
      this._ball.position.x,
      this._ball.position.y,
    );
    this._outside = false;
  }
}
