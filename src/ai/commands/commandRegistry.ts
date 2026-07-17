function createIndividualAiCommandRegistry() {
  return {
    inactive: new InactiveCommand(),
    moveToPosition: new MoveToPositionCommand(),
    attackBall: new AttackBallCommand(),
  };
}
import { AttackBallCommand } from "./attackBallCommand";
import { InactiveCommand } from "./inactiveCommand";
import { MoveToPositionCommand } from "./moveToPositionCommand";
export { createIndividualAiCommandRegistry };
