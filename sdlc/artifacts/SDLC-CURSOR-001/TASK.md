# SDLC-CURSOR-001: Пилот Cursor SDLC

Этап: **analysis**, ревизия 1.

## Вход

- `sdlc/artifacts/SDLC-CURSOR-001/business-request.md`
- `sdlc/artifacts/SDLC-CURSOR-001/test-plan.md`
- `sdlc/artifacts/SDLC-CURSOR-001/analysis-spec.md`

## Ожидаемый результат

- `sdlc/artifacts/SDLC-CURSOR-001/business-request.md`
- `sdlc/artifacts/SDLC-CURSOR-001/analysis-spec.md`
- `sdlc/artifacts/SDLC-CURSOR-001/test-plan.md`

## Правила выполнения

1. Работайте только в ветке `stage/sdlc-cursor-001/analysis/r1`; её base — `feature/sdlc-cursor-001`.
2. Не меняйте утверждённые артефакты предыдущих этапов: создавайте новую ревизию через возврат этапа.
3. Выполните обязательные проверки: `pnpm check`, `pnpm test`.
4. Когда результат готов, выполните `node sdlc/scripts/submit-stage.mjs --handoff sdlc/handoffs/SDLC-CURSOR-001.json`. Скрипт проверит пакет, сделает commit и отправит его в текущую stage-ветку.
5. Не выполняйте merge и не меняйте итоговый статус feature: это делает только GitHub после human approval.

## Human gate

После push человек использует только GitHub PR: **Approve** либо **Request changes**.
