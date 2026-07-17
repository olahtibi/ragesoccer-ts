export { DebugTool };

class DebugTool {
  [key: string]: any;
  public constructor(config) {
    this.config = config;
    this.snapshots = [];
    this.events = [];
    this.frame = 0;
    this.startTimeMs = null;
  }

  public record(game) {
    if (!this.config.debug.enabled) {
      return;
    }

    const everyNFrames = this.config.debug.logEveryNFrames || 1;
    const frame = this.frame;
    this.frame++;

    if (frame % everyNFrames !== 0) {
      return;
    }

    const snapshot = this.snapshot(game, frame, this.currentTimeSeconds());
    this.snapshots.push(snapshot);
    this.trim(snapshot.time);
  }

  public recordKeyEvent(e) {
    if (!this.config.debug.enabled) {
      return;
    }

    const event = {
      time: this.round(this.currentTimeSeconds()),
      frame: this.frame,
      type: e.type,
      keyCode: e.keyCode,
    };
    this.events.push(event);
    this.trim(event.time);
  }

  public recordTouchEvent(target) {
    if (!this.config.debug.enabled) {
      return;
    }

    const event = {
      time: this.round(this.currentTimeSeconds()),
      frame: this.frame,
      type: "touch",
      target: this.vectorSnapshot(target),
    };
    this.events.push(event);
    this.trim(event.time);
  }

  public dump() {
    if (!this.config.debug.enabled) {
      return;
    }

    console.log(
      JSON.stringify({
        type: "debugLog",
        frames: this.snapshots,
        events: this.events,
      }),
    );
  }

  private trim(currentTime) {
    const seconds = this.config.debug.logSeconds;
    if (seconds == null || seconds < 0) {
      return;
    }

    const minTime = currentTime - seconds;
    while (this.snapshots.length > 0 && this.snapshots[0].time < minTime) {
      this.snapshots.shift();
    }
    while (this.events.length > 0 && this.events[0].time < minTime) {
      this.events.shift();
    }
  }

  private snapshot(game, frame, time) {
    return {
      frame: frame,
      time: this.round(time),
      dt: this.round(
        game.physics && game.physics.lastDt != null ? game.physics.lastDt : 0,
      ),
      matchState: game.matchFlow.state,
      restart: {
        type: game.matchFlow.restartType(),
        phase: game.matchFlow.restartPhase(),
      },
      scores: {
        home: game.teams[0].score,
        away: game.teams[1].score,
      },
      ball: this.ballSnapshot(game.stadium.ball),
      players: this.playersSnapshot(game.stadium),
      ai: this.aiSnapshot(game.teamAis),
    };
  }

  private ballSnapshot(ball) {
    return {
      pos: this.vectorSnapshot(ball.position),
      vel: this.vectorSnapshot(ball.velocity),
      lastTouchedBy: ball.lastTouchedBy,
    };
  }

  private playersSnapshot(stadium) {
    const result = [];
    for (let t = 0; t < stadium.teams.length; t++) {
      const team = stadium.teams[t];
      for (let i = 0; i < team.players.length; i++) {
        const player = team.players[i];
        result.push({
          team: team.side,
          i: i,
          pos: this.vectorSnapshot(player.position),
          vel: this.vectorSnapshot(player.velocity),
          facing: [this.round(player.facingX), this.round(player.facingY)],
          phase: player.phaseIndex,
          step: this.round(player.stepDistance),
          human: player === team.humanPlayer,
        });
      }
    }
    return result;
  }

  private aiSnapshot(teamAis) {
    const result = [];
    for (let t = 0; t < teamAis.length; t++) {
      const teamAi = teamAis[t];
      const team = teamAi.team;
      const snapshots = teamAi.debugSnapshot();
      for (let i = 0; i < snapshots.length; i++) {
        const ai = snapshots[i];
        result.push({
          team: team.side,
          i: i,
          teamState: ai.teamState,
          command: ai.command,
          state: ai.state,
          target: this.vectorSnapshot(ai.target),
        });
      }
    }
    return result;
  }

  public draw(ctx, teamAis) {
    for (let t = 0; t < teamAis.length; t++) {
      const teamAi = teamAis[t];
      const snapshots = teamAi.debugSnapshot();
      for (let i = 0; i < snapshots.length; i++) {
        const target = snapshots[i].target;
        if (target == null) continue;
        const position = teamAi.team.players[i].position;
        ctx.beginPath();
        ctx.moveTo(position.x, position.y);
        ctx.lineTo(target.x, target.y);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "blue";
        ctx.stroke();
      }
    }
  }

  private vectorSnapshot(vector) {
    if (vector == null) {
      return null;
    }

    const result = {
      x: this.round(vector.x),
      y: this.round(vector.y),
      z: undefined,
    };
    if (vector.z != null) {
      result.z = this.round(vector.z);
    }
    return result;
  }

  private round(value) {
    if (typeof value !== "number") {
      return value;
    }
    return Math.round(value * 100) / 100;
  }

  private nowMs() {
    if (typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  private currentTimeSeconds() {
    const now = this.nowMs();
    if (this.startTimeMs == null) {
      this.startTimeMs = now;
    }
    return (now - this.startTimeMs) / 1000;
  }
}
