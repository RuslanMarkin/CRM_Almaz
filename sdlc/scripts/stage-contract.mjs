/**
 * Versioned contract for the Git-native, human-gated SDLC stages.
 *
 * The integration branch and its temporary stage branches deliberately use
 * different namespaces. Git cannot have both `feature/foo` and
 * `feature/foo/analysis` refs at the same time.
 */

const FEATURE_ID_PATTERN = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-[0-9]+$/;

export const STAGES = Object.freeze({
  analysis: Object.freeze({
    executor: "analyst",
    next: "development-plan",
    output: "analysis-spec.md",
    requiredArtifacts: [
      "business-request.md",
      "analysis-spec.md",
      "test-plan.md",
    ],
  }),
  "development-plan": Object.freeze({
    executor: "developer",
    next: "development",
    output: "development-plan.md",
    requiredArtifacts: [
      "analysis-spec.md",
      "test-plan.md",
      "development-plan.md",
    ],
  }),
  development: Object.freeze({
    executor: "developer",
    next: "qa",
    output: "development-notes.md",
    requiredArtifacts: ["development-plan.md", "development-notes.md"],
  }),
  qa: Object.freeze({
    executor: "qa",
    next: null,
    output: "qa-report.md",
    requiredArtifacts: ["test-plan.md", "qa-report.md"],
  }),
});

export const WORK_STATUSES = Object.freeze(["in_progress", "ready_for_review"]);

export function featureSlug(featureId) {
  if (typeof featureId !== "string" || !FEATURE_ID_PATTERN.test(featureId)) {
    throw new Error(
      "featureId должен иметь формат вроде CP-STATUS-001 (латинские заглавные буквы, дефисы и номер)."
    );
  }
  return featureId.toLowerCase();
}

export function featureBranch(featureId) {
  return `feature/${featureSlug(featureId)}`;
}

export function stageBranch(featureId, stage, revision) {
  if (!STAGES[stage]) throw new Error(`Неизвестный этап SDLC: ${stage}.`);
  if (!Number.isInteger(revision) || revision < 1) {
    throw new Error("revision должен быть положительным целым числом.");
  }
  return `stage/${featureSlug(featureId)}/${stage}/r${revision}`;
}

export function parseStageBranch(branch) {
  if (typeof branch !== "string") return null;
  const match = branch.match(
    /^stage\/([a-z0-9]+(?:-[a-z0-9]+)*)\/(analysis|development-plan|development|qa)\/r([1-9][0-9]*)$/
  );
  if (!match) return null;
  return { featureSlug: match[1], stage: match[2], revision: Number(match[3]) };
}

export function artifactRoot(featureId) {
  featureSlug(featureId);
  return `sdlc/artifacts/${featureId}`;
}

export function stageOutputPath(featureId, stage) {
  const definition = STAGES[stage];
  if (!definition) throw new Error(`Неизвестный этап SDLC: ${stage}.`);
  return `${artifactRoot(featureId)}/${definition.output}`;
}

export function createStageHandoff({
  featureId,
  title,
  stage,
  revision = 1,
  sourceCommit = "",
  artifacts = [],
  requiredChecks = ["pnpm check", "pnpm test"],
}) {
  const definition = STAGES[stage];
  if (!definition) throw new Error(`Неизвестный этап SDLC: ${stage}.`);
  const output = stageOutputPath(featureId, stage);
  const allArtifacts = [...new Set([...artifacts, output])];

  return {
    schemaVersion: 2,
    featureId,
    title,
    stage,
    nextExecutor: definition.executor,
    workStatus: "in_progress",
    revision,
    baseBranch: featureBranch(featureId),
    stageBranch: stageBranch(featureId, stage, revision),
    sourceCommit,
    artifacts: allArtifacts,
    requiredChecks,
  };
}

function validateArtifactPath(featureId, artifact) {
  const root = `${artifactRoot(featureId)}/`;
  return (
    typeof artifact === "string" &&
    artifact.startsWith(root) &&
    !artifact.includes("..")
  );
}

/**
 * Validate a handoff object without filesystem access. Callers that have a
 * checkout pass `artifactExists` to also prove the listed files are present.
 */
