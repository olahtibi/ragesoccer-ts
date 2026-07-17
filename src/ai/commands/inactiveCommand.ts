import type { IndividualAi } from "../individualAi";

export { InactiveCommand };

class InactiveCommand {
  public state: "stopped";

  public constructor() {
    this.state = "stopped";
  }

  public update(ai: IndividualAi): void {
    this.state = "stopped";
    ai.tPos = null;
  }
}
