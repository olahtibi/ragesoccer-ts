import { math as MathLib } from "../../math/math";
import type { Vector2 } from "../../math/vector";
import { Vector3 as Vector3d } from "../../math/vector";
import type { Configuration } from "../configuration";
import type {
  GameContext,
  PlayerPlacement,
  PositioningOptions,
  RestartPlacements,
  TeamSide,
} from "../../types";
import type { Ball } from "../../world/ball";
import type { Player } from "../../world/player";
export { PositioningController };

class PositioningController {
  private readonly config: Configuration;
  private session: PositioningSession | null;

  public constructor(config: Configuration) {
    this.config = config;
    this.session = null;
  }

  public isActive(): boolean {
    return this.session != null;
  }

  public play(options: PositioningOptions): void {
    const readyPlayers = [
      ...(options.readyPlayer == null ? [] : [options.readyPlayer]),
      ...(options.additionalReadyPlayers ?? []),
    ];
    const placedReadyPlayers = new Set<Player>();
    for (const side of ["home", "away"] as const) {
      for (const placement of options.placements[side]) {
        if (placement.player.teamSide != side) {
          throw new Error(`Invalid ${side} positioning placement`);
        }
        if (readyPlayers.includes(placement.player)) {
          placedReadyPlayers.add(placement.player);
        }
      }
    }
    if (placedReadyPlayers.size != new Set(readyPlayers).size) {
      throw new Error("Required ready player has no positioning placement");
    }
    const ballPosition = new Vector3d(
      options.ballPosition.x,
      options.ballPosition.y,
      options.ballPosition.z ?? 0,
    );
    this.session = {
      ballPosition,
      placements: options.placements,
      readyPlayer: options.readyPlayer,
      additionalReadyPlayers: options.additionalReadyPlayers ?? [],
      onComplete: options.onComplete,
    };
    this.stopPlayers();
  }

  public readyPlayer(): Player | null {
    return this.session?.readyPlayer ?? null;
  }

  public placements(): RestartPlacements | null {
    return this.session?.placements ?? null;
  }

  public ballPosition(): Vector3d | null {
    return this.session?.ballPosition ?? null;
  }

  public isReadyForInput(): boolean {
    if (this.session?.readyPlayer == null) return false;
    const requiredPlayers = [
      this.session.readyPlayer,
      ...this.session.additionalReadyPlayers,
    ];
    const arrivedPlayers = new Set<Player>();
    for (const side of ["home", "away"] as const) {
      for (const placement of this.session.placements[side]) {
        if (
          requiredPlayers.includes(placement.player) &&
          this.arrived(placement)
        ) {
          arrivedPlayers.add(placement.player);
        }
      }
    }
    return arrivedPlayers.size == new Set(requiredPlayers).size;
  }

  public updateBeforePhysics(context: GameContext): void {
    if (this.session == null) return;
    this.lockBall(context.ball);
    context.camera.setFocusTarget(this.session.ballPosition);
    this.updatePlayers(context);
  }

  public updateAfterPhysics(context: GameContext): void {
    if (this.session == null) return;
    this.lockBall(context.ball);
    const allPlayersArrived = this.updatePlayers(context);
    const cameraArrived = context.camera.hasArrivedAtFocus();
    if (allPlayersArrived && cameraArrived) this.clear(context);
  }

  public update(context: GameContext): void {
    this.updateBeforePhysics(context);
    this.updateAfterPhysics(context);
  }

  public cancel(context: GameContext): void {
    if (this.session != null) this.session.onComplete = null;
    this.clear(context);
  }

  // Private helpers

  private updatePlayers(context: GameContext): boolean {
    if (this.session == null) return true;
    let allArrived = true;
    for (const side of ["home", "away"] as const) {
      for (const placement of this.session.placements[side]) {
        if (
          !this.movePlayerToTarget(
            context,
            placement.player,
            placement.target,
            side,
          )
        )
          allArrived = false;
      }
    }
    return allArrived;
  }

  private stopPlayers(): void {
    if (this.session == null) return;
    for (const side of ["home", "away"] as const) {
      for (const placement of this.session.placements[side]) {
        placement.player.stop();
      }
    }
  }

  private movePlayerToTarget(
    context: GameContext,
    player: Player,
    target: Vector2,
    side: TeamSide,
  ): boolean {
    const distance = MathLib.computeDistance(player.position, target);
    const dx = target.x - player.position.x;
    const dy = target.y - player.position.y;
    const movingAway =
      player.velocity.x * dx + player.velocity.y * dy <= 0 &&
      (player.velocity.x != 0 || player.velocity.y != 0);
    if (distance <= this.config.cutscene.arrivedRadius || movingAway) {
      player.placeAt(target);
      return true;
    }
    player.velocity = MathLib.velocityTowards(
      player.position,
      target,
      context.config.teamVelocity(side),
    );
    return false;
  }

  private lockBall(ball: Ball): void {
    if (this.session == null) return;
    ball.placeAt(this.session.ballPosition);
  }

  private clear(context: GameContext): void {
    const onComplete = this.session?.onComplete ?? null;
    this.session = null;
    context.camera.clearFocusTarget();
    if (onComplete != null) onComplete(context);
  }

  private arrived(placement: PlayerPlacement): boolean {
    return (
      MathLib.computeDistance(placement.player.position, placement.target) <=
      this.config.cutscene.arrivedRadius
    );
  }
}

interface PositioningSession {
  ballPosition: Vector3d;
  placements: PositioningOptions["placements"];
  readyPlayer: Player | null;
  additionalReadyPlayers: Player[];
  onComplete: ((context: GameContext) => void) | null;
}
