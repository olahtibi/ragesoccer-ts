export class Vector2 {
  public constructor(
    public x: number,
    public y: number,
  ) {}

  public clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }
}

export class Vector3 extends Vector2 {
  public constructor(
    x: number,
    y: number,
    public z: number,
  ) {
    super(x, y);
  }

  public override clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }
}
