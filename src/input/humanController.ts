import { math as MathLib } from "../math/math";
import type { Vector2 } from "../math/vector";
import type { Configuration } from "../core/configuration";
import type { Ball } from "../world/ball";
import type { Player } from "../world/player";
import type { Team } from "../world/team";
export { HumanController };

class HumanController {
  public readonly config: Configuration;
  public readonly team: Team;
  public readonly ball: Ball;
  public keys: Record<number, boolean>;
  public touchTarget: Vector2 | null;

  public constructor(config: Configuration, team: Team, ball: Ball) {
    this.config = config;
    this.team = team;
    this.ball = ball;
    this.keys = {};
    this.touchTarget = null;
  }

  public player(): Player | null {
    return this.team.humanPlayer;
  }

  public setKey(keyCode: number, pressed: boolean): void {
    this.keys[keyCode] = pressed;
    if (this.hasMovementInput()) this.touchTarget = null;
  }

  public setTouchTarget(target: Vector2): void {
    this.touchTarget = target;
  }

  public clearInput(): void {
    this.keys = {};
    this.touchTarget = null;
    const player = this.player();
    if (player == null) return;
    player.velocity.x = 0;
    player.velocity.y = 0;
  }

  public hasMovementInput(): boolean {
    return Boolean(
      this.keys[37] || this.keys[38] || this.keys[39] || this.keys[40],
    );
  }

  public inputDirection(): Vector2 | null {
    let x = 0;
    let y = 0;
    if (this.keys[37]) x--;
    if (this.keys[39]) x++;
    if (this.keys[38]) y--;
    if (this.keys[40]) y++;
    if (x == 0 && y == 0) return null;
    return MathLib.normalizeVector(x, y, 0, -1);
  }

  public selectPlayer(preferredPlayer: Player | null = null): Player | null {
    if (preferredPlayer != null) {
      const selected = this.team.humanPlayer;
      if (selected != null && selected !== preferredPlayer) {
        selected.velocity.x = 0;
        selected.velocity.y = 0;
      }
      this.team.humanPlayer = preferredPlayer;
      return preferredPlayer;
    }

    const closest = this.closestPlayerToBall();
    const current = this.team.humanPlayer;
    if (closest == null) return current;
    if (current != null && closest !== current) {
      const currentDistance = MathLib.computeDistance(
        current.position,
        this.ball.position,
      );
      const closestDistance = MathLib.computeDistance(
        closest.position,
        this.ball.position,
      );
      if (
        currentDistance <=
        closestDistance + (this.config.input.humanSwitchHysteresisDistance || 0)
      ) {
        return current;
      }
    }
    if (current != null && closest !== current) {
      current.velocity.x = 0;
      current.velocity.y = 0;
    }
    this.team.humanPlayer = closest;
    return closest;
  }

  public closestPlayerToBall(): Player | null {
    let closest: Player | null = null;
    let distance = Infinity;
    for (let i = 0; i < this.team.players.length; i++) {
      const candidate = this.team.players[i];
      const candidateDistance = MathLib.computeDistance(
        candidate.position,
        this.ball.position,
      );
      if (candidateDistance < distance) {
        closest = candidate;
        distance = candidateDistance;
      }
    }
    return closest;
  }

  public update(canMove: boolean): void {
    const player = this.player();
    if (player == null) return;
    player.velocity.x = 0;
    player.velocity.y = 0;
    if (!canMove) {
      this.touchTarget = null;
      return;
    }

    const velocity = this.config.teamVelocity("home");
    if (this.hasMovementInput()) {
      if (this.keys[38]) player.velocity.y -= velocity;
      if (this.keys[40]) player.velocity.y += velocity;
      if (this.keys[37]) player.velocity.x -= velocity;
      if (this.keys[39]) player.velocity.x += velocity;
      if (player.velocity.x != 0 && player.velocity.y != 0) {
        player.velocity.x /= Math.sqrt(2);
        player.velocity.y /= Math.sqrt(2);
      }
      return;
    }

    if (this.touchTarget == null) return;
    if (
      MathLib.computeDistance(player.position, this.touchTarget) <=
      (this.config.ai.targetReachedRadius || 1)
    ) {
      this.touchTarget = null;
      return;
    }
    player.velocity = MathLib.computeVelocityForTarget(
      player.position,
      this.touchTarget,
      velocity,
    );
  }
}
