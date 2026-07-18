import type { Vector2 } from "../../math/vector";
import type {
  GameContext,
  RestartPhase,
  RestartRequest,
  RestartScene,
  RestartPlacements,
  RestartStrategy,
  RestartType,
  SimulationMode,
  TeamAiState,
  TeamSide,
} from "../../types";
import type { Player } from "../../world/player";
import type { PositioningController } from "./positioningController";
import type { RestartRegistry } from "./restartRegistry";

export { RestartController };

export interface RestartBeginOptions {
  positioningMode?: "immediate";
}

interface RestartSession {
  sequence: number;
  request: RestartRequest;
  strategy: RestartStrategy;
  opponentReadyElapsed: number;
  phase: RestartPhase;
  taker: Player | null;
  placements: RestartPlacements;
}

class RestartController {
  private readonly registry: RestartRegistry;
  public readonly positioningController: PositioningController;
  private session: RestartSession | null;
  private restartSequence: number;

  public constructor(
    registry: RestartRegistry,
    positioningController: PositioningController,
  ) {
    this.registry = registry;
    this.positioningController = positioningController;
    this.session = null;
    this.restartSequence = 0;
  }

  public begin(
    request: RestartRequest,
    context: GameContext,
    options: RestartBeginOptions | null = null,
  ): boolean {
    const strategy = this.registry.get(request.type);
    if (strategy == null) return false;
    const positioningMode = options != null ? options.positioningMode : null;
    const isImmediate = positioningMode == "immediate";

    this.restartSequence++;
    const sessionRequest: RestartRequest = {
      ...request,
      positioningSeed: this.restartSequence,
    };

    context.humanController.clearInput();
    context.ball.heldBy = null;
    const scene = strategy.createScene(context, sessionRequest);
    this.session = {
      sequence: this.restartSequence,
      request: sessionRequest,
      strategy: strategy,
      opponentReadyElapsed: 0,
      phase: "positioning",
      taker: scene.readyPlayer,
      placements: scene.placements,
    };
    if (isImmediate) {
      this.applySceneImmediately(context, scene);
      this.finishPositioning(context);
    } else {
      this.positioningController.play({
        ...scene,
        onComplete: () => {
          this.finishPositioning(context);
        },
      });
    }
    return true;
  }

  private applySceneImmediately(
    context: GameContext,
    scene: RestartScene,
  ): void {
    context.ball.placeAt(scene.ballPosition);
    for (const side of ["home", "away"] as const) {
      for (const placement of scene.placements[side]) {
        placement.player.placeAt(placement.target);
      }
    }
  }

  private finishPositioning(context: GameContext): void {
    if (this.session == null) return;
    this.session.phase = "waitingForInput";
    if (this.session.strategy.onPositioned != null) {
      this.session.strategy.onPositioned(context, this.session.request);
    }
    const humanTaker =
      this.session.taker != null && this.session.taker.teamSide == "home"
        ? this.session.taker
        : null;
    context.humanController.selectPlayer(humanTaker);
  }

  private resume(context: GameContext, direction: Vector2 | null): boolean {
    if (this.session == null) return false;
    if (!this.canResume()) return false;
    if (this.session.phase == "positioning") {
      this.positioningController.cancel(context);
      this.finishPositioning(context);
    }
    if (
      this.session.strategy.resume != null &&
      this.session.strategy.resume(context, this.session.request, direction) ==
        false
    ) {
      return false;
    }
    this.session.phase = "inProgress";
    return true;
  }

  private canResume(): boolean {
    if (this.session == null) return false;
    if (this.session.phase == "waitingForInput") return true;
    return (
      this.session.phase == "positioning" &&
      this.session.strategy.allowEarlyResume == true &&
      this.positioningController.isReadyForInput()
    );
  }

  public canResumeFromInput(): boolean {
    return !this.isDelayedOpponentRestart() && this.canResume();
  }

  public resumeFromInput(
    context: GameContext,
    direction: Vector2 | null,
  ): boolean {
    if (!this.canResumeFromInput()) return false;
    return this.resume(context, direction);
  }

