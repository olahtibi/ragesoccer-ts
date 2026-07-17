import type { RestartStrategy, RestartType } from "../../types";

export { RestartRegistry };

class RestartRegistry {
  private readonly strategies: Partial<Record<RestartType, RestartStrategy>>;

  public constructor() {
    this.strategies = {};
  }

  public register(type: RestartType, strategy: RestartStrategy): void {
    this.strategies[type] = strategy;
  }

  public get(type: RestartType): RestartStrategy | null {
    return this.strategies[type] || null;
  }
}
