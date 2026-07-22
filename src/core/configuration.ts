import { Vector2, Vector3 } from "../math/vector";
import type { TeamSide } from "../types";

export const WORLD_SCALE = 4;
export const world = (value: number): number => value * WORLD_SCALE;

export interface GameAssets {
  pitch: HTMLImageElement;
  ball: HTMLImageElement;
  playerHome: HTMLImageElement;
  playerAway: HTMLImageElement;
  canvas: HTMLCanvasElement;
}

export class Configuration {
  readonly pitch = {
    boxTopLeft: new Vector2(world(50), world(80)),
    boxTopRight: new Vector2(world(625), world(80)),
    boxBottomLeft: new Vector2(world(50), world(785)),
    boxBottomRight: new Vector2(world(625), world(785)),
    goalTopTopLeft: new Vector2(world(300), world(90)),
    goalTopTopRight: new Vector2(world(372), world(90)),
    goalTopBottomLeft: new Vector2(world(300), world(113)),
    goalTopBottomRight: new Vector2(world(372), world(113)),
    goalBottomTopLeft: new Vector2(world(300), world(753)),
    goalBottomTopRight: new Vector2(world(372), world(753)),
    goalBottomBottomLeft: new Vector2(world(300), world(763)),
    goalBottomBottomRight: new Vector2(world(372), world(763)),
    fieldLeft: world(81),
    fieldRight: world(590),
    fieldTop: world(113),
    fieldBottom: world(753),
    stadiumWidth: world(672),
    stadiumHeight: world(848),
    centerCircleRadiusX: world(62),
    centerCircleRadiusY: world(40),
    initialBallPosition: new Vector3(world(334), world(433), 0),
    aiCenterY: world(433),
  };

  readonly viewport: {
    width: number;
    height: number;
    ratio: number;
    mobile: boolean;
  };

  readonly physics = {
    baseKickBoost: world(120),
    playerMomentumTransfer: 1.8,
    maxKickSpeed: world(520),
    baseLoft: world(55),
    kickLoftFactor: 0.35,
    ballPlayerRestitution: 0.35,
    ballFriction: 1.6,
    ballAirFriction: 0.35,
    gravity: world(380),
    ballGroundRestitution: 0.55,
    groundImpactDamping: 0.88,
    minBounceVelocity: world(25),
    wallRestitution: 0.7,
    minVelocity: world(3),
    ballContactMaxZ: world(5),
    maxDeltaSeconds: 0.1,
    contactEpsilon: world(0.01),
    zeroDistanceEpsilon: world(0.0001),
    statsSampleFrames: 100,
    fpsDisplayIntervalMs: 250,
  };

  readonly ball = {
    radius: world(2),
    spinPxPerPhase: world(3),
    spritePhases: 8,
    heldOffsetX: world(5),
    heldOffsetY: world(-8),
    shadowFrame: 8,
    shadowOffsetY: world(1),
    shadowMaxHeight: world(40),
  };

  readonly player = {
    radius: world(4),
    stepPxPerPhase: 10,
    spriteWidth: 40,
    spriteHeight: 64,
    spriteCenterX: 20,
    spriteCenterY: 60,
    spriteFrameWidth: 40,
    spriteFrameHeight: 64,
    idleRowOffset: 0,
    runRowOffset: 8,
    runPhases: 8,
    markerOffsetX: world(-1),
    markerOffsetY: world(-2),
    markerOuterRadius: world(10),
    markerInnerRadius: world(4),
    markerLineWidth: world(1),
    animationDirectionResponseRate: 18,
    animationDirectionConfidenceThreshold: 0.75,
    animationIdleGraceSeconds: 0.05,
    animationMaxDeltaSeconds: 0.1,
  };

  readonly teams = {
    minStrength: 1,
    maxStrength: 10,
    homeStrength: 6,
    awayStrength: 6,
    homeSize: 11,
    awaySize: 11,
    minVelocity: world(35),
    velocityRange: world(30),
  };

