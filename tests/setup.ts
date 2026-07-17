import { Formation } from "../src/ai/formation";
import { IndividualAi } from "../src/ai/individualAi";
import { Camera } from "../src/core/camera";
import { Configuration } from "../src/core/configuration";
import { DebugTool } from "../src/core/debugTool";
import { Game } from "../src/core/game";
import { CornerRestart } from "../src/core/restarts/cornerRestart";
import { GoalKickRestart } from "../src/core/restarts/goalKickRestart";
import { KickoffRestart } from "../src/core/restarts/kickoffRestart";
import { RestartRegistry } from "../src/core/restarts/restartRegistry";
import { ThrowInRestart } from "../src/core/restarts/throwInRestart";
import { BrowserInput } from "../src/input/io";
import { math } from "../src/math/math";
import { Vector2, Vector3 } from "../src/math/vector";
import { Player } from "../src/world/player";

Object.assign(globalThis, {
  BrowserInput,
  Camera,
  Configuration,
  CornerRestart,
  DebugTool,
  Formation,
  Game,
  GoalKickRestart,
  IndividualAi,
  KickoffRestart,
  MathLib: math,
  Player,
  RestartRegistry,
  ThrowInRestart,
  Vector2d: Vector2,
  Vector3d: Vector3,
});

Object.assign(window, { game: null, keyMap: {} });
