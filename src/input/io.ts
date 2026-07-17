import { Vector2 as Vector2d } from "../math/vector";
import type { Boundary, RestartType, TeamSide } from "../types";
import type { Game } from "../core/game";
export { BrowserInput };

const KEY = {
  debugCorner: 67,
  fps: 70,
  pauseAndDump: 191,
  viewportSmaller: 81,
  viewportLarger: 87,
};

class BrowserInput {
  public readonly game: Game;
  public readonly eventTarget: Window;
  private readonly boundKeyHandler: (event: KeyboardEvent) => void;
  private readonly boundTouchHandler: (event: TouchEvent) => void;

  public constructor(game: Game, eventTarget: Window) {
    this.game = game;
    this.eventTarget = eventTarget;
    this.boundKeyHandler = this.handleKey.bind(this);
    this.boundTouchHandler = this.handleTouch.bind(this);
  }

  public attach(): void {
    this.eventTarget.addEventListener("keydown", this.boundKeyHandler, false);
    this.eventTarget.addEventListener("keyup", this.boundKeyHandler, false);
    this.eventTarget.addEventListener(
      "touchstart",
      this.boundTouchHandler,
      false,
    );
  }

  public handleTouch(event: TouchEvent): void {
    if (
      (this.game.matchFlow.simulationMode() == "playersOnly" &&
        !this.game.matchFlow.canResumeFromInput()) ||
      this.game.isPaused() ||
      this.game.matchFlow.isOutOfPlay()
    )
      return;
    const scaleBy = this.game.config.computeScaleBy();
    const target = new Vector2d(
      -this.game.camera.position.x + event.touches[0].clientX / scaleBy,
      -this.game.camera.position.y + event.touches[0].clientY / scaleBy,
    );
    this.game.debugTool.recordTouchEvent(target);
    this.game.humanController.selectPlayer();
    this.game.humanController.setTouchTarget(target);
    this.game.resumeFromInput(
      new Vector2d(
        target.x - this.game.stadium.ball.position.x,
        target.y - this.game.stadium.ball.position.y,
      ),
    );
    this.applyHumanInput();
  }

  public handleKey(event: Pick<KeyboardEvent, "keyCode" | "type">): void {
    this.game.debugTool.recordKeyEvent(event);
    this.game.humanController.setKey(event.keyCode, event.type == "keydown");
    if (event.type == "keydown") this.handleCommand(event.keyCode);
    if (this.game.humanController.hasMovementInput()) {
      this.game.resumeFromInput(this.game.humanController.inputDirection());
    }
    this.applyHumanInput();
  }

  public applyHumanInput(): void {
    if (
      this.game.isPaused() ||
      this.game.matchFlow.simulationMode() == "playersOnly" ||
      this.game.matchFlow.isOutOfPlay()
    )
      return;
    this.game.humanController.selectPlayer();
    const canMove = this.game.matchFlow.canTeamMove(this.game.teams[0]);
    this.game.humanController.update(canMove);
  }

  public handleCommand(keyCode: number): void {
    if (keyCode == KEY.fps)
      this.game.camera.showStats = !this.game.camera.showStats;
    if (keyCode == KEY.viewportSmaller) this.game.config.viewport.ratio /= 1.2;
    if (keyCode == KEY.viewportLarger) this.game.config.viewport.ratio *= 1.2;
    if (
      keyCode == KEY.debugCorner &&
      this.game.config.debug.enabled == true &&
      !this.game.matchFlow.isOutOfPlay()
    ) {
      const cornerX =
        this.game.stadium.ball.position.x <=
        this.game.config.pitch.initialBallPosition.x
          ? this.game.config.pitch.fieldLeft
          : this.game.config.pitch.fieldRight;
      this.game.beginRestart("corner" as RestartType, "home" as TeamSide, {
        boundary: "top" as Boundary,
        position: new Vector2d(cornerX, this.game.config.pitch.fieldTop),
      });
    }
    if (keyCode == KEY.pauseAndDump && this.game.config.debug.enabled == true) {
      this.game.togglePause();
      this.game.debugTool.dump();
    }
  }
}
