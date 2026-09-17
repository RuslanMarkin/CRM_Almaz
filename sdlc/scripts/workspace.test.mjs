import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { prepareWorkspace } from "./workspace.mjs";

function git(directory, ...args) {
  return execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
}

test("workspace agent creates an isolated tracked worktree for one stage branch", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "sdlc-workspace-"));
  const source = join(temporaryRoot, "source");
  const remote = join(temporaryRoot, "remote.git");
  const workspaces = join(temporaryRoot, "workspaces");
  const branch = "stage/cp-status-001/analysis/r1";

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
    writeFileSync(join(source, "stage.txt"), "analysis\n");
    git(source, "add", "stage.txt");
    git(source, "commit", "-m", "stage");
    git(source, "push", "-u", "origin", branch);
    git(source, "switch", "main");

    const first = prepareWorkspace({
      clonePath: source,
      workspaceRoot: workspaces,
      branch,
    });
    assert.equal(first.created, true);
    assert.equal(git(first.target, "branch", "--show-current"), branch);

    const second = prepareWorkspace({
      clonePath: source,
      workspaceRoot: workspaces,
      branch,
    });
    assert.equal(second.created, false);
    assert.equal(second.target, first.target);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
