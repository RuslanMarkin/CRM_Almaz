import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

import { featureSlug, parseStageBranch } from "./stage-contract.mjs";

function runGit(repository, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd: repository, encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `git ${args.join(" ")} завершился с ошибкой:\n${result.stderr || result.stdout}`
    );
  }
  return result;
}

function assertInside(root, path) {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(path);
  if (
    resolvedPath !== resolvedRoot &&
    !resolvedPath.startsWith(`${resolvedRoot}/`)
  ) {
    throw new Error(
      "Рабочая папка должна находиться внутри указанного workspace-root."
    );
  }
}

export function prepareWorkspace({ clonePath, workspaceRoot, branch }) {
  const parsed = parseStageBranch(branch);
  if (!parsed) throw new Error(`Недопустимая stage-ветка: ${branch}.`);

  const repository = runGit(clonePath, [
    "rev-parse",
    "--show-toplevel",
  ]).stdout.trim();
  const target = resolve(
    workspaceRoot,
    `${parsed.featureSlug}-${parsed.stage}-r${parsed.revision}`
  );
  assertInside(workspaceRoot, target);
  mkdirSync(resolve(workspaceRoot), { recursive: true });

  if (existsSync(target)) {
    const currentBranch = runGit(target, [
      "branch",
      "--show-current",
    ]).stdout.trim();
    if (currentBranch !== branch) {
      throw new Error(
        `Папка ${target} уже занята веткой ${currentBranch || "detached HEAD"}.`
      );
    }
    return { repository, target, created: false };
  }

  runGit(repository, ["fetch", "origin", branch]);
  const localBranch = runGit(
    repository,
    ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
    {
      allowFailure: true,
    }
  );
  if (localBranch.status !== 0) {
    runGit(repository, ["branch", "--track", branch, `origin/${branch}`]);
  }
  runGit(repository, ["worktree", "add", target, branch]);
  return { repository, target, created: true };
}

export function openCursor(target, command = "cursor") {
  const process = spawn(command, [target], { detached: true, stdio: "ignore" });
  process.unref();
}

export function startCursorAgent({
  target,
  agentCommand = "cursor-agent",
  unattended = false,
}) {
  const handoffFiles = runGit(target, ["ls-files", "sdlc/handoffs/*.json"])
    .stdout.trim()
    .split("\n")
    .filter(Boolean);
  const handoffPath = handoffFiles.find(path => {
    try {
      const handoff = JSON.parse(readFileSync(resolve(target, path), "utf8"));
      return (
        handoff.schemaVersion === 2 &&
        handoff.stageBranch ===
          runGit(target, ["branch", "--show-current"]).stdout.trim()
      );
    } catch {
      return false;
    }
  });
  if (!handoffPath)
    throw new Error("В worktree не найден handoff текущего этапа.");

  const handoff = JSON.parse(
    readFileSync(resolve(target, handoffPath), "utf8")
  );
  const prompt = [
    `Выполни SDLC-этап ${handoff.stage} для ${handoff.featureId}.`,
    `Сначала полностью прочитай sdlc/artifacts/${handoff.featureId}/TASK.md и перечисленные там артефакты.`,
    "Не выполняй merge, не обходи проверки и не меняй .env или секреты.",
    `Когда выполнишь все требования, запусти node sdlc/scripts/submit-stage.mjs --handoff ${handoffPath}.`,
  ].join(" ");
  const runDirectory = resolve(target, ".sdlc-runs");
  mkdirSync(runDirectory, { recursive: true });
  const logPath = resolve(
    runDirectory,
    `${featureSlug(handoff.featureId)}-${handoff.stage}-r${handoff.revision}.log`
  );
  const log = openSync(logPath, "a");
  const args = ["-p", prompt, "--output-format", "stream-json"];
  if (unattended) args.push("--force");
  const version = spawnSync(agentCommand, ["--version"], { encoding: "utf8" });
  if (version.status !== 0) {
    closeSync(log);
    throw new Error(
      `Не удалось запустить ${agentCommand}. Установите Cursor CLI или задайте CURSOR_AGENT_COMMAND.`
    );
  }
  const process = spawn(agentCommand, args, {
    cwd: target,
    detached: true,
    stdio: ["ignore", log, log],
  });
  closeSync(log);
  process.unref();
  return { logPath, pid: process.pid };
}
