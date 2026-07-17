import type { Vector2 } from "../math/vector";
import type {
  BoundaryEvent,
  GameContext,
  MatchState,
  RestartPhase,
  RestartRequest,
  RestartType,
  SimulationMode,
} from "../types";
import type { Ball } from "../world/ball";
import type { BoundaryDetector } from "../world/detectors/boundaryDetector";
import type { GoalDetector } from "../world/detectors/goalDetector";
import type { Player } from "../world/player";
import type { Team } from "../world/team";
import type {
  RestartBeginOptions,
  RestartController,
} from "./restarts/restartController";

export { MatchFlow };

interface OutOfPlaySession {
  event: BoundaryEvent;
  elapsed: number;
}

class MatchFlow {
  public readonly restartController: RestartController;
  public readonly goalDetector: GoalDetector;
  public readonly boundaryDetector: BoundaryDetector;
  private outOfPlay: OutOfPlaySession | null;
  public state: MatchState;
  public stateBeforePause: MatchState | null;

  public constructor(
    restartController: RestartController,
    goalDetector: GoalDetector,
    boundaryDetector: BoundaryDetector,
  ) {
    this.restartController = restartController;
    this.goalDetector = goalDetector;
    this.boundaryDetector = boundaryDetector;
    this.outOfPlay = null;
    this.state = "normalPlay";
    this.stateBeforePause = null;
  }

  public beginRestart(
    request: RestartRequest,
    context: GameContext,
    options: RestartBeginOptions | null = null,
  ): boolean {
    if (this.state == "paused" || this.state == "outOfPlay") return false;
    if (
      this.state == "restart" &&
      this.restartController.phase() == "positioning"
    )
      return false;
    return this.startRestart(request, context, options);
  }

  public pause(): void {
    if (this.state == "paused") return;
    this.stateBeforePause = this.state;
    this.state = "paused";
  }

  public resume(): void {
    if (this.state != "paused") return;
    this.state = this.stateBeforePause || "normalPlay";
    this.stateBeforePause = null;
  }

  public resumeFromInput(
    context: GameContext,
    direction: Vector2 | null,
  ): boolean {
    if (this.state == "restart") {
      return this.restartController.resumeFromInput(context, direction);
    }
    return this.state == "normalPlay";
  }

  public simulationMode(): SimulationMode {
    if (this.state == "paused") return "none";
    if (this.state == "normalPlay") return "full";
    if (this.state == "outOfPlay") return "ballOnly";
    return this.restartController.simulationMode();
  }

  public updateBeforePhysics(context: GameContext): void {
    if (this.state != "restart") return;
    this.restartController.updateBeforePhysics(context);
  }

  public updateAfterPhysics(context: GameContext, deltaSeconds: number): void {
    if (this.state == "outOfPlay") {
      this.updateOutOfPlay(context, deltaSeconds);
      return;
    }
    if (this.state != "restart") return;
    this.restartController.updateAfterPhysics(context, deltaSeconds);
    if (this.restartController.isComplete()) {
      this.state = "normalPlay";
      this.restartController.clear();
    }
  }

  public isPaused(): boolean {
    return this.state == "paused";
  }

  public isRestartActive(): boolean {
    return this.state == "restart";
  }

  public canResumeFromInput(): boolean {
    return (
      this.state == "restart" && this.restartController.canResumeFromInput()
    );
  }

  public canTeamMove(team: Team): boolean {
    return this.state != "restart" || this.restartController.canTeamMove(team);
  }

  public restartTaker(team: Team): Player | null {
    return this.state == "restart" ? this.restartController.taker(team) : null;
  }

  public restartPositioningTargets(team: Team): Vector2[] | null {
    return this.state == "restart"
      ? this.restartController.positioningTargets(team)
      : null;
  }

  public restartAttackTarget(team: Team): Vector2 | null {
    return this.state == "restart"
      ? this.restartController.attackTarget(team)
      : null;
  }

  public restartType(): RestartType | null {
    return this.restartController.type();
  }

  public restartPhase(): RestartPhase | null {
    return this.restartController.phase();
  }

  public isOutOfPlay(): boolean {
    return (
      this.state == "outOfPlay" ||
      (this.state == "paused" && this.stateBeforePause == "outOfPlay")
    );
  }

  public detectPostPhysicsEvents(context: GameContext): boolean {
    if (this.detectGoal(context)) return true;
    return this.detectOutOfPlay(context);
  }

  public detectGoal(context: GameContext): boolean {
    if (this.state != "normalPlay") return false;
    const scoredBy = this.goalDetector.update();
    if (scoredBy == null) return false;

    let scoringTeam = null;
    let concedingTeam = null;
    for (let i = 0; i < context.teams.length; i++) {
      if (context.teams[i].side == scoredBy) {
        scoringTeam = context.teams[i];
      } else {
        concedingTeam = context.teams[i];
      }
    }
    if (scoringTeam == null || concedingTeam == null) return false;

    scoringTeam.score++;
    return this.startRestart(
      { type: "kickoff", awardedTo: concedingTeam.side },
      context,
    );
  }

  public detectOutOfPlay(context: GameContext): boolean {
    if (this.state == "paused" || this.state == "outOfPlay") return false;
    const event = this.boundaryDetector.update();
    if (event == null) return false;
    if (event.lastTouchedBy == null) {
      this.restoreBall(context.ball, event.lastInBounds);
      this.boundaryDetector.reset();
      return false;
    }

    this.outOfPlay = { event: event, elapsed: 0 };
    this.stopPlayers(context.stadium.players);
    this.state = "outOfPlay";
    return true;
  }

  // Private helpers

  private startRestart(
    request: RestartRequest,
    context: GameContext,
    options: RestartBeginOptions | null = null,
  ): boolean {
    if (!this.restartController.begin(request, context, options)) return false;
    this.state = "restart";
    return true;
  }

  private restoreBall(ball: Ball, position: Vector2): void {
    ball.position.x = position.x;
    ball.position.y = position.y;
    ball.position.z = 0;
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    ball.velocity.z = 0;
  }

  private stopPlayers(players: Player[]): void {
    for (let i = 0; i < players.length; i++) {
      players[i].velocity.x = 0;
      players[i].velocity.y = 0;
    }
  }

  private updateOutOfPlay(context: GameContext, deltaSeconds: number): boolean {
    if (this.outOfPlay == null) return false;
    this.outOfPlay.elapsed += deltaSeconds || 0;
    if (this.outOfPlay.elapsed < context.config.restarts.outOfPlayDelaySeconds)
      return false;
    return this.beginOutOfPlayRestart(context);
  }

  private beginOutOfPlayRestart(context: GameContext): boolean {
    if (this.outOfPlay == null) return false;
    const event = this.outOfPlay.event;
    const request = this.restartRequestForBoundary(event);
    if (!this.startRestart(request, context)) return false;
    this.outOfPlay = null;
    return true;
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
    return {
      type: type,
      awardedTo: awardedTo,
      boundary: event.boundary,
      position: event.position,
    };
  }
}
