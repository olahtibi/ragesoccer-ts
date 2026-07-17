export { RestartController };

class RestartController {
  [key: string]: any;
  public constructor(registry, positioningController) {
    this._registry = registry;
    this._positioningController = positioningController;
    this._session = null;
    this._restartSequence = 0;
  }

  public begin(request, context, options) {
    const strategy = request == null ? null : this._registry.get(request.type);
    if (strategy == null) return false;
    const positioningMode = options != null ? options.positioningMode : null;
    const isImmediate = positioningMode == "immediate";

    this._restartSequence++;
    request.positioningSeed = this._restartSequence;

    context.humanController.clearInput();
    context.ball.heldBy = null;
    this._session = {
      request: request,
      strategy: strategy,
      opponentReadyElapsed: 0,
      phase: "positioning",
    };
    this.assignTeamAiStates(context);

    const scene = strategy.createScene(context, request);
    this._session.taker = scene.readyPlayer || null;
    this._session.positioningTeams = scene.sceneTeams;
    if (isImmediate) {
      this.applySceneImmediately(context, scene);
      this.finishPositioning(context);
    } else {
      scene.onComplete = () => {
        this.finishPositioning(context);
      };
      if (!this._positioningController.play(scene)) {
        this._session = null;
        return false;
      }
    }
    return true;
  }

  private applySceneImmediately(context, scene) {
    context.ball.position.x = scene.ballPosition.x;
    context.ball.position.y = scene.ballPosition.y;
    context.ball.position.z = scene.ballPosition.z || 0;
    context.ball.velocity.x = 0;
    context.ball.velocity.y = 0;
    context.ball.velocity.z = 0;
    for (let t = 0; t < scene.sceneTeams.length; t++) {
      const sceneTeam = scene.sceneTeams[t];
      for (let i = 0; i < sceneTeam.players.length; i++) {
        sceneTeam.players[i].position.x = sceneTeam.positions[i].x;
        sceneTeam.players[i].position.y = sceneTeam.positions[i].y;
        sceneTeam.players[i].velocity.x = 0;
        sceneTeam.players[i].velocity.y = 0;
      }
    }
  }

  private finishPositioning(context) {
    if (this._session == null) return;
    this._session.phase = "waitingForInput";
    if (this._session.strategy.onPositioned != null) {
      this._session.strategy.onPositioned(context, this._session.request);
    }
    const humanTaker =
      this._session.taker != null && this._session.taker.teamSide == "home"
        ? this._session.taker
        : null;
    context.humanController.selectPlayer(humanTaker);
  }

  private assignTeamAiStates(context) {
    for (let i = 0; i < context.teamAis.length; i++) {
      const teamAi = context.teamAis[i];
      teamAi.setRestartState(
        this._session.strategy.teamAiState(teamAi.team, this._session.request),
      );
    }
  }

  private resume(context, direction) {
    if (!this.canResume()) return false;
    if (this._session.phase == "positioning") {
      this._positioningController.cancel(context);
      this.finishPositioning(context);
    }
    if (
      this._session.strategy.resume != null &&
      this._session.strategy.resume(
        context,
        this._session.request,
        direction,
      ) == false
    ) {
      return false;
    }
    this._session.phase = "inProgress";
    return true;
  }

  private canResume() {
    if (this._session == null) return false;
    if (this._session.phase == "waitingForInput") return true;
    return (
      this._session.phase == "positioning" &&
      this._session.strategy.allowEarlyResume == true &&
      this._positioningController.isReadyForInput()
    );
  }

  public canResumeFromInput() {
    return !this.isDelayedOpponentRestart() && this.canResume();
  }

  public resumeFromInput(context, direction) {
    if (!this.canResumeFromInput()) return false;
    return this.resume(context, direction);
  }

  public simulationMode() {
    if (this._session == null) return "full";
    if (this._session.phase == "positioning") return "playersOnly";
    if (this._session.phase == "inProgress") return "full";
    if (
      this._session.phase == "waitingForInput" &&
      this.isDelayedOpponentRestart()
    ) {
      return "playersOnly";
    }
    return "none";
  }

  private isDelayedOpponentRestart() {
    return (
      this._session != null &&
      this._session.request.awardedTo != "home" &&
      (this._session.strategy.allowEarlyResume == true ||
        this._session.strategy.opponentAutoResumeAfterPositioning == true)
    );
  }

  public canTeamMove(team) {
    if (this._session == null || this._session.phase != "inProgress")
      return false;
    return this._session.strategy.canTeamMove(team, this._session.request);
  }

  public attackTarget(team) {
    if (this._session == null || this._session.strategy.attackTarget == null)
      return null;
    return this._session.strategy.attackTarget(team, this._session.request);
  }

  public taker(team) {
    if (
      this._session == null ||
      this._session.taker == null ||
      this._session.taker.teamSide != team.side
    )
      return null;
    return this._session.taker;
  }

  public positioningTargets(team) {
    if (this._session == null || this._session.positioningTeams == null)
      return null;
    for (let i = 0; i < this._session.positioningTeams.length; i++) {
      if (this._session.positioningTeams[i].side == team.side) {
        return this._session.positioningTeams[i].positions;
      }
    }
    return null;
  }

  public updateBeforePhysics(context) {
    if (this._session != null && this._session.phase == "positioning") {
      this._positioningController.updateBeforePhysics(context);
    }
  }

  public updateAfterPhysics(context, deltaSeconds) {
    if (this._session == null) return;
    if (this._session.phase == "positioning") {
      this._positioningController.updateAfterPhysics(context);
      if (
        this._session.phase == "waitingForInput" &&
        this._session.strategy.opponentAutoResumeAfterPositioning == true
      ) {
        this._session.opponentReadyElapsed = 0;
        return;
      }
      this.resumeReadyRestart(context, deltaSeconds);
      return;
    }
    if (this._session.phase == "waitingForInput") {
      this.resumeReadyRestart(context, deltaSeconds);
      return;
    }
    if (this._session.phase != "inProgress") return;

    this._session.strategy.enforceRules(context, this._session.request);
    if (this._session.strategy.isComplete(context, this._session.request)) {
      this._session.phase = "complete";
    }
  }

  private resumeReadyRestart(context, deltaSeconds) {
    if (this._session == null) return false;
    if (this._session.request.awardedTo != "home") {
      const canAutoResume =
        this._session.strategy.allowEarlyResume == true ||
        this._session.strategy.opponentAutoResumeAfterPositioning == true;
      if (!canAutoResume) return false;
      if (
        this._session.strategy.opponentAutoResumeAfterPositioning == true &&
        this._session.phase == "positioning"
      ) {
        this._session.opponentReadyElapsed = 0;
        return false;
      }
      if (!this.canResume()) {
        this._session.opponentReadyElapsed = 0;
        return false;
      }
      this._session.opponentReadyElapsed += deltaSeconds || 0;
      const delay = Math.max(
        0,
        context.config.restarts.opponentDelaySeconds || 0,
      );
      if (this._session.opponentReadyElapsed < delay) return false;
      return this.resume(context, null);
    }
    if (this._session.strategy.allowEarlyResume != true) return false;
    if (!this.canResume()) return false;
    if (context.humanController.hasMovementInput()) {
      return this.resume(context, context.humanController.inputDirection());
    }
    return false;
  }

  public isComplete() {
    return this._session != null && this._session.phase == "complete";
  }

  public clear() {
    this._session = null;
  }

  public type() {
    return this._session == null ? null : this._session.request.type;
  }

  public phase() {
    return this._session == null ? null : this._session.phase;
  }
}
