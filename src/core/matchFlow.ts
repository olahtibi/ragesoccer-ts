import { Vector2 as Vector2d } from "../math/vector";
import type { Vector2 } from "../math/vector";
import { Formation } from "../ai/formation";
import type { TeamAiUpdateContext } from "../ai/teamAi";
import type {
  BoundaryEvent,
  GameContext,
  RestartPhase,
  RestartRequest,
  RestartType,
  SimulationMode,
  TeamSide,
} from "../types";
import type { Ball } from "../world/ball";
import type { BoundaryDetector } from "../world/detectors/boundaryDetector";
import type { GoalDetector } from "../world/detectors/goalDetector";
import type { Player } from "../world/player";
import type {
  RestartBeginOptions,
  RestartController,
} from "./restarts/restartController";

export { MatchFlow };

type ActiveMatchFlowSession =
  | { kind: "normalPlay" }
  | { kind: "outOfPlay"; event: BoundaryEvent; elapsed: number }
  | { kind: "restart" };

export type MatchFlowSession =
  ActiveMatchFlowSession | { kind: "paused"; previous: ActiveMatchFlowSession };

class MatchFlow {
  public readonly restartController: RestartController;
  public readonly goalDetector: GoalDetector;
  public readonly boundaryDetector: BoundaryDetector;
  private session: MatchFlowSession;

  public constructor(
    restartController: RestartController,
    goalDetector: GoalDetector,
    boundaryDetector: BoundaryDetector,
  ) {
    this.restartController = restartController;
    this.goalDetector = goalDetector;
    this.boundaryDetector = boundaryDetector;
    this.session = { kind: "normalPlay" };
  }

  public beginRestart(
    request: RestartRequest,
    context: GameContext,
    options: RestartBeginOptions | null = null,
  ): boolean {
    if (this.session.kind == "paused" || this.session.kind == "outOfPlay")
      return false;
    if (
      this.session.kind == "restart" &&
      this.restartController.phase() == "positioning"
    )
      return false;
    return this.startRestart(request, context, options);
  }

  public pause(): void {
    if (this.session.kind == "paused") return;
    this.session = { kind: "paused", previous: this.session };
  }

  public resume(): void {
    if (this.session.kind != "paused") return;
    this.session = this.session.previous;
  }

  public resumeFromInput(
    context: GameContext,
    direction: Vector2 | null,
  ): boolean {
    if (this.session.kind == "restart") {
      return this.restartController.resumeFromInput(context, direction);
    }
    return this.session.kind == "normalPlay";
  }

  public resumeFromKeyboardInput(
    context: GameContext,
    direction: Vector2,
  ): boolean {
    if (this.session.kind == "restart") {
      return this.restartController.resumeFromKeyboardInput(context, direction);
    }
    return this.session.kind == "normalPlay";
  }

  public simulationMode(): SimulationMode {
    if (this.session.kind == "paused") return "none";
    if (this.session.kind == "normalPlay") return "full";
    if (this.session.kind == "outOfPlay") return "ballOnly";
    return this.restartController.simulationMode();
  }

  public updateBeforePhysics(context: GameContext): void {
    if (this.session.kind != "restart") return;
    this.restartController.updateBeforePhysics(context);
  }

  public updateAfterPhysics(context: GameContext, deltaSeconds: number): void {
    if (this.session.kind == "outOfPlay") {
      this.updateOutOfPlay(context, deltaSeconds);
      return;
    }
    if (this.session.kind != "restart") return;
    this.restartController.updateAfterPhysics(context, deltaSeconds);
    if (this.restartController.isComplete()) {
      this.session = { kind: "normalPlay" };
      this.restartController.clear();
    }
  }

  public isPaused(): boolean {
    return this.session.kind == "paused";
  }

  public isRestartActive(): boolean {
    return this.session.kind == "restart";
  }

  public canResumeFromInput(): boolean {
    return (
      this.session.kind == "restart" &&
      this.restartController.canResumeFromInput()
    );
  }

  public canTeamMove(side: TeamSide): boolean {
    return (
      this.session.kind != "restart" || this.restartController.canTeamMove(side)
    );
  }

  public teamAiContext(side: TeamSide): TeamAiUpdateContext {
    if (this.session.kind != "restart") return { restart: null };
    const sequence = this.restartController.sequence();
    const state = this.restartController.teamAiState(side);
    if (sequence == null || state == null) return { restart: null };
    return {
      restart: {
        sequence: sequence,
        state: state,
        canMove: this.restartController.canTeamMove(side),
        taker: this.restartController.taker(side),
        positioningTargets: this.restartController.positioningTargets(side),
        attackTarget: this.restartController.attackTarget(side),
      },
    };
  }

  public restartType(): RestartType | null {
    return this.restartController.type();
  }

  public restartPhase(): RestartPhase | null {
    return this.restartController.phase();
  }

  public isOutOfPlay(): boolean {
    return (
      this.session.kind == "outOfPlay" ||
      (this.session.kind == "paused" &&
        this.session.previous.kind == "outOfPlay")
    );
  }

