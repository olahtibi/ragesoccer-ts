import type { Vector2 } from "../math/vector";
import { TEAM_SIDES } from "../types";
import type {
  DebugInputEvent,
  MatchState,
  RestartPhase,
  RestartType,
  TeamSide,
} from "../types";
import type { Ball } from "../world/ball";
import type { Stadium } from "../world/stadium";
import type { Configuration } from "./configuration";
import type { Game } from "./game";

export { DebugTool };

interface VectorSnapshot {
  x: number;
  y: number;
  z?: number;
}

interface TimedDebugEvent extends DebugInputEvent {
  time: number;
}

interface PlayerDebugSnapshot {
  team: TeamSide;
  i: number;
  pos: VectorSnapshot;
  vel: VectorSnapshot;
  facing: number[];
  phase: number;
  step: number;
  human: boolean;
}

interface AiDebugSnapshot {
  team: TeamSide;
  i: number;
  teamState: string;
  command: string;
  state: string;
  target: VectorSnapshot | null;
}

interface GameDebugSnapshot {
  frame: number;
  time: number;
  dt: number;
  matchState: MatchState;
  restart: { type: RestartType | null; phase: RestartPhase | null };
  scores: { home: number; away: number };
  ball: {
    pos: VectorSnapshot;
    vel: VectorSnapshot;
    lastTouchedBy: TeamSide | null;
  };
  players: PlayerDebugSnapshot[];
  ai: AiDebugSnapshot[];
}

class DebugTool {
  public readonly config: Configuration;
  public readonly snapshots: GameDebugSnapshot[];
  public readonly events: TimedDebugEvent[];
  public frame: number;
  public startTimeMs: number | null;

  public constructor(config: Configuration) {
    this.config = config;
    this.snapshots = [];
    this.events = [];
    this.frame = 0;
    this.startTimeMs = null;
  }

  public record(game: Game): void {
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

  public recordKeyEvent(e: Pick<KeyboardEvent, "type" | "keyCode">): void {
    if (!this.config.debug.enabled) {
      return;
    }

    const event: TimedDebugEvent = {
      time: this.round(this.currentTimeSeconds()),
      frame: this.frame,
      type: e.type === "keydown" ? "keydown" : "keyup",
      keyCode: e.keyCode,
    };
    this.events.push(event);
    this.trim(event.time);
  }

  public recordTouchEvent(target: Vector2): void {
    if (!this.config.debug.enabled) {
      return;
    }

    const event: TimedDebugEvent = {
      time: this.round(this.currentTimeSeconds()),
      frame: this.frame,
      type: "touch",
      target: this.vectorSnapshot(target),
    };
    this.events.push(event);
    this.trim(event.time);
  }

  public dump(): void {
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

  private trim(currentTime: number): void {
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

  private snapshot(game: Game, frame: number, time: number): GameDebugSnapshot {
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
        home: game.sides.home.team.score,
        away: game.sides.away.team.score,
      },
      ball: this.ballSnapshot(game.stadium.ball),
      players: this.playersSnapshot(game.stadium),
      ai: this.aiSnapshot(game.sides),
    };
  }

  private ballSnapshot(ball: Ball): GameDebugSnapshot["ball"] {
    return {
      pos: this.vectorSnapshot(ball.position),
      vel: this.vectorSnapshot(ball.velocity),
      lastTouchedBy: ball.lastTouchedBy,
    };
  }

  private playersSnapshot(stadium: Stadium): PlayerDebugSnapshot[] {
    const result: PlayerDebugSnapshot[] = [];
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

  private aiSnapshot(sides: Game["sides"]): AiDebugSnapshot[] {
    const result: AiDebugSnapshot[] = [];
    for (let t = 0; t < TEAM_SIDES.length; t++) {
      const teamAi = sides[TEAM_SIDES[t]].ai;
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

  public draw(ctx: CanvasRenderingContext2D, sides: Game["sides"]): void {
    for (let t = 0; t < TEAM_SIDES.length; t++) {
      const teamAi = sides[TEAM_SIDES[t]].ai;
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

  private vectorSnapshot(vector: Vector2 & { z?: number }): VectorSnapshot;
  private vectorSnapshot(vector: null): null;
  private vectorSnapshot(
    vector: (Vector2 & { z?: number }) | null,
  ): VectorSnapshot | null;
  private vectorSnapshot(
    vector: (Vector2 & { z?: number }) | null,
  ): VectorSnapshot | null {
    if (vector == null) {
      return null;
    }

    const result: VectorSnapshot = {
      x: this.round(vector.x),
      y: this.round(vector.y),
    };
    if (vector.z != null) {
      result.z = this.round(vector.z);
    }
    return result;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private nowMs(): number {
    if (typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  private currentTimeSeconds(): number {
    const now = this.nowMs();
    if (this.startTimeMs == null) {
      this.startTimeMs = now;
    }
    return (now - this.startTimeMs) / 1000;
  }
}
