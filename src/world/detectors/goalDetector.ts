import { math as MathLib } from "../../math/math";
import type { Configuration } from "../../core/configuration";
import type { TeamSide } from "../../types";
import type { Ball } from "../ball";
export { GoalDetector };

class GoalDetector {
  private readonly config: Configuration;
  private readonly ball: Ball;
  private state: "start" | "goal";

  public constructor(config: Configuration, ball: Ball) {
    this.config = config;
    this.ball = ball;
    this.state = "start";
  }

  public update(): TeamSide | null {
    if (
      this.state == "start" &&
      MathLib.inside(
        this.config.pitch.goalTopTopLeft,
        this.config.pitch.goalTopBottomRight,
        this.ball.position,
      )
    ) {
      this.state = "goal";
      return "home";
    } else if (
      this.state == "start" &&
      MathLib.inside(
        this.config.pitch.goalBottomTopLeft,
        this.config.pitch.goalBottomBottomRight,
        this.ball.position,
      )
    ) {
      this.state = "goal";
      return "away";
    } else if (
      this.state == "goal" &&
      !MathLib.inside(
        this.config.pitch.goalTopTopLeft,
        this.config.pitch.goalTopBottomRight,
        this.ball.position,
      ) &&
      !MathLib.inside(
        this.config.pitch.goalBottomTopLeft,
        this.config.pitch.goalBottomBottomRight,
        this.ball.position,
      )
    ) {
      this.state = "start";
    }
    return null;
  }
}
