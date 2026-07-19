import { math as MathLib } from "../../math/math";
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
  goalCelebration?: {
    scoringSide: TeamSide;
    scorer: Player;
    goalFocusTarget: Vector2;
  };
}

interface GoalCelebrationSession {
  scoringSide: TeamSide;
  scorer: Player;
  goalFocusTarget: Vector2;
  elapsed: number;
}

interface RestartSession {
  sequence: number;
  request: RestartRequest;
  strategy: RestartStrategy;
  opponentReadyElapsed: number;
  phase: RestartPhase;
  taker: Player | null;
  placements: RestartPlacements;
  scene: RestartScene;
  celebration: GoalCelebrationSession | null;
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
    const celebrationOptions = options?.goalCelebration ?? null;

    this.restartSequence++;
    const sessionRequest: RestartRequest = {
      ...request,
      positioningSeed: this.restartSequence,
    };

    context.humanController.clearInput();
    context.ball.heldBy = null;
    const scene = strategy.createScene(context, sessionRequest);
    const celebration =
      celebrationOptions == null
        ? null
        : {
            ...celebrationOptions,
            elapsed: 0,
          };
    this.session = {
      sequence: this.restartSequence,
      request: sessionRequest,
      strategy: strategy,
      opponentReadyElapsed: 0,
      phase: celebration == null ? "positioning" : "celebrating",
      taker: scene.readyPlayer,
      placements: scene.placements,
      scene,
      celebration,
    };
    context.ball.lastTouchedPlayer = null;
    if (celebration != null) {
      this.stopPlayers(context);
      this.updateCelebration(context);
    } else if (isImmediate) {
      this.applySceneImmediately(context, scene);
      this.finishPositioning(context);
    } else {
      this.startPositioning(context);
    }
    return true;
  }

  private startPositioning(context: GameContext): void {
    if (this.session == null) return;
    this.session.phase = "positioning";
    this.session.celebration = null;
    context.camera.setFocusTarget(this.session.scene.ballPosition);
    this.positioningController.play({
      ...this.session.scene,
      onComplete: () => {
        this.finishPositioning(context);
      },
    });
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
    if (
      this.session.phase == "celebrating" ||
      this.session.phase == "positioning"
    )
      return this.session.phase == "celebrating" ? "cutscene" : "playersOnly";
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
    if (this.session?.phase == "celebrating") {
      this.updateCelebration(context);
    } else if (this.session != null && this.session.phase == "positioning") {
      this.positioningController.updateBeforePhysics(context);
    }
  }

  public updateAfterPhysics(context: GameContext, deltaSeconds: number): void {
    if (this.session == null) return;
    if (this.session.phase == "celebrating") {
      this.updateCelebration(context);
      const celebration = this.session.celebration;
      if (celebration == null) return;
      celebration.elapsed += deltaSeconds;
      const duration = Math.max(
        0,
        context.config.cutscene.goalCelebrationSeconds,
      );
      if (celebration.elapsed >= duration) {
        this.startPositioning(context);
      } else {
        this.updateCelebration(context);
      }
      return;
    }
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

  private updateCelebration(context: GameContext): void {
    if (this.session?.celebration == null) return;
    const celebration = this.session.celebration;
    const goalFocusSeconds = Math.max(
      0,
      context.config.cutscene.goalFocusSeconds,
    );
    context.camera.setFocusTarget(
      celebration.elapsed < goalFocusSeconds
        ? celebration.goalFocusTarget
        : celebration.scorer.position,
    );
    for (const placement of this.session.placements[celebration.scoringSide]) {
      this.movePlayerToTarget(context, placement.player, placement.target);
    }
  }

  private movePlayerToTarget(
    context: GameContext,
    player: Player,
    target: Vector2,
  ): void {
    const distance = MathLib.computeDistance(player.position, target);
    const dx = target.x - player.position.x;
    const dy = target.y - player.position.y;
    const movingAway =
      player.velocity.x * dx + player.velocity.y * dy <= 0 &&
      (player.velocity.x != 0 || player.velocity.y != 0);
    if (distance <= context.config.cutscene.arrivedRadius || movingAway) {
      player.placeAt(target);
      return;
    }
    player.velocity = MathLib.velocityTowards(
      player.position,
      target,
      context.config.teamVelocity(player.teamSide),
    );
  }

  private stopPlayers(context: GameContext): void {
    for (const player of context.stadium.players) player.stop();
  }
}
