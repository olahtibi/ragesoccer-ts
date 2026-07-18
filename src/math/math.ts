import { Vector2 } from "./vector";

export const math = {
  computeAngleRadians(x: number, y: number): number {
    const angle = Math.atan2(y, x);
    return angle < 0 ? angle + Math.PI * 2 : angle;
  },

  angleDeltaRadians(targetAngle: number, currentAngle: number): number {
    let delta = targetAngle - currentAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return delta;
  },

  vectorLength(x: number, y: number): number {
    return Math.hypot(x, y);
  },

  distanceSquared(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  },

  normalizeVector(x: number, y: number, fallbackX = 0, fallbackY = 0): Vector2 {
    const length = Math.hypot(x, y);
    return length <= 0.0001
      ? new Vector2(fallbackX, fallbackY)
      : new Vector2(x / length, y / length);
  },

  vectorFromAngleRadians(angle: number, radius: number): Vector2 {
    return new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
  },

  pointInRectangle(
    point: Vector2,
    topLeft: Vector2,
    bottomRight: Vector2,
  ): boolean {
    return (
      point.x >= topLeft.x &&
      point.x <= bottomRight.x &&
      point.y >= topLeft.y &&
      point.y <= bottomRight.y
    );
  },

  verticalIntersection(
    start: Vector2,
    end: Vector2,
    x: number,
  ): Vector2 | null {
    if (
      (start.x < x && end.x < x) ||
      (start.x > x && end.x > x) ||
      start.x === end.x
    )
      return null;
    const ratio = (x - start.x) / (end.x - start.x);
    return new Vector2(x, start.y + (end.y - start.y) * ratio);
  },

  horizontalIntersection(
    start: Vector2,
    end: Vector2,
    y: number,
  ): Vector2 | null {
    if (
      (start.y < y && end.y < y) ||
      (start.y > y && end.y > y) ||
      start.y === end.y
    )
      return null;
    const ratio = (y - start.y) / (end.y - start.y);
    return new Vector2(start.x + (end.x - start.x) * ratio, y);
  },

  velocityTowards(position: Vector2, target: Vector2, speed: number): Vector2 {
    const direction = this.normalizeVector(
      target.x - position.x,
      target.y - position.y,
    );
    return new Vector2(direction.x * speed, direction.y * speed);
  },

  computeDistance(a: Vector2, b: Vector2): number {
    return Math.sqrt(this.distanceSquared(a, b));
  },

  isIntersectedVertically(
    p1X: number,
    p2X: number,
    pY: number,
    ballX: number,
    ballY: number,
    moveY: number,
  ): boolean {
    return (
      ballX >= p1X &&
      ballX <= p2X &&
      ((ballY >= pY && ballY + moveY <= pY) ||
        (ballY <= pY && ballY + moveY >= pY))
    );
  },

  isIntersectedHorizontally(
    p1Y: number,
    p2Y: number,
    pX: number,
    ballX: number,
    ballY: number,
    moveX: number,
  ): boolean {
    return (
      ballY >= p1Y &&
      ballY <= p2Y &&
      ((ballX >= pX && ballX + moveX <= pX) ||
        (ballX <= pX && ballX + moveX >= pX))
    );
  },
};
