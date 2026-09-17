# Аналитическая спецификация SDLC-CURSOR-001

## Текущее состояние

Для feature созданы ветка `feature/sdlc-cursor-001`, stage-ветка
`stage/sdlc-cursor-001/analysis/r1`, handoff schemaVersion 2 со статусом
`in_progress` и черновики артефактов. PR анализа открыт в feature-ветку.
Продуктовый код CRM в этом пилоте не меняется.

## Цель этапа

1. Зафиксировать бизнес-запрос пилота и границы (без изменений CRM).
2. Заполнить `analysis-spec.md` и `test-plan.md` проверяемыми критериями
   передачи аналитического пакета.
3. Выполнить `pnpm check` и `pnpm test`, затем `submit-stage.mjs`: commit и push
   в stage-ветку, `workStatus=ready_for_review`, без merge.
4. После GitHub **Approve** оркестратор должен создать этап `development-plan`
   (ветка, PR, workspace Issue). **Request changes** возвращает работу в тот же PR.

## Требования

- FR-1. Система должна принимать аналитический пакет только при наличии
  `business-request.md`, `analysis-spec.md` и `test-plan.md` в
  `sdlc/artifacts/SDLC-CURSOR-001/`.
- FR-2. Система должна выставлять `workStatus=ready_for_review` только через
  `submit-stage.mjs` в ветке `stage/sdlc-cursor-001/analysis/r1`.
- FR-3. Система должна блокировать merge stage-PR, пока handoff в статусе
  `in_progress` или не пройдены обязательные checks.
- FR-4. Система должна после Approve создавать следующий этап
  `development-plan` от tip feature-ветки; агент не выполняет merge сам.
- NFR-1. Система не должна требовать от Cursor хранения статуса feature вне Git
  и GitHub.

## Вне объёма

- Поля, API, миграции и UI CRM.
- Финальный PR `feature → main` и полный прогон всех ролей до QA (достаточно
  подтвердить переход analysis → development-plan).

## Критерии приёмки

- Given: заполнены три артефакта анализа и пройдены `pnpm check` / `pnpm test`.
  When: выполнен `submit-stage.mjs`. Then: в stage-ветке commit, push,
  `workStatus=ready_for_review`, merge не выполнен.
- Given: stage-PR готов к review. When: reviewer выбирает Approve. Then:
  появляются `stage/.../development-plan/r1`, PR и workspace Issue.
- Given: stage-PR с `in_progress`. When: пытаются merge. Then: stage check
  не проходит.

## Допущения

- Branch protection и auto-merge для `feature/**` уже включены, как в
  `sdlc/README.md`.
- Workspace-owners (`RuslanMarkin`) совпадают для analyst/developer/qa в пилоте.
- Достаточно доказать переход analysis → development-plan.

## Риски

- Сбой оркестратора после Approve оставляет feature без следующего этапа.
- Ошибочный merge без Approve нарушит human gate пилота.
- Изменение контракта handoff вне `workStatus` отклонит `submit-stage.mjs`.