  readonly ai = {
    enabled: true,
    goalieDistance: world(3),
    formationDefenderProgress: world(-200),
    formationMidfielderProgress: 0,
    formationStrikerProgress: world(130),
    formationStateShift: world(55),
    formationDefenderDefenseShift: world(25),
    kickoffMidfielderProgress: world(-100),
    arrivalSlowRadius: world(36),
    arrivalMinSpeedFactor: 0.35,
    minTeammateSpacing: world(36),
    formationPaceVariation: 0.08,
    formationLateralVariation: world(20),
    formationDepthVariation: world(22),
    formationWanderLateral: world(17),
    formationWanderDepth: world(32),
    formationWanderIntervalMin: 1.2,
    formationWanderIntervalMax: 2.8,
    formationBallResponseVariation: 0.3,
    formationTargetResponseMin: 2,
    formationTargetResponseMax: 5,
    formationDefenderBallInfluence: 0.08,
    formationMidfielderBallInfluence: 0.14,
    formationStrikerBallInfluence: 0.1,
    formationDefenderMaxShift: world(18),
    formationMidfielderMaxShift: world(28),
    formationStrikerMaxShift: world(22),
    formationSeparationMaxShift: world(12),
    targetDeadband: world(2),
    targetResumeRadius: world(4),
    targetReachedRadius: world(1),
    attackerSwitchHysteresisDistance: world(20),
    formationFallbackDepth: world(20),
    fieldClampClearance: world(1),
    attackSetupDistance: world(14),
    attackRunThroughDistance: world(18),
    attackDetourStepRadians: Math.PI / 6,
    attackAimToleranceRadians: 0.15,
    attackAimCorrectionToleranceRadians: 0.05,
    attackAimReleaseToleranceRadians: 0.3,
    attackCorrectionReachedRadius: world(0.1),
    attackDetourRadius: world(10),
    attackCloseDistance: world(26),
    attackOrbitCommitAngle: Math.PI - 0.3,
  };

  readonly restarts: {
    kickoffSide: TeamSide;
    kickoffTakerDistance: number;
    kickoffImpulseMultiplier: number;
    outOfPlayEnabled: boolean;
    outOfPlayDelaySeconds: number;
    opponentDelaySeconds: number;
    opponentDistance: number;
    placementClearance: number;
    positionVariationX: number;
    positionVariationY: number;
    goalKickDistance: number;
    goalKickTakerDistance: number;
    cornerCrossDistance: number;
    cornerBoxSpacing: number;
    cornerBoxDepth: number;
    cornerBoxDepthStep: number;
    cornerLateDepth: number;
    cornerEdgeDepth: number;
    cornerShortInset: number;
    cornerShortDepth: number;
    cornerLateRunReleaseDistance: number;
    throwInSpeed: number;
    throwInLoft: number;
    throwInGoalLineSafetyDistance: number;
    throwInReceiverDistance: number;
    takerClearance: number;
  } = {
    kickoffSide: "home",
    kickoffTakerDistance: world(8),
    kickoffImpulseMultiplier: 0.5,
    outOfPlayEnabled: true,
    outOfPlayDelaySeconds: 0.35,
    opponentDelaySeconds: 1,
    opponentDistance: world(45),
    placementClearance: world(1),
    positionVariationX: world(10),
    positionVariationY: world(12),
    goalKickDistance: world(25),
    goalKickTakerDistance: world(20),
    cornerCrossDistance: world(65),
    cornerBoxSpacing: world(34),
    cornerBoxDepth: world(45),
    cornerBoxDepthStep: world(15),
    cornerLateDepth: world(115),
    cornerEdgeDepth: world(145),
    cornerShortInset: world(50),
    cornerShortDepth: world(35),
    cornerLateRunReleaseDistance: world(35),
    throwInSpeed: world(80),
    throwInLoft: world(90),
    throwInGoalLineSafetyDistance: world(75),
    throwInReceiverDistance: world(40),
    takerClearance: world(2),
  };

