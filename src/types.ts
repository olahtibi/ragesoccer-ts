import type { Vector2 } from "./math/vector";
import type { Camera } from "./core/camera";
import type { Configuration } from "./core/configuration";
import type { HumanController } from "./input/humanController";
import type { Ball } from "./world/ball";
import type { Player } from "./world/player";
import type { Stadium } from "./world/stadium";
import type { Team } from "./world/team";

export type TeamSide = "home" | "away";
export const TEAM_SIDES = ["home", "away"] as const;
export type TeamSideMap<T> = Record<TeamSide, T>;
export type RestartType = "kickoff" | "throwIn" | "corner" | "goalKick";
export type RestartPhase =
  "celebrating" | "positioning" | "waitingForInput" | "inProgress" | "complete";
export type SimulationMode =
  "none" | "ballOnly" | "playersOnly" | "cutscene" | "full";
export type Boundary = "left" | "right" | "top" | "bottom";
export type TeamAiState =
  | "kickoffUs"
  | "kickoffOpponent"
  | "throwInUs"
  | "throwInOpponent"
  | "cornerUs"
  | "cornerOpponent"
  | "goalKickUs"
  | "goalKickOpponent"
  | "attack"
  | "defense";
export type IndividualCommandName =
  "inactive" | "moveToPosition" | "attackBall";

interface RestartRequestBase {
  awardedTo: TeamSide;
  positioningSeed?: number;
}

export interface KickoffRestartRequest extends RestartRequestBase {
  type: "kickoff";
}

export interface ThrowInRestartRequest extends RestartRequestBase {
  type: "throwIn";
  boundary: "left" | "right";
  position: Vector2;
}

export interface CornerRestartRequest extends RestartRequestBase {
  type: "corner";
  boundary: "top" | "bottom";
  position: Vector2;
}

export interface GoalKickRestartRequest extends RestartRequestBase {
  type: "goalKick";
  boundary: "top" | "bottom";
}

export type RestartRequest =
  | KickoffRestartRequest
  | ThrowInRestartRequest
  | CornerRestartRequest
  | GoalKickRestartRequest;

export interface BoundaryEvent {
  boundary: Boundary;
  position: Vector2;
  lastInBounds: Vector2;
  lastTouchedBy: TeamSide | null;
}

export interface DebugInputEvent {
  frame: number;
  type: "keydown" | "keyup" | "touch";
  keyCode?: number;
  target?: { x: number; y: number };
}

export interface GameContext {
  config: Configuration;
  stadium: Stadium;
  ball: Ball;
  teams: TeamSideMap<Team>;
  humanController: HumanController;
  camera: Camera;
}

export interface PlayerPlacement {
  player: Player;
  target: Vector2;
}

export type RestartPlacements = TeamSideMap<PlayerPlacement[]>;

export interface RestartScene {
  ballPosition: Vector2 & { z?: number };
  placements: RestartPlacements;
  readyPlayer: Player | null;
}

export interface PositioningOptions extends RestartScene {
  onComplete: (context: GameContext) => void;
}

export interface RestartStrategy {
  allowEarlyResume?: boolean;
  opponentAutoResumeAfterPositioning?: boolean;
  createScene(context: GameContext, request: RestartRequest): RestartScene;
  teamAiState(side: TeamSide, request: RestartRequest): TeamAiState;
  canTeamMove(side: TeamSide, request: RestartRequest): boolean;
  enforceRules(context: GameContext, request: RestartRequest): void;
  isComplete(context: GameContext, request: RestartRequest): boolean;
  onPositioned?(context: GameContext, request: RestartRequest): void;
  resume?(
    context: GameContext,
    request: RestartRequest,
    direction: Vector2 | null,
  ): boolean;
  attackTarget?(side: TeamSide, request: RestartRequest): Vector2 | null;
}
