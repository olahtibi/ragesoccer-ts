import { math as MathLib } from "../../math/math";
import { Vector3 as Vector3d } from "../../math/vector";
export { PositioningController };

class PositioningController {
  [key: string]: any;
  public constructor(config) {
    this._config = config;
    this._active = false;
    this.ballPosition = null;
    this._sceneTeams = [];
    this._readyPlayer = null;
    this._onComplete = null;
  }

  public isActive() {
    return this._active == true;
  }

  public play(options) {
    if (!this.validRestartOptions(options)) return false;

    this._active = true;
    this.ballPosition = new Vector3d(
      options.ballPosition.x,
      options.ballPosition.y,
      options.ballPosition.z || 0,
    );
    this._sceneTeams = options.sceneTeams;
    this._readyPlayer = options.readyPlayer || null;
    this._onComplete =
      typeof options.onComplete == "function" ? options.onComplete : null;
    this.stopPlayers();
    return true;
  }

  public isReadyForInput() {
    if (!this._active || this._readyPlayer == null) return false;
    for (let t = 0; t < this._sceneTeams.length; t++) {
      const sceneTeam = this._sceneTeams[t];
      for (let i = 0; i < sceneTeam.players.length; i++) {
        if (sceneTeam.players[i] === this._readyPlayer) {
          return (
            MathLib.computeDistance(
              this._readyPlayer.position,
              sceneTeam.positions[i],
            ) <= this._config.cutscene.arrivedRadius
          );
        }
      }
    }
    return false;
  }

  public updateBeforePhysics(context) {
    if (!this._active) return;
    this.lockBall(context.ball);
    if (context.camera != null && context.camera.setFocusTarget != null) {
      context.camera.setFocusTarget(this.ballPosition);
    }
    this.updatePlayers(context);
  }

  public updateAfterPhysics(context) {
    if (!this._active) return;
    this.lockBall(context.ball);
    const allPlayersArrived = this.updatePlayers(context);
    const cameraArrived =
      context.camera == null ||
      context.camera.hasArrivedAtFocus == null ||
      context.camera.hasArrivedAtFocus();
    if (allPlayersArrived && cameraArrived) this.clear(context);
  }

  public update(context) {
    this.updateBeforePhysics(context);
    this.updateAfterPhysics(context);
  }

  public cancel(context) {
    this._onComplete = null;
    this.clear(context);
  }

  // Private helpers

  private validRestartOptions(options) {
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

  private updatePlayers(context) {
    let allArrived = true;
    for (let t = 0; t < this._sceneTeams.length; t++) {
      const sceneTeam = this._sceneTeams[t];
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

  private stopPlayers() {
    for (let t = 0; t < this._sceneTeams.length; t++) {
      const sceneTeam = this._sceneTeams[t];
      for (let i = 0; i < sceneTeam.players.length; i++) {
        sceneTeam.players[i].velocity.x = 0;
        sceneTeam.players[i].velocity.y = 0;
      }
    }
  }

  private movePlayerToTarget(context, player, target, side) {
    const distance = MathLib.computeDistance(player.position, target);
    const dx = target.x - player.position.x;
    const dy = target.y - player.position.y;
    const movingAway =
      player.velocity.x * dx + player.velocity.y * dy <= 0 &&
      (player.velocity.x != 0 || player.velocity.y != 0);
    if (distance <= this._config.cutscene.arrivedRadius || movingAway) {
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

  private lockBall(ball) {
    ball.position.x = this.ballPosition.x;
    ball.position.y = this.ballPosition.y;
    ball.position.z = this.ballPosition.z || 0;
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    ball.velocity.z = 0;
  }

  private clear(context) {
    const onComplete = this._onComplete;
    this._active = false;
    this.ballPosition = null;
    this._sceneTeams = [];
    this._readyPlayer = null;
    this._onComplete = null;
    if (
      context != null &&
      context.camera != null &&
      context.camera.clearFocusTarget != null
    ) {
      context.camera.clearFocusTarget();
    }
    if (onComplete != null) onComplete(context);
  }
}
