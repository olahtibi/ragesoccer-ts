import type { Formation as FormationType } from "../src/ai/formation";
import type { IndividualAi as IndividualAiType } from "../src/ai/individualAi";
import type { Camera as CameraType } from "../src/core/camera";
import type { Configuration as ConfigurationType } from "../src/core/configuration";
import type { DebugTool as DebugToolType } from "../src/core/debugTool";
import type { Game as GameType } from "../src/core/game";
import type { CornerRestart as CornerRestartType } from "../src/core/restarts/cornerRestart";
import type { GoalKickRestart as GoalKickRestartType } from "../src/core/restarts/goalKickRestart";
import type { KickoffRestart as KickoffRestartType } from "../src/core/restarts/kickoffRestart";
import type { RestartRegistry as RestartRegistryType } from "../src/core/restarts/restartRegistry";
import type { ThrowInRestart as ThrowInRestartType } from "../src/core/restarts/throwInRestart";
import type { BrowserInput as BrowserInputType } from "../src/input/io";
import type { math as MathType } from "../src/math/math";
import type { Vector2, Vector3 } from "../src/math/vector";
import type { Player as PlayerType } from "../src/world/player";

declare global {
  const BrowserInput: typeof BrowserInputType;
  const Camera: typeof CameraType;
  const Configuration: typeof ConfigurationType;
  const CornerRestart: typeof CornerRestartType;
  const DebugTool: typeof DebugToolType;
  const Formation: typeof FormationType;
  const Game: typeof GameType;
  const GoalKickRestart: typeof GoalKickRestartType;
  const IndividualAi: typeof IndividualAiType;
  const KickoffRestart: typeof KickoffRestartType;
  const MathLib: typeof MathType;
  const Player: typeof PlayerType;
  const RestartRegistry: typeof RestartRegistryType;
  const ThrowInRestart: typeof ThrowInRestartType;
  const Vector2d: typeof Vector2;
  const Vector3d: typeof Vector3;

  interface Window {
    game: any;
    ctx: any;
    keyMap: Record<number, boolean>;
    input: any;
  }
}

export {};
