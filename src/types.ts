import type { Vector2 } from "./math/vector";
import type { TeamAi } from "./ai/teamAi";
import type { Camera } from "./core/camera";
import type { Configuration } from "./core/configuration";
import type { HumanController } from "./input/humanController";
import type { Ball } from "./world/ball";
import type { Player } from "./world/player";
import type { Stadium } from "./world/stadium";
import type { Team } from "./world/team";

export type TeamSide = "home" | "away";
export type RestartType = "kickoff" | "throwIn" | "corner" | "goalKick";
export type MatchState = "normalPlay" | "outOfPlay" | "restart" | "paused";
export type RestartPhase =
  "positioning" | "waitingForInput" | "inProgress" | "complete";
export type SimulationMode = "none" | "ballOnly" | "playersOnly" | "full";
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

export interface RestartRequest {
  type: RestartType;
  awardedTo: TeamSide;
  boundary?: Boundary;
  position?: Vector2;
  positioningSeed?: number;
}

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
  teams: Team[];
  teamAis: TeamAi[];
  humanController: HumanController;
  camera: Camera;
}

export interface RestartSceneTeam {
  side: TeamSide;
  players: Player[];
  positions: Vector2[];
}

export interface RestartScene {
  ballPosition: Vector2 & { z?: number };
  sceneTeams: RestartSceneTeam[];
  readyPlayer: Player | null;
}

export interface PositioningOptions extends RestartScene {
  onComplete?: (context: GameContext) => void;
}

export interface RestartStrategy {
  allowEarlyResume?: boolean;
  opponentAutoResumeAfterPositioning?: boolean;
  createScene(context: GameContext, request: RestartRequest): RestartScene;
  teamAiState(team: Team, request: RestartRequest): TeamAiState;
  canTeamMove(team: Team, request: RestartRequest): boolean;
  enforceRules(context: GameContext, request: RestartRequest): void;
  isComplete(context: GameContext, request: RestartRequest): boolean;
  onPositioned?(context: GameContext, request: RestartRequest): void;
  resume?(
    context: GameContext,
    request: RestartRequest,
    direction: Vector2 | null,
  ): boolean;
  attackTarget?(team: Team, request: RestartRequest): Vector2 | null;
}
