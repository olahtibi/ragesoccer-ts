import { Vector2, Vector3 } from "../math/vector";
import type { TeamSide } from "../types";

export interface GameAssets {
  pitch: HTMLImageElement;
  ball: HTMLImageElement;
  playerHome: HTMLImageElement;
  playerAway: HTMLImageElement;
  canvas: HTMLCanvasElement;
}

export class Configuration {
  readonly pitch = {
    boxTopLeft: new Vector2(50, 80),
    boxTopRight: new Vector2(625, 80),
    boxBottomLeft: new Vector2(50, 785),
    boxBottomRight: new Vector2(625, 785),
    goalTopTopLeft: new Vector2(300, 90),
    goalTopTopRight: new Vector2(372, 90),
    goalTopBottomLeft: new Vector2(300, 113),
    goalTopBottomRight: new Vector2(372, 113),
    goalBottomTopLeft: new Vector2(300, 753),
    goalBottomTopRight: new Vector2(372, 753),
    goalBottomBottomLeft: new Vector2(300, 763),
    goalBottomBottomRight: new Vector2(372, 763),
    fieldLeft: 81,
    fieldRight: 590,
    fieldTop: 113,
    fieldBottom: 753,
    stadiumWidth: 672,
    stadiumHeight: 848,
    centerCircleRadiusX: 62,
    centerCircleRadiusY: 40,
    initialBallPosition: new Vector3(334, 433, 0),
    aiCenterY: 433,
  };

  readonly viewport: {
    width: number;
    height: number;
    ratio: number;
  };

  readonly physics = {
    baseKickBoost: 120,
    playerMomentumTransfer: 1.8,
    maxKickSpeed: 520,
    baseLoft: 55,
    kickLoftFactor: 0.35,
    ballPlayerRestitution: 0.35,
    ballFriction: 1.6,
    ballAirFriction: 0.35,
    gravity: 380,
    ballGroundRestitution: 0.55,
    groundImpactDamping: 0.88,
    minBounceVelocity: 25,
    wallRestitution: 0.7,
    minVelocity: 3,
    ballContactMaxZ: 5,
    maxDeltaSeconds: 0.1,
    contactEpsilon: 0.01,
    zeroDistanceEpsilon: 0.0001,
    statsSampleFrames: 100,
    fpsDisplayIntervalMs: 250,
  };

  readonly ball = {
    radius: 2,
    spinPxPerPhase: 6,
    spritePhases: 4,
    heldOffsetX: 5,
    heldOffsetY: -8,
    shadowFrame: 4,
    shadowOffset: 1,
  };

  readonly player = {
    radius: 4,
    stepPxPerPhase: 4,
    spriteWidth: 10,
    spriteHeight: 16,
    spriteCenterX: 6,
    spriteCenterY: 13,
    spriteSourceRowHeight: 18,
    spritePhases: 3,
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
    minVelocity: 35,
    velocityRange: 30,
  };

  readonly ai = {
    enabled: true,
    goalieDistance: 3,
    formationDefenderProgress: -200,
    formationMidfielderProgress: 0,
    formationStrikerProgress: 130,
    formationStateShift: 55,
    formationDefenderDefenseShift: 25,
    kickoffMidfielderProgress: -100,
    arrivalSlowRadius: 36,
    arrivalMinSpeedFactor: 0.35,
    minTeammateSpacing: 36,
    formationPaceVariation: 0.08,
    formationLateralVariation: 20,
    formationDepthVariation: 22,
    formationWanderLateral: 17,
    formationWanderDepth: 32,
    formationWanderIntervalMin: 1.2,
    formationWanderIntervalMax: 2.8,
    formationBallResponseVariation: 0.3,
    formationTargetResponseMin: 2,
    formationTargetResponseMax: 5,
    formationDefenderBallInfluence: 0.08,
    formationMidfielderBallInfluence: 0.14,
    formationStrikerBallInfluence: 0.1,
    formationDefenderMaxShift: 18,
    formationMidfielderMaxShift: 28,
    formationStrikerMaxShift: 22,
    formationSeparationMaxShift: 12,
    targetDeadband: 2,
    targetResumeRadius: 4,
    targetReachedRadius: 1,
    attackerSwitchHysteresisDistance: 20,
    formationFallbackDepth: 20,
    fieldClampClearance: 1,
    attackSetupDistance: 14,
    attackRunThroughDistance: 18,
    attackDetourStepRadians: Math.PI / 6,
    attackAimToleranceRadians: 0.15,
    attackAimCorrectionToleranceRadians: 0.05,
    attackAimReleaseToleranceRadians: 0.3,
    attackCorrectionReachedRadius: 0.1,
    attackDetourRadius: 10,
    attackCloseDistance: 26,
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
    kickoffTakerDistance: 8,
    kickoffImpulseMultiplier: 0.5,
    outOfPlayEnabled: true,
    outOfPlayDelaySeconds: 0.35,
    opponentDelaySeconds: 1,
    opponentDistance: 45,
    placementClearance: 1,
    positionVariationX: 10,
    positionVariationY: 12,
    goalKickDistance: 25,
    goalKickTakerDistance: 20,
    cornerCrossDistance: 65,
    cornerBoxSpacing: 34,
    cornerBoxDepth: 45,
    cornerBoxDepthStep: 15,
    cornerLateDepth: 115,
    cornerEdgeDepth: 145,
    cornerShortInset: 50,
    cornerShortDepth: 35,
    cornerLateRunReleaseDistance: 35,
    throwInSpeed: 80,
    throwInLoft: 90,
    throwInGoalLineSafetyDistance: 75,
    throwInReceiverDistance: 40,
    takerClearance: 2,
  };

  readonly cutscene = {
    arrivedRadius: 3,
    cameraArrivedRadius: 2,
    cameraLerp: 0.06,
    goalCelebrationSeconds: 5,
    goalFocusSeconds: 1,
  };
  readonly input = { humanSwitchHysteresisDistance: 20 };
  readonly debug = { enabled: true, logSeconds: 3, logEveryNFrames: 4 };

  public constructor(
    readonly assets: GameAssets,
    options: { search?: string; width?: number; height?: number } = {},
  ) {
    this.viewport = {
      width: options.width ?? window.innerWidth,
      height: options.height ?? window.innerHeight,
      ratio: 0.7,
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
    return Math.max(1, Math.round(scale));
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