  public detectPostPhysicsEvents(context: GameContext): boolean {
    if (this.detectGoal(context)) return true;
    return this.detectOutOfPlay(context);
  }

  public detectGoal(context: GameContext): boolean {
    if (this.session.kind != "normalPlay") return false;
    const scoredBy = this.goalDetector.update();
    if (scoredBy == null) return false;

    const scoringTeam = context.teams[scoredBy];
    const concedingSide = scoredBy == "home" ? "away" : "home";
    const concedingTeam = context.teams[concedingSide];
    const scorer = this.goalScorer(context, scoredBy);
    const goalFocusTarget = this.goalFocusTarget(context, scoredBy);

    scoringTeam.score++;
    return this.startRestart(
      { type: "kickoff", awardedTo: concedingTeam.side },
      context,
      {
        goalCelebration: { scoringSide: scoredBy, scorer, goalFocusTarget },
      },
    );
  }

  public detectOutOfPlay(context: GameContext): boolean {
    if (this.session.kind == "paused" || this.session.kind == "outOfPlay")
      return false;
    const event = this.boundaryDetector.update();
    if (event == null) return false;
    if (event.lastTouchedBy == null) {
      this.restoreBall(context.ball, event.lastInBounds);
      this.boundaryDetector.reset();
      return false;
    }

    this.session = { kind: "outOfPlay", event, elapsed: 0 };
    this.stopPlayers(context.stadium.players);
    return true;
  }

  // Private helpers

  private startRestart(
    request: RestartRequest,
    context: GameContext,
    options: RestartBeginOptions | null = null,
  ): boolean {
    if (!this.restartController.begin(request, context, options)) return false;
    this.session = { kind: "restart" };
    return true;
  }

  private restoreBall(ball: Ball, position: Vector2): void {
    ball.placeAt(position);
  }

  private stopPlayers(players: Player[]): void {
    for (let i = 0; i < players.length; i++) {
      players[i].stop();
    }
  }

  private goalScorer(context: GameContext, scoredBy: TeamSide): Player {
    const lastTouchedPlayer = context.ball.lastTouchedPlayer;
    if (lastTouchedPlayer != null && lastTouchedPlayer.teamSide == scoredBy) {
      return lastTouchedPlayer;
    }
    const team = context.teams[scoredBy];
    const strikerIndex = new Formation(context.config).kickoffTakerIndex(
      team.players.length,
    );
    return team.players[strikerIndex];
  }

  private goalFocusTarget(context: GameContext, scoredBy: TeamSide): Vector2 {
    const pitch = context.config.pitch;
    const topLeft =
      scoredBy == "home" ? pitch.goalTopTopLeft : pitch.goalBottomTopLeft;
    const bottomRight =
      scoredBy == "home"
        ? pitch.goalTopBottomRight
        : pitch.goalBottomBottomRight;
    return new Vector2d(
      (topLeft.x + bottomRight.x) / 2,
      (topLeft.y + bottomRight.y) / 2,
    );
  }

  private updateOutOfPlay(context: GameContext, deltaSeconds: number): boolean {
    if (this.session.kind != "outOfPlay") return false;
    this.session.elapsed += deltaSeconds;
    if (this.session.elapsed < context.config.restarts.outOfPlayDelaySeconds)
      return false;
    return this.beginOutOfPlayRestart(context);
  }

  private beginOutOfPlayRestart(context: GameContext): boolean {
    if (this.session.kind != "outOfPlay") return false;
    const event = this.session.event;
    const request = this.restartRequestForBoundary(event);
    if (!this.startRestart(request, context)) return false;
    return true;
  }

  public enterNormalPlayForTesting(): void {
    this.restartController.clear();
    this.session = { kind: "normalPlay" };
  }

  public snapshot(): MatchFlowSession {
    return this.session;
  }

  private restartRequestForBoundary(event: BoundaryEvent): RestartRequest {
    let awardedTo: RestartRequest["awardedTo"];
    let type: RestartType;
    if (event.boundary == "left" || event.boundary == "right") {
      type = "throwIn";
      awardedTo = event.lastTouchedBy == "home" ? "away" : "home";
    } else {
      const defendingSide = event.boundary == "top" ? "away" : "home";
      const attackingSide = defendingSide == "home" ? "away" : "home";
      if (event.lastTouchedBy == attackingSide) {
        type = "goalKick";
        awardedTo = defendingSide;
      } else {
        type = "corner";
        awardedTo = attackingSide;
      }
    }
    if (type == "throwIn") {
      if (event.boundary != "left" && event.boundary != "right") {
        throw new Error("Throw-in requires a touchline boundary");
      }
      return {
        type,
        awardedTo,
        boundary: event.boundary,
        position: event.position,
      };
    }
    if (event.boundary != "top" && event.boundary != "bottom") {
      throw new Error("Goal-line restart requires a goal-line boundary");
    }
    return type == "corner"
      ? {
          type,
          awardedTo,
          boundary: event.boundary,
          position: event.position,
        }
      : { type, awardedTo, boundary: event.boundary };
  }
}
