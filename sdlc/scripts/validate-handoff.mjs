import { readFileSync, existsSync } from "node:fs";

const requiredFields = ["featureId", "title", "stage", "nextExecutor", "artifacts", "requiredChecks"];
const path = process.argv[2];

if (!path) throw new Error("Использование: node sdlc/scripts/validate-handoff.mjs <handoff.json>");

const handoff = JSON.parse(readFileSync(path, "utf8"));
for (const field of requiredFields) {
  if (!handoff[field] || (Array.isArray(handoff[field]) && handoff[field].length === 0)) {
    throw new Error(`В handoff отсутствует обязательное поле: ${field}`);
  }
}
for (const artifact of handoff.artifacts) {
  if (!existsSync(artifact)) throw new Error(`Не найден артефакт handoff: ${artifact}`);
}
console.log(`Handoff ${handoff.featureId} готов для роли ${handoff.nextExecutor}.`);