export function validateHandoff(handoff, { artifactExists = null } = {}) {
  const errors = [];
  if (!handoff || typeof handoff !== "object" || Array.isArray(handoff)) {
    return ["Handoff должен быть JSON-объектом."];
  }

  for (const field of [
    "featureId",
    "title",
    "stage",
    "nextExecutor",
    "artifacts",
    "requiredChecks",
  ]) {
    const value = handoff[field];
    if (!value || (Array.isArray(value) && value.length === 0)) {
      errors.push(`В handoff отсутствует обязательное поле: ${field}.`);
    }
  }
  if (!Array.isArray(handoff.artifacts))
    errors.push("artifacts должен быть массивом.");
  if (!Array.isArray(handoff.requiredChecks))
    errors.push("requiredChecks должен быть массивом.");

  // The existing CP-STATUS-001 handoff remains valid during migration.
  if (handoff.schemaVersion === undefined) {
    if (Array.isArray(handoff.artifacts) && artifactExists) {
      for (const artifact of handoff.artifacts) {
        if (!artifactExists(artifact))
          errors.push(`Не найден артефакт handoff: ${artifact}.`);
      }
    }
    return errors;
  }

  if (handoff.schemaVersion !== 2) {
    errors.push("Поддерживается только schemaVersion: 2.");
    return errors;
  }

  try {
    featureSlug(handoff.featureId);
  } catch (error) {
    errors.push(error.message);
  }

  const definition = STAGES[handoff.stage];
  if (!definition) {
    errors.push(`Неизвестный этап SDLC: ${handoff.stage}.`);
    return errors;
  }
  if (handoff.nextExecutor !== definition.executor) {
    errors.push(
      `Для этапа ${handoff.stage} nextExecutor должен быть ${definition.executor}.`
    );
  }
  if (!WORK_STATUSES.includes(handoff.workStatus)) {
    errors.push(
      `workStatus должен быть одним из: ${WORK_STATUSES.join(", ")}.`
    );
  }
  if (!Number.isInteger(handoff.revision) || handoff.revision < 1) {
    errors.push("revision должен быть положительным целым числом.");
  }

  try {
    if (handoff.baseBranch !== featureBranch(handoff.featureId)) {
      errors.push(
        `baseBranch должен быть ${featureBranch(handoff.featureId)}.`
      );
    }
    if (
      handoff.stageBranch !==
      stageBranch(handoff.featureId, handoff.stage, handoff.revision)
    ) {
      errors.push("stageBranch не соответствует featureId, stage и revision.");
    }
  } catch {
    // featureId has already produced a specific validation error above.
  }

  if (Array.isArray(handoff.artifacts)) {
    for (const artifact of handoff.artifacts) {
      if (!validateArtifactPath(handoff.featureId, artifact)) {
        errors.push(
          `Артефакт должен находиться в ${artifactRoot(handoff.featureId)}: ${artifact}.`
        );
      } else if (artifactExists && !artifactExists(artifact)) {
        errors.push(`Не найден артефакт handoff: ${artifact}.`);
      }
    }
  }

  if (handoff.workStatus === "ready_for_review") {
    for (const name of definition.requiredArtifacts) {
      const artifact = `${artifactRoot(handoff.featureId)}/${name}`;
      if (!handoff.artifacts?.includes(artifact)) {
        errors.push(
          `Для готового этапа ${handoff.stage} нужен артефакт: ${artifact}.`
        );
      } else if (artifactExists && !artifactExists(artifact)) {
        errors.push(
          `Не найден обязательный артефакт готового этапа: ${artifact}.`
        );
      }
    }
  }

  return errors;
}

export function renderStageTask(handoff) {
  const definition = STAGES[handoff.stage];
  if (!definition) throw new Error(`Неизвестный этап SDLC: ${handoff.stage}.`);
  const expected = definition.requiredArtifacts
    .map(name => `- \`${artifactRoot(handoff.featureId)}/${name}\``)
    .join("\n");

  return (
    `# ${handoff.featureId}: ${handoff.title}\n\n` +
    `Этап: **${handoff.stage}**, ревизия ${handoff.revision}.\n\n` +
    `## Вход\n\n${handoff.artifacts.map(artifact => `- \`${artifact}\``).join("\n")}\n\n` +
    `## Ожидаемый результат\n\n${expected}\n\n` +
    `## Правила выполнения\n\n` +
    `1. Работайте только в ветке \`${handoff.stageBranch}\`; её base — \`${handoff.baseBranch}\`.\n` +
    `2. Не меняйте утверждённые артефакты предыдущих этапов: создавайте новую ревизию через возврат этапа.\n` +
    `3. Выполните обязательные проверки: ${handoff.requiredChecks.map(check => `\`${check}\``).join(", ")}.\n` +
    `4. Когда результат готов, выполните \`node sdlc/scripts/submit-stage.mjs --handoff sdlc/handoffs/${handoff.featureId}.json\`. Скрипт проверит пакет, сделает commit и отправит его в текущую stage-ветку.\n` +
    `5. Не выполняйте merge и не меняйте итоговый статус feature: это делает только GitHub после human approval.\n\n` +
    `## Human gate\n\n` +
    `После push человек использует только GitHub PR: **Approve** либо **Request changes**.\n`
  );
}
