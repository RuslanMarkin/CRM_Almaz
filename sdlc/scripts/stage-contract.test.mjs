import assert from "node:assert/strict";
import test from "node:test";

import {
  createStageHandoff,
  featureBranch,
  parseStageBranch,
  renderStageTask,
  stageBranch,
  validateHandoff,
} from "./stage-contract.mjs";
import { parseWorkspaceTask } from "./workspace-task.mjs";

test("stage branch lives outside the feature branch namespace", () => {
  assert.equal(featureBranch("CP-STATUS-001"), "feature/cp-status-001");
  assert.equal(
    stageBranch("CP-STATUS-001", "analysis", 2),
    "stage/cp-status-001/analysis/r2"
  );
  assert.deepEqual(parseStageBranch("stage/cp-status-001/analysis/r2"), {
    featureSlug: "cp-status-001",
    stage: "analysis",
    revision: 2,
  });
  assert.equal(parseStageBranch("feature/cp-status-001/analysis"), null);
});

test("a ready analysis package needs all its output artifacts", () => {
  const handoff = createStageHandoff({
    featureId: "CP-STATUS-001",
    title: "Статусы контрагентов",
    stage: "analysis",
  });
  handoff.workStatus = "ready_for_review";
  handoff.artifacts.push(
    "sdlc/artifacts/CP-STATUS-001/business-request.md",
    "sdlc/artifacts/CP-STATUS-001/test-plan.md"
  );

  assert.deepEqual(
    validateHandoff(handoff, { artifactExists: () => true }),
    []
  );
});

test("a stage cannot be approved before its required artifact exists", () => {
  const handoff = createStageHandoff({
    featureId: "CP-STATUS-001",
    title: "Статусы контрагентов",
    stage: "development-plan",
    artifacts: [
      "sdlc/artifacts/CP-STATUS-001/analysis-spec.md",
      "sdlc/artifacts/CP-STATUS-001/test-plan.md",
    ],
  });
  handoff.workStatus = "ready_for_review";

  const errors = validateHandoff(handoff, {
    artifactExists: path => !path.endsWith("development-plan.md"),
  });

  assert.match(errors.join("\n"), /development-plan\.md/);
});

test("legacy handoffs remain valid while the repository migrates", () => {
  const errors = validateHandoff(
    {
      featureId: "CP-STATUS-001",
      title: "Статусы",
      stage: "ready_for_qa",
      nextExecutor: "qa",
      artifacts: ["sdlc/artifacts/CP-STATUS-001/test-plan.md"],
      requiredChecks: ["pnpm test"],
    },
    { artifactExists: () => true }
  );

  assert.deepEqual(errors, []);
});

test("task text makes GitHub approval the only human decision", () => {
  const task = renderStageTask(
    createStageHandoff({
      featureId: "CP-STATUS-001",
      title: "Статусы контрагентов",
      stage: "qa",
    })
  );

  assert.match(task, /Approve/);
  assert.match(task, /не выполняйте merge/i);
  assert.match(task, /submit-stage\.mjs/);
});

test("workspace task is accepted only for a valid temporary stage branch", () => {
  const encoded = Buffer.from(
    JSON.stringify({ branch: "stage/cp-status-001/development/r1" })
  ).toString("base64url");
  assert.deepEqual(
    parseWorkspaceTask(`<!-- sdlc-workspace-task:${encoded} -->`),
    {
      branch: "stage/cp-status-001/development/r1",
    }
  );
  assert.equal(
    parseWorkspaceTask("<!-- sdlc-workspace-task:not-json -->"),
    null
  );
});
