import type { IndividualCommandName } from "../../types";
import type { IndividualAiCommand } from "../individualAi";
import { AttackBallCommand } from "./attackBallCommand";
import { InactiveCommand } from "./inactiveCommand";
import { MoveToPositionCommand } from "./moveToPositionCommand";

export type IndividualAiCommandRegistry = Record<
  IndividualCommandName,
  IndividualAiCommand
>;

function createIndividualAiCommandRegistry(): IndividualAiCommandRegistry {
  return {
    inactive: new InactiveCommand(),
    moveToPosition: new MoveToPositionCommand(),
    attackBall: new AttackBallCommand(),
  };
}
export { createIndividualAiCommandRegistry };
