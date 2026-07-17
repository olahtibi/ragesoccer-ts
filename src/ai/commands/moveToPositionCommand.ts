import type { IndividualAi } from "../individualAi";

export { MoveToPositionCommand };

class MoveToPositionCommand {
  public state: "stopped" | "moving";

  public constructor() {
    this.state = "stopped";
  }

  public reset(): void {
    this.state = "stopped";
  }

  public update(ai: IndividualAi): void {
    if (ai.target == null) {
      this.state = ai.stop();
      return;
    }

    this.state = ai.moveToFormationPosition(ai.target, this.state == "stopped");
  }
}
