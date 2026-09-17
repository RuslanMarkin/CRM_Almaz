import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { artifactRoot, validateHandoff } from "./stage-contract.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `git ${args.join(" ")} завершился с ошибкой:\n${result.stderr || result.stdout}`
    );
  }
  return result;
}

function changedPaths() {
  const result = runGit(["status", "--porcelain=v1", "-z"]);
  const records = result.stdout.split("\0");
  const paths = [];
  for (let index = 0; index < records.length - 1; index += 1) {
    const record = records[index];
    const status = record.slice(0, 2);
    paths.push(record.slice(3));
    if (status.includes("R") || status.includes("C")) index += 1;
  }
  return paths.filter(Boolean);
}

function isSensitivePath(path) {
  return (
    path === ".env" ||
    path.endsWith(".env") ||
    path.includes("/.env") ||
    path.startsWith("node_modules/") ||
    path.startsWith(".git/") ||
    path.startsWith(".sdlc-runs/")
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonicalJson(value[key])])
    );
  }
  return value;
}

function handoffWithoutWorkStatus(handoff) {
  const copy = { ...handoff };
  delete copy.workStatus;
  return canonicalJson(copy);
}

function isPermittedStagePath(handoff, handoffPath, path) {
  if (path === handoffPath) return true;
  const root = `${artifactRoot(handoff.featureId)}/`;
  if (
    path === `${root}/TASK.md` ||
    path.startsWith(".cursor/") ||
    path.startsWith(".github/")
  ) {
    return false;
  }
  if (handoff.stage === "analysis") return path.startsWith(root);
  if (handoff.stage === "development-plan")
    return path === `${root}/development-plan.md`;
  if (handoff.stage === "qa") return path === `${root}/qa-report.md`;

  // Development is the only stage allowed to change product code. Its input
  // package is immutable; changing it requires returning to the earlier PR.
  if (path.startsWith(root)) return path === `${root}/development-notes.md`;
  if (path.startsWith("sdlc/handoffs/")) return false;
  return true;
}

const handoffPath = argument("--handoff");
if (!handoffPath) {
  throw new Error(
    "Использование: node sdlc/scripts/submit-stage.mjs --handoff sdlc/handoffs/<feature-id>.json"
  );
}
if (!handoffPath.startsWith("sdlc/handoffs/") || handoffPath.includes("..")) {
  throw new Error("Можно отправить только handoff из sdlc/handoffs/.");
}

const absoluteHandoffPath = resolve(handoffPath);
if (!existsSync(absoluteHandoffPath))
  throw new Error(`Не найден handoff: ${handoffPath}.`);
const handoff = JSON.parse(readFileSync(absoluteHandoffPath, "utf8"));
const committedHandoff = JSON.parse(
  runGit(["show", `HEAD:${handoffPath}`]).stdout
);
if (
  JSON.stringify(handoffWithoutWorkStatus(handoff)) !==
  JSON.stringify(handoffWithoutWorkStatus(committedHandoff))
) {
  throw new Error(
    "В handoff можно изменить только workStatus: контракт этапа создаётся оркестратором."
  );
}
const currentBranch = runGit(["branch", "--show-current"]).stdout.trim();
if (currentBranch !== handoff.stageBranch) {
  throw new Error(
    `Текущая ветка ${currentBranch || "detached HEAD"}; ожидалась ${handoff.stageBranch}.`
  );
}

handoff.workStatus = "ready_for_review";
writeFileSync(
  absoluteHandoffPath,
  `${JSON.stringify(handoff, null, 2)}\n`,
  "utf8"
);

const errors = validateHandoff(handoff, { artifactExists: existsSync });
if (errors.length) throw new Error(errors.join("\n"));

const paths = changedPaths();
const forbidden = paths.filter(path => {
  if (isSensitivePath(path)) return true;
  return !isPermittedStagePath(handoff, handoffPath, path);
});
if (forbidden.length) {
  throw new Error(
    `В этапе ${handoff.stage} нельзя автоматически отправлять посторонние изменения:\n${forbidden.join("\n")}`
  );
}

const stageable = paths.filter(path => !isSensitivePath(path));
if (!stageable.length) throw new Error("Нет изменений для отправки.");
runGit(["add", "--", ...stageable]);
if (
  runGit(["diff", "--cached", "--quiet"], { allowFailure: true }).status === 0
) {
  throw new Error("После фильтрации не осталось изменений для commit.");
}
runGit([
  "commit",
  "-m",
  `sdlc(${handoff.featureId.toLowerCase()}): complete ${handoff.stage} r${handoff.revision}`,
]);
runGit(["push", "origin", `HEAD:${handoff.stageBranch}`]);

console.log(
  `Этап ${handoff.stage} отправлен в ${handoff.stageBranch} и ожидает GitHub approval.`
);
