import type { Vector2 } from "../../math/vector";
import type {
  GameContext,
  RestartRequest,
  RestartScene,
  RestartType,
  TeamAiState,
  TeamSide,
} from "../../types";
import type { Configuration } from "../configuration";

export function assertRestartType<T extends RestartType>(
  request: RestartRequest,
  type: T,
): asserts request is Extract<RestartRequest, { type: T }> {
  if (request.type != type) {
    throw new Error(`Expected ${type} restart, received ${request.type}`);
  }
}

export abstract class BaseRestartStrategy {
  public readonly config: Configuration;

  protected constructor(config: Configuration) {
    this.config = config;
  }

  public abstract createScene(
    context: GameContext,
    request: RestartRequest,
  ): RestartScene;

  public teamAiState(side: TeamSide, request: RestartRequest): TeamAiState {
    const suffix = side == request.awardedTo ? "Us" : "Opponent";
    return `${request.type}${suffix}` as TeamAiState;
  }

  public canTeamMove(side: TeamSide, request: RestartRequest): boolean {
    return side == request.awardedTo;
  }

  public enforceRules(context: GameContext, request: RestartRequest): void {
    void context;
    void request;
  }

  public isComplete(context: GameContext): boolean {
    const { x, y } = context.ball.velocity;
    return x * x + y * y > this.config.physics.minVelocity ** 2;
  }

  public attackTarget?(side: TeamSide, request: RestartRequest): Vector2 | null;
}
