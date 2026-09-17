# План QA: SDLC-CURSOR-001

| ID | Сценарий | Ожидаемый результат | Критичность |
| --- | --- | --- | --- |
| SC-01 | В артефактах analysis есть business-request, analysis-spec и test-plan без черновых заглушек | Пакет готов к review | высокая |
| SC-02 | Выполнить `pnpm check` и `pnpm test` на stage-ветке | Checks зелёные | высокая |
| SC-03 | Запустить `submit-stage.mjs` для handoff SDLC-CURSOR-001 | Commit+push в stage-ветку, `workStatus=ready_for_review`, merge не выполнен | высокая |
| SC-04 | Проверить stage-PR при `in_progress` | `validate-stage-pr` / stage check не пропускает merge | высокая |
| SC-05 | Approve stage-PR анализа | Созданы ветка/PR/Issue этапа `development-plan` | высокая |
| SC-06 | Request changes на том же PR | Новый этап не создаётся; доработки идут в тот же PR | средняя |
| SC-07 | Убедиться, что diff stage-PR не меняет продуктовый код CRM | Изменения только в `sdlc/artifacts/SDLC-CURSOR-001/` и handoff | средняя |

QA фиксирует фактический результат и ссылки на PR/checks в отчёте следующего этапа.
