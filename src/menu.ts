import "./styles/menu.css";

const strengths = [
  ["Novices", "Novices"],
  ["Crimson Rovers", "Azure Rovers"],
  ["Scarlet United", "Cobalt United"],
  ["Ruby City", "Navy City"],
  ["Cardinal Athletic", "Royal Athletic"],
  ["Maroon Wanderers", "Sapphire Wanderers"],
  ["Flame Rangers", "Ocean Rangers"],
  ["Ember County", "Sky County"],
  ["Inferno FC", "Glacier FC"],
  ["Red Titans", "Blue Titans"],
] as const;

function options(values: readonly string[], selected: string): string {
  return values
    .map(
      (value) =>
        `<option value="${value}"${value === selected ? " selected" : ""}>${value}</option>`,
    )
    .join("");
}

const form = document.querySelector<HTMLFormElement>("#optionsForm");
if (!form) throw new Error("Missing options form");

const homeStrengths = strengths.map(
  ([home], index) => `${index + 1} - ${home}`,
);
const awayStrengths = strengths.map(
  ([, away], index) => `${index + 1} - ${away}`,
);
const sizes = Array.from({ length: 11 }, (_, index) => String(index + 1));

form.innerHTML = `
  <div class="field"><label for="playerStrength">Player strength</label><select id="playerStrength">${homeStrengths.map((label, index) => `<option value="${index + 1}"${index === 1 ? " selected" : ""}>${label}</option>`).join("")}</select></div>
  <div class="field"><label for="opponentStrength">Opponent strength</label><select id="opponentStrength">${awayStrengths.map((label, index) => `<option value="${index + 1}"${index === 1 ? " selected" : ""}>${label}</option>`).join("")}</select></div>
  <div class="field"><label for="homeTeamSize">Player team size</label><select id="homeTeamSize">${options(sizes, "11")}</select></div>
  <div class="field"><label for="awayTeamSize">Opponent team size</label><select id="awayTeamSize">${options(sizes, "11")}</select></div>
  <div class="field"><label for="kickoffSide">Kickoff</label><select id="kickoffSide"><option value="home" selected>Player team</option><option value="away">Opponent team</option></select></div>
  <div class="field"><label for="outOfPlayRestartsEnabled">Throw-ins, corners, and goal kicks</label><select id="outOfPlayRestartsEnabled"><option value="true" selected>Enabled</option><option value="false">Disabled (reflective boundaries)</option></select></div>
  <button type="submit">Start match</button>`;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const params = new URLSearchParams();
  for (const id of [
    "playerStrength",
    "opponentStrength",
    "homeTeamSize",
    "awayTeamSize",
    "kickoffSide",
    "outOfPlayRestartsEnabled",
  ]) {
    const element = document.getElementById(id) as HTMLSelectElement;
    params.set(id, element.value);
  }
  window.location.href = `game.html?${params.toString()}`;
});
