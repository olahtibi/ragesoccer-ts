import { math as MathLib } from "../../math/math";
export { GoalDetector };

class GoalDetector {
  [key: string]: any;
  public constructor(config, ball) {
    this._config = config;
    this._ball = ball;
    this._state = "start";
  }

  public update() {
    if (
      this._state == "start" &&
      MathLib.inside(
        this._config.pitch.goalTopTopLeft,
        this._config.pitch.goalTopBottomRight,
        this._ball.position,
      )
    ) {
      this._state = "goal";
      return "home";
    } else if (
      this._state == "start" &&
      MathLib.inside(
        this._config.pitch.goalBottomTopLeft,
        this._config.pitch.goalBottomBottomRight,
        this._ball.position,
      )
    ) {
      this._state = "goal";
      return "away";
    } else if (
      this._state == "goal" &&
      !MathLib.inside(
        this._config.pitch.goalTopTopLeft,
        this._config.pitch.goalTopBottomRight,
        this._ball.position,
      ) &&
      !MathLib.inside(
        this._config.pitch.goalBottomTopLeft,
        this._config.pitch.goalBottomBottomRight,
        this._ball.position,
      )
    ) {
      this._state = "start";
    }
    return null;
  }
}
