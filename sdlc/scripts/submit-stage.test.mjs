import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createStageHandoff } from "./stage-contract.mjs";

function git(directory, ...args) {
  return execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
}

test("submit-stage validates, commits and pushes only a completed stage package", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "sdlc-submit-"));
  const source = join(temporaryRoot, "source");
  const remote = join(temporaryRoot, "remote.git");
  const featureId = "CP-STATUS-001";
  const branch = "stage/cp-status-001/analysis/r1";
  const artifacts = `sdlc/artifacts/${featureId}`;
  const handoffPath = `sdlc/handoffs/${featureId}.json`;

  try {
    execFileSync("git", ["init", "--initial-branch=main", source]);
    git(source, "config", "user.email", "test@example.com");
    git(source, "config", "user.name", "SDLC test");
    writeFileSync(join(source, "README.md"), "fixture\n");
    git(source, "add", "README.md");
    git(source, "commit", "-m", "initial");
    execFileSync("git", ["init", "--bare", remote]);
    git(source, "remote", "add", "origin", remote);
    git(source, "push", "-u", "origin", "main");
    git(source, "switch", "-c", branch);

    const handoff = createStageHandoff({
      featureId,
      title: "Статусы контрагентов",
      stage: "analysis",
      artifacts: [
        `${artifacts}/business-request.md`,
        `${artifacts}/test-plan.md`,
      ],
    });
    for (const [path, content] of Object.entries({
      [`${artifacts}/business-request.md`]: "# Запрос\n",
      [`${artifacts}/analysis-spec.md`]: "# Спецификация\n",
      [`${artifacts}/test-plan.md`]: "# Тест-план\n",
      [handoffPath]: `${JSON.stringify(handoff, null, 2)}\n`,
    })) {
      const absolutePath = join(source, path);
      execFileSync("mkdir", ["-p", dirname(absolutePath)]);
      writeFileSync(absolutePath, content);
    }
    git(source, "add", "sdlc");
    git(source, "commit", "-m", "start stage");
    git(source, "push", "-u", "origin", branch);

    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL("./submit-stage.mjs", import.meta.url)),
        "--handoff",
        handoffPath,
      ],
      {
        cwd: source,
        encoding: "utf8",
      }
    );

    const submitted = JSON.parse(
      readFileSync(join(source, handoffPath), "utf8")
    );
    assert.equal(submitted.workStatus, "ready_for_review");
    assert.match(
      git(source, "log", "-1", "--pretty=%s"),
      /complete analysis r1/
    );
    assert.equal(
      git(source, "ls-remote", "origin", `refs/heads/${branch}`).length > 0,
      true
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("submit-stage rejects code changes from a QA-only stage", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "sdlc-submit-guard-"));
  const source = join(temporaryRoot, "source");
  const featureId = "CP-STATUS-001";
  const branch = "stage/cp-status-001/qa/r1";
  const artifacts = `sdlc/artifacts/${featureId}`;
  const handoffPath = `sdlc/handoffs/${featureId}.json`;

  try {
    execFileSync("git", ["init", "--initial-branch=main", source]);
    git(source, "config", "user.email", "test@example.com");
    git(source, "config", "user.name", "SDLC test");
    git(source, "switch", "-c", branch);
    const handoff = createStageHandoff({
      featureId,
      title: "Статусы контрагентов",
      stage: "qa",
      artifacts: [`${artifacts}/test-plan.md`],
    });
    for (const [path, content] of Object.entries({
      [`${artifacts}/test-plan.md`]: "# Тест-план\n",
      [`${artifacts}/qa-report.md`]: "# QA\n",
      [handoffPath]: `${JSON.stringify(handoff, null, 2)}\n`,
      "server/forbidden.ts": "export const forbidden = true;\n",
    })) {
      const absolutePath = join(source, path);
      execFileSync("mkdir", ["-p", dirname(absolutePath)]);
      writeFileSync(absolutePath, content);
    }
    git(source, "add", ".");
    git(source, "commit", "-m", "start qa");
    writeFileSync(
      join(source, "server/forbidden.ts"),
      "export const forbidden = false;\n"
    );

    let failure = null;
    try {
      execFileSync(
        process.execPath,
        [
          fileURLToPath(new URL("./submit-stage.mjs", import.meta.url)),
          "--handoff",
          handoffPath,
        ],
        { cwd: source, encoding: "utf8", stdio: "pipe" }
      );
    } catch (error) {
      failure = error;
    }
    assert.ok(failure);
    assert.match(
      failure.stderr,
      /нельзя автоматически отправлять посторонние изменения/
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
