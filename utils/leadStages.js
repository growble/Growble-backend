const LEAD_STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost"
];

const STAGE_ALIASES = new Map([
  ["contacted", "qualified"],
  ["interested", "qualified"],
  ["won", "closed_won"],
  ["closed", "closed_won"],
  ["lost", "closed_lost"],
  ["closedlost", "closed_lost"]
]);

function normalizeLeadStage(value) {
  const stage = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (LEAD_STAGES.includes(stage)) return stage;
  return STAGE_ALIASES.get(stage) || null;
}

module.exports = { LEAD_STAGES, normalizeLeadStage };
