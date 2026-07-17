import { Vector2 as Vector2d } from "../../math/vector";
import type { Configuration } from "../../core/configuration";
import type { Boundary, BoundaryEvent } from "../../types";
import type { Ball } from "../ball";
export { BoundaryDetector };

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface CrossingCandidate {
  boundary: Boundary;
  position: Vector2d;
  t: number;
}

class BoundaryDetector {
  private readonly config: Configuration;
  private readonly ball: Ball;
  private previousPosition: Vector2d;
  private outside: boolean;

  public constructor(config: Configuration, ball: Ball) {
    this.config = config;
    this.ball = ball;
    this.previousPosition = new Vector2d(ball.position.x, ball.position.y);
    this.outside = false;
  }

  public update(): BoundaryEvent | null {
    const current = new Vector2d(this.ball.position.x, this.ball.position.y);
    if (!this.config.restarts.outOfPlayEnabled) {
      this.previousPosition = current;
      this.outside = false;
      return null;
    }

    const crossing = this.firstCrossing(this.previousPosition, current);
    const currentlyOutside = this.isOutside(current);
    if (!currentlyOutside) {
      this.previousPosition = current;
      this.outside = false;
      return null;
    }
    if (this.outside) return null;

    this.outside = true;
    const lastInBounds = this.previousPosition;
    this.previousPosition = current;
    if (crossing == null) return null;
    return {
      boundary: crossing.boundary,
      position: crossing.position,
      lastTouchedBy: this.ball.lastTouchedBy,
      lastInBounds: new Vector2d(lastInBounds.x, lastInBounds.y),
    };
  }

  // Private helpers

  private isOutside(position: Vector2d): boolean {
    const bounds = this.bounds();
    return (
      position.x < bounds.left ||
      position.x > bounds.right ||
      position.y < bounds.top ||
      position.y > bounds.bottom
    );
  }

  private bounds(): Bounds {
    const radius = this.ball.ballRadius || this.config.ball.radius || 0;
    return {
      left: this.config.pitch.fieldLeft - radius,
      right: this.config.pitch.fieldRight + radius,
      top: this.config.pitch.fieldTop - radius,
      bottom: this.config.pitch.fieldBottom + radius,
    };
  }

  private firstCrossing(
    from: Vector2d,
    to: Vector2d,
  ): CrossingCandidate | null {
    const bounds = this.bounds();
    const candidates: CrossingCandidate[] = [];
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

  private addVerticalCrossing(
    candidates: CrossingCandidate[],
    boundary: Boundary,
    x: number,
    from: Vector2d,
    to: Vector2d,
  ): void {
    const dx = to.x - from.x;
    if (dx == 0) return;
    const t = (x - from.x) / dx;
    if (t < 0 || t > 1) return;
    const y = from.y + (to.y - from.y) * t;
    const bounds = this.bounds();
    if (y < bounds.top || y > bounds.bottom) return;
    candidates.push({ boundary: boundary, position: new Vector2d(x, y), t: t });
  }

  private addHorizontalCrossing(
    candidates: CrossingCandidate[],
    boundary: Boundary,
    y: number,
    from: Vector2d,
    to: Vector2d,
  ): void {
    const dy = to.y - from.y;
    if (dy == 0) return;
    const t = (y - from.y) / dy;
    if (t < 0 || t > 1) return;
    const x = from.x + (to.x - from.x) * t;
    const bounds = this.bounds();
    if (x < bounds.left || x > bounds.right) return;
    candidates.push({ boundary: boundary, position: new Vector2d(x, y), t: t });
  }

  public reset(): void {
    this.previousPosition = new Vector2d(
      this.ball.position.x,
      this.ball.position.y,
    );
    this.outside = false;
  }
}
