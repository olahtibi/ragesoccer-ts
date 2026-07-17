export { MatchFlow };

class MatchFlow {
  [key: string]: any;
  public constructor(restartController, goalDetector, boundaryDetector) {
    this._restartController = restartController;
    this._goalDetector = goalDetector;
    this._boundaryDetector = boundaryDetector;
    this._outOfPlay = null;
    this.state = "normalPlay";
    this.stateBeforePause = null;
  }

  public beginRestart(request, context, options) {
    if (this.state == "paused" || this.state == "outOfPlay") return false;
    if (
      this.state == "restart" &&
      this._restartController.phase() == "positioning"
    )
      return false;
    return this.startRestart(request, context, options);
  }

  public pause() {
    if (this.state == "paused") return;
    this.stateBeforePause = this.state;
    this.state = "paused";
  }

  public resume() {
    if (this.state != "paused") return;
    this.state = this.stateBeforePause || "normalPlay";
    this.stateBeforePause = null;
  }

  public resumeFromInput(context, direction) {
    if (this.state == "restart") {
      return this._restartController.resumeFromInput(context, direction);
    }
    return this.state == "normalPlay";
  }

  public simulationMode() {
    if (this.state == "paused") return "none";
    if (this.state == "normalPlay") return "full";
    if (this.state == "outOfPlay") return "ballOnly";
    return this._restartController.simulationMode();
  }

  public updateBeforePhysics(context) {
    if (this.state != "restart") return;
    this._restartController.updateBeforePhysics(context);
  }

  public updateAfterPhysics(context, deltaSeconds) {
    if (this.state == "outOfPlay") {
      this.updateOutOfPlay(context, deltaSeconds);
      return;
    }
    if (this.state != "restart") return;
    this._restartController.updateAfterPhysics(context, deltaSeconds);
    if (this._restartController.isComplete()) {
      this.state = "normalPlay";
      this._restartController.clear();
    }
  }

  public isPaused() {
    return this.state == "paused";
  }

  public isRestartActive() {
    return this.state == "restart";
  }

  public canResumeFromInput() {
    return (
      this.state == "restart" && this._restartController.canResumeFromInput()
    );
  }

  public canTeamMove(team) {
    return this.state != "restart" || this._restartController.canTeamMove(team);
  }

  public restartTaker(team) {
    return this.state == "restart" ? this._restartController.taker(team) : null;
  }

  public restartPositioningTargets(team) {
    return this.state == "restart"
      ? this._restartController.positioningTargets(team)
      : null;
  }

  public restartAttackTarget(team) {
    return this.state == "restart"
      ? this._restartController.attackTarget(team)
      : null;
  }

  public restartType() {
    return this._restartController.type();
  }

  public restartPhase() {
    return this._restartController.phase();
  }

  public isOutOfPlay() {
    return (
      this.state == "outOfPlay" ||
      (this.state == "paused" && this.stateBeforePause == "outOfPlay")
    );
  }

  public detectPostPhysicsEvents(context) {
    if (this.detectGoal(context)) return true;
    return this.detectOutOfPlay(context);
  }

  public detectGoal(context) {
    if (this.state != "normalPlay") return false;
    const scoredBy = this._goalDetector.update();
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

  public detectOutOfPlay(context) {
    if (this.state == "paused" || this.state == "outOfPlay") return false;
    const event = this._boundaryDetector.update();
    if (event == null) return false;
    if (event.lastTouchedBy == null) {
      this.restoreBall(context.ball, event.lastInBounds);
      this._boundaryDetector.reset();
      return false;
    }

    this._outOfPlay = { event: event, elapsed: 0 };
    this.stopPlayers(context.stadium.players);
    this.state = "outOfPlay";
    return true;
  }

  // Private helpers

  private startRestart(request, context, options = null) {
    if (!this._restartController.begin(request, context, options)) return false;
    this.state = "restart";
    return true;
  }

  private restoreBall(ball, position) {
    ball.position.x = position.x;
    ball.position.y = position.y;
    ball.position.z = 0;
    ball.velocity.x = 0;
    ball.velocity.y = 0;
    ball.velocity.z = 0;
  }

  private stopPlayers(players) {
    for (let i = 0; i < players.length; i++) {
      players[i].velocity.x = 0;
      players[i].velocity.y = 0;
    }
  }

  private updateOutOfPlay(context, deltaSeconds) {
    if (this._outOfPlay == null) return false;
    this._outOfPlay.elapsed += deltaSeconds || 0;
    if (this._outOfPlay.elapsed < context.config.restarts.outOfPlayDelaySeconds)
      return false;
    return this.beginOutOfPlayRestart(context);
  }

  private beginOutOfPlayRestart(context) {
    const event = this._outOfPlay.event;
    const request = this.restartRequestForBoundary(event);
    if (!this.startRestart(request, context)) return false;
    this._outOfPlay = null;
    return true;
  }

  private restartRequestForBoundary(event) {
    let awardedTo;
    let type;
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