  public simulationMode(): SimulationMode {
    if (this.session == null) return "full";
    if (this.session.phase == "positioning") return "playersOnly";
    if (this.session.phase == "inProgress") return "full";
    if (
      this.session.phase == "waitingForInput" &&
      this.isDelayedOpponentRestart()
    ) {
      return "playersOnly";
    }
    return "none";
  }

  private isDelayedOpponentRestart(): boolean {
    return (
      this.session != null &&
      this.session.request.awardedTo != "home" &&
      (this.session.strategy.allowEarlyResume == true ||
        this.session.strategy.opponentAutoResumeAfterPositioning == true)
    );
  }

  public sequence(): number | null {
    return this.session != null ? this.session.sequence : null;
  }

  public teamAiState(side: TeamSide): TeamAiState | null {
    if (this.session == null) return null;
    return this.session.strategy.teamAiState(side, this.session.request);
  }

  public canTeamMove(side: TeamSide): boolean {
    if (this.session == null || this.session.phase != "inProgress")
      return false;
    return this.session.strategy.canTeamMove(side, this.session.request);
  }

  public attackTarget(side: TeamSide): Vector2 | null {
    if (this.session == null || this.session.strategy.attackTarget == null)
      return null;
    return this.session.strategy.attackTarget(side, this.session.request);
  }

  public taker(side: TeamSide): Player | null {
    if (
      this.session == null ||
      this.session.taker == null ||
      this.session.taker.teamSide != side
    )
      return null;
    return this.session.taker;
  }

  public positioningTargets(side: TeamSide): Vector2[] | null {
    if (this.session == null) return null;
    return this.session.placements[side].map((placement) => placement.target);
  }

  public updateBeforePhysics(context: GameContext): void {
    if (this.session != null && this.session.phase == "positioning") {
      this.positioningController.updateBeforePhysics(context);
    }
  }

  public updateAfterPhysics(context: GameContext, deltaSeconds: number): void {
    if (this.session == null) return;
    if (this.session.phase == "positioning") {
      this.positioningController.updateAfterPhysics(context);
      if (
        this.phase() == "waitingForInput" &&
        this.session.strategy.opponentAutoResumeAfterPositioning == true
      ) {
        this.session.opponentReadyElapsed = 0;
        return;
      }
      this.resumeReadyRestart(context, deltaSeconds);
      return;
    }
    if (this.session.phase == "waitingForInput") {
      this.resumeReadyRestart(context, deltaSeconds);
      return;
    }
    if (this.session.phase != "inProgress") return;

    this.session.strategy.enforceRules(context, this.session.request);
    if (this.session.strategy.isComplete(context, this.session.request)) {
      this.session.phase = "complete";
    }
  }

  private resumeReadyRestart(
    context: GameContext,
    deltaSeconds: number,
  ): boolean {
    if (this.session == null) return false;
    if (this.session.request.awardedTo != "home") {
      const canAutoResume =
        this.session.strategy.allowEarlyResume == true ||
        this.session.strategy.opponentAutoResumeAfterPositioning == true;
      if (!canAutoResume) return false;
      if (
        this.session.strategy.opponentAutoResumeAfterPositioning == true &&
        this.session.phase == "positioning"
      ) {
        this.session.opponentReadyElapsed = 0;
        return false;
      }
      if (!this.canResume()) {
        this.session.opponentReadyElapsed = 0;
        return false;
      }
      this.session.opponentReadyElapsed += deltaSeconds;
      const delay = Math.max(0, context.config.restarts.opponentDelaySeconds);
      if (this.session.opponentReadyElapsed < delay) return false;
      return this.resume(context, null);
    }
    if (this.session.strategy.allowEarlyResume != true) return false;
    if (!this.canResume()) return false;
    if (context.humanController.hasMovementInput()) {
      return this.resume(context, context.humanController.inputDirection());
    }
    return false;
  }

  public isComplete(): boolean {
    return this.session != null && this.session.phase == "complete";
  }

  public clear(): void {
    this.session = null;
  }

  public type(): RestartType | null {
    return this.session == null ? null : this.session.request.type;
  }

  public phase(): RestartPhase | null {
    return this.session == null ? null : this.session.phase;
  }
}
