export { RestartRegistry };

class RestartRegistry {
  [key: string]: any;
  public constructor() {
    this._strategies = {};
  }

  public register(type, strategy) {
    this._strategies[type] = strategy;
  }

  public get(type) {
    return this._strategies[type] || null;
  }
}
