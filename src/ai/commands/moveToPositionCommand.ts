export { MoveToPositionCommand };

class MoveToPositionCommand {
  [key: string]: any;
  public constructor() {
    this.state = "stopped";
  }

  public reset() {
    this.state = "stopped";
  }

  public update(ai) {
    if (ai.target == null) {
      this.state = ai.stop();
      return;
    }

    this.state = ai.moveToFormationPosition(ai.target, this.state == "stopped");
  }
}
