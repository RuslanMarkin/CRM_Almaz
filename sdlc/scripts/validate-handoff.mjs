import { readFileSync, existsSync } from "node:fs";
import { validateHandoff } from "./stage-contract.mjs";

const path = process.argv[2];

if (!path)
  throw new Error(
    "Использование: node sdlc/scripts/validate-handoff.mjs <handoff.json>"
  );

const handoff = JSON.parse(readFileSync(path, "utf8"));
const errors = validateHandoff(handoff, { artifactExists: existsSync });
if (errors.length) throw new Error(errors.join("\n"));

console.log(
  `Handoff ${handoff.featureId} прошёл проверку для роли ${handoff.nextExecutor}.`
);
