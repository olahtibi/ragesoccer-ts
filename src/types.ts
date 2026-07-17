import type { Vector2, Vector3 } from "./math/vector";

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
  lastInBounds: Vector3;
  lastTouchedBy: TeamSide | null;
}

export interface DebugInputEvent {
  frame: number;
  type: "keydown" | "keyup" | "touch";
  keyCode?: number;
  target?: Vector2;
}
