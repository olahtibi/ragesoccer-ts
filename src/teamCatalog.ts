import type { TeamSide } from "./types";

export const TEAM_CATALOG = [
  {
    home: "Red Novices",
    homeShort: "RNV",
    away: "Blue Novices",
    awayShort: "BNV",
  },
  {
    home: "Crimson Rovers",
    homeShort: "CRO",
    away: "Azure Rovers",
    awayShort: "AZR",
  },
  {
    home: "Scarlet United",
    homeShort: "SCU",
    away: "Cobalt United",
    awayShort: "COB",
  },
  { home: "Ruby City", homeShort: "RUB", away: "Navy City", awayShort: "NAV" },
  {
    home: "Cardinal Athletic",
    homeShort: "CAR",
    away: "Royal Athletic",
    awayShort: "ROY",
  },
  {
    home: "Maroon Wanderers",
    homeShort: "MAR",
    away: "Sapphire Wanderers",
    awayShort: "SAP",
  },
  {
    home: "Flame Rangers",
    homeShort: "FLM",
    away: "Ocean Rangers",
    awayShort: "OCN",
  },
  {
    home: "Ember County",
    homeShort: "EMB",
    away: "Sky County",
    awayShort: "SKY",
  },
  {
    home: "Inferno FC",
    homeShort: "INF",
    away: "Glacier FC",
    awayShort: "GLC",
  },
  {
    home: "Red Titans",
    homeShort: "RDT",
    away: "Blue Titans",
    awayShort: "BLT",
  },
] as const;

export function teamDisplayName(side: TeamSide, strength: number): string {
  const normalizedStrength = Number.isFinite(strength) ? strength : 1;
  const index = Math.min(
    TEAM_CATALOG.length - 1,
    Math.max(0, Math.trunc(normalizedStrength) - 1),
  );
  return TEAM_CATALOG[index][side];
}

export function teamShortName(side: TeamSide, strength: number): string {
  const normalizedStrength = Number.isFinite(strength) ? strength : 1;
  const index = Math.min(
    TEAM_CATALOG.length - 1,
    Math.max(0, Math.trunc(normalizedStrength) - 1),
  );
  return TEAM_CATALOG[index][side == "home" ? "homeShort" : "awayShort"];
}
