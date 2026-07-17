import { math as MathLib } from "../../math/math";
import type { Vector2 } from "../../math/vector";
import { Vector3 as Vector3d } from "../../math/vector";
import type { Configuration } from "../configuration";
import type {
  GameContext,
  PositioningOptions,
  RestartSceneTeam,
  TeamSide,
} from "../../types";
import type { Ball } from "../../world/ball";
import type { Player } from "../../world/player";
export { PositioningController };

class PositioningController {
  private readonly config: Configuration;
  private active: boolean;
  public ballPosition: Vector3d | null;
  public sceneTeams: RestartSceneTeam[];
  public readyPlayer: Player | null;
  private onComplete: ((context: GameContext) => void) | null;

  public constructor(config: Configuration) {
    this.config = config;
    this.active = false;
    this.ballPosition = null;
    this.sceneTeams = [];
    this.readyPlayer = null;
    this.onComplete = null;
  }

  public isActive(): boolean {
    return this.active == true;
  }

  public play(options: PositioningOptions): boolean {
    if (!this.validRestartOptions(options)) return false;

    this.active = true;
    this.ballPosition = new Vector3d(
      options.ballPosition.x,
      options.ballPosition.y,
      options.ballPosition.z || 0,
    );
    this.sceneTeams = options.sceneTeams;
    this.readyPlayer = options.readyPlayer || null;
    this.onComplete =
      typeof options.onComplete == "function" ? options.onComplete : null;
    this.stopPlayers();
    return true;
  }

  public isReadyForInput(): boolean {
    if (!this.active || this.readyPlayer == null) return false;
    for (let t = 0; t < this.sceneTeams.length; t++) {
      const sceneTeam = this.sceneTeams[t];
      for (let i = 0; i < sceneTeam.players.length; i++) {
        if (sceneTeam.players[i] === this.readyPlayer) {
          return (
            MathLib.computeDistance(
              this.readyPlayer.position,
              sceneTeam.positions[i],
            ) <= this.config.cutscene.arrivedRadius
          );
        }
      }
    }
    return false;
  }

  public updateBeforePhysics(context: GameContext): void {
    if (!this.active) return;
    this.lockBall(context.ball);
    if (this.ballPosition != null)
      context.camera.setFocusTarget(this.ballPosition);
    this.updatePlayers(context);
  }

  public updateAfterPhysics(context: GameContext): void {
    if (!this.active) return;
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
    this.onComplete = null;
    this.clear(context);
  }

  // Private helpers

  private validRestartOptions(options: PositioningOptions): boolean {
    if (
      options == null ||
      options.ballPosition == null ||
      options.sceneTeams == null
    )
      return false;
    if (options.sceneTeams.length == null) return false;
    for (let i = 0; i < options.sceneTeams.length; i++) {
      const sceneTeam = options.sceneTeams[i];
      if (
        sceneTeam == null ||
        sceneTeam.players == null ||
        sceneTeam.positions == null ||
        sceneTeam.side == null
      )
        return false;
      if (sceneTeam.players.length !== sceneTeam.positions.length) return false;
    }
    return true;
  }

  private updatePlayers(context: GameContext): boolean {
    let allArrived = true;
    for (let t = 0; t < this.sceneTeams.length; t++) {
      const sceneTeam = this.sceneTeams[t];
      for (let i = 0; i < sceneTeam.players.length; i++) {
        if (
          !this.movePlayerToTarget(
            context,
            sceneTeam.players[i],
            sceneTeam.positions[i],
            sceneTeam.side,
          )
        )
          allArrived = false;
      }
    }
    return allArrived;
  }

  private stopPlayers(): void {
    for (let t = 0; t < this.sceneTeams.length; t++) {
      const sceneTeam = this.sceneTeams[t];
      for (let i = 0; i < sceneTeam.players.length; i++) {
        sceneTeam.players[i].velocity.x = 0;
        sceneTeam.players[i].velocity.y = 0;
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
      player.position.x = target.x;
      player.position.y = target.y;
      player.velocity.x = 0;
      player.velocity.y = 0;
      return true;
    }
    player.velocity = MathLib.computeVelocityForTarget(
      player.position,
      target,
      context.config.teamVelocity(side),
    );
    return false;
  }

  private lockBall(ball: Ball): void {
    if (this.ballPosition == null) return;
    ball.position.x = this.ballPosition.x;
    ball.position.y = this.ballPosition.y;
    ball.position.z = this.ballPosition.z || 0;
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    ball.velocity.z = 0;
  }

  private clear(context: GameContext): void {
    const onComplete = this.onComplete;
    this.active = false;
    this.ballPosition = null;
    this.sceneTeams = [];
    this.readyPlayer = null;
    this.onComplete = null;
    context.camera.clearFocusTarget();
    if (onComplete != null) onComplete(context);
  }
}