  readonly cutscene = {
    arrivedRadius: world(3),
    cameraArrivedRadius: world(2),
    cameraLerp: 0.06,
    goalCelebrationSeconds: 5,
    goalFocusSeconds: 1,
  };
  readonly input = { humanSwitchHysteresisDistance: world(20) };
  readonly debug = { enabled: false, logSeconds: 3, logEveryNFrames: 4 };

  public constructor(
    readonly assets: GameAssets,
    options: {
      search?: string;
      width?: number;
      height?: number;
      viewportRatio?: number;
      mobile?: boolean;
    } = {},
  ) {
    const mobile =
      options.mobile ??
      window.matchMedia?.("(pointer: coarse)").matches ??
      false;
    this.viewport = {
      width: options.width ?? window.innerWidth,
      height: options.height ?? window.innerHeight,
      // Mobile used to fit the full stadium width (ratio 1), which made the
      // players and ball feel too distant. Start closer while retaining smooth
      // mobile scaling across different screen sizes.
      ratio: options.viewportRatio ?? (mobile ? 0.5 : 0.7),
      mobile: mobile,
    };
    this.applyQueryOptions(options.search ?? window.location.search);
  }

  public strengthToVelocity(strength: number): number {
    const normalized = this.parseIntOption(
      String(strength),
      this.teams.homeStrength,
      this.teams.minStrength,
      this.teams.maxStrength,
    );
    return (
      this.teams.minVelocity +
      (normalized - this.teams.minStrength) *
        (this.teams.velocityRange /
          (this.teams.maxStrength - this.teams.minStrength))
    );
  }

  public teamVelocity(side: TeamSide): number {
    return this.strengthToVelocity(
      side === "away" ? this.teams.awayStrength : this.teams.homeStrength,
    );
  }

  public computeScaleBy(): number {
    const scale =
      this.viewport.width > this.viewport.height
        ? this.viewport.width / (this.pitch.stadiumWidth * this.viewport.ratio)
        : this.viewport.height /
          (this.pitch.stadiumHeight * this.viewport.ratio);
    if (this.viewport.mobile || this.viewport.ratio >= 1) {
      return Math.max(1 / WORLD_SCALE, scale);
    }
    return Math.max(
      1 / WORLD_SCALE,
      Math.round(scale * WORLD_SCALE) / WORLD_SCALE,
    );
  }

  private applyQueryOptions(search: string): void {
    const params = new URLSearchParams(search);
    this.teams.homeStrength = this.parseIntOption(
      params.get("playerStrength"),
      this.teams.homeStrength,
      1,
      10,
    );
    this.teams.awayStrength = this.parseIntOption(
      params.get("opponentStrength"),
      this.teams.awayStrength,
      1,
      10,
    );
    this.teams.homeSize = this.parseIntOption(
      params.get("homeTeamSize"),
      this.teams.homeSize,
      1,
      11,
    );
    this.teams.awaySize = this.parseIntOption(
      params.get("awayTeamSize"),
      this.teams.awaySize,
      1,
      11,
    );
    const side = params.get("kickoffSide");
    if (side === "home" || side === "away") this.restarts.kickoffSide = side;
    const restarts = params.get("outOfPlayRestartsEnabled");
    if (restarts === "true" || restarts === "false")
      this.restarts.outOfPlayEnabled = restarts === "true";
  }

  private parseIntOption(
    value: string | null,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed)
      ? Math.min(max, Math.max(min, parsed))
      : fallback;
  }
}

function requiredElement<T extends Element>(
  id: string,
  constructor: { new (): T },
): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor))
    throw new Error(`Missing required element #${id}`);
  return element;
}

export function loadBrowserAssets(): GameAssets {
  return {
    pitch: requiredElement("pitch", HTMLImageElement),
    ball: requiredElement("ball", HTMLImageElement),
    playerHome: requiredElement("player-home", HTMLImageElement),
    playerAway: requiredElement("player-away", HTMLImageElement),
    canvas: requiredElement("myCanvas", HTMLCanvasElement),
  };
}
