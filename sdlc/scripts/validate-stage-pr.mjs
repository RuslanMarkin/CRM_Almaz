import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  featureBranch,
  parseStageBranch,
  validateHandoff,
} from "./stage-contract.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const head = argument("--head");
const base = argument("--base");
if (!head || !base) {
  throw new Error(
    "Использование: node sdlc/scripts/validate-stage-pr.mjs --head <branch> --base <feature-branch>"
  );
}

const parsedBranch = parseStageBranch(head);
if (!parsedBranch) {
  throw new Error(`Ветка этапа имеет недопустимое имя: ${head}.`);
}

const handoffDirectory = "sdlc/handoffs";
const handoffPath = readdirSync(handoffDirectory)
  .filter(name => name.endsWith(".json"))
  .map(name => join(handoffDirectory, name))
  .find(path => {
    const handoff = JSON.parse(readFileSync(path, "utf8"));
    return handoff.schemaVersion === 2 && handoff.stageBranch === head;
  });

if (!handoffPath) {
  throw new Error(`Для ветки ${head} не найден handoff schemaVersion 2.`);
}

const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
const expectedBase = featureBranch(handoff.featureId);
if (base !== expectedBase) {
  throw new Error(
    `PR этапа должен быть направлен в ${expectedBase}, получено: ${base}.`
  );
}
if (parsedBranch.featureSlug !== handoff.featureId.toLowerCase()) {
  throw new Error("featureId в handoff не соответствует имени stage-ветки.");
}

const errors = validateHandoff(handoff, { artifactExists: existsSync });
if (errors.length) throw new Error(errors.join("\n"));
if (handoff.workStatus !== "ready_for_review") {
  throw new Error(
    "Этап ещё выполняется: перед approval нужен workStatus=ready_for_review."
  );
}

console.log(`Stage PR ${head} готов к human review.`);
