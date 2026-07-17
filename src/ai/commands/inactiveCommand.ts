export { InactiveCommand };

class InactiveCommand {
  [key: string]: any;
  public constructor() {
    this.state = "stopped";
  }

  public update(ai) {
    this.state = "stopped";
    ai.tPos = null;
  }
}
