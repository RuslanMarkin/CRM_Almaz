# Git-native SDLC-пилот

Git, GitHub PR и CI — единственный источник истины о состоянии feature. Cursor
используется как рабочая среда агента или человека, но не как система статусов.
Единственное ручное действие в штатном переходе — GitHub **Approve** либо
**Request changes**. После approval GitHub включает auto-merge; merge ждёт
обычные обязательные CI-checks и затем создаёт следующий этап.

## Модель веток

```text
main
└── feature/cp-status-002
    ├── stage/cp-status-002/analysis/r1
    ├── stage/cp-status-002/development-plan/r1
    ├── stage/cp-status-002/development/r1
    └── stage/cp-status-002/qa/r1
```

Каждая `stage/*`-ветка создаётся от текущего tip feature-ветки, вливается только
обратно в неё и после этого удаляется. Когда QA-этап утверждён, workflow создаёт
единственный финальный PR `feature/<id> → main`.

Нельзя использовать имена `feature/<id>` и `feature/<id>/analysis` одновременно:
Git refs конфликтуют. Поэтому для временных веток выбран отдельный префикс
`stage/<id>/…`.

## Что лежит в Git

- `artifacts/<feature-id>/` — запрос, спецификация, план, отчёты и текущий
  `TASK.md` для Cursor Agent;
- `handoffs/<feature-id>.json` — version 2 контракт этапа: роль, ветки, SHA
  источника, обязательные артефакты и `workStatus`;
- GitHub PR review, merge SHA и CI statuses — доказательство решения человека;
- GitHub Issue с машиночитаемым `sdlc-workspace-task` — доставка задания в
  локальный workspace-agent.

`workStatus=ready_for_review` можно выставить только командой
`submit-stage.mjs`, которая проверяет контракт и работает исключительно в
соответствующей stage-ветке. PR с `in_progress` намеренно не проходит stage
check и не может быть merged.

## Запуск пилота

1. В GitHub запустите workflow **«Создать Git-native SDLC feature»** и задайте
   `feature_id`, название, запрос и GitHub logins соответствующих workspace-agent.
   Он создаст `feature/<id>`, `stage/<id>/analysis/r1`, аналитический PR и Issue
   с заданием для workspace-agent.
2. На машине роли настройте Cursor Agent и Git-клон с правом push только в этот
   репозиторий. Не используйте личный токен с доступом ко всем репозиториям.
3. Запустите dispatcher. Он получает только открытые Issue, назначенные данному
   GitHub login, и создаёт изолированный worktree для точной stage-ветки:

   ```bash
   export GITHUB_TOKEN=github_pat_...
   node sdlc/scripts/workspace-dispatcher.mjs \
     --repository RuslanMarkin/CRM_Almaz \
     --login <github-login-роли> \
     --clone /absolute/path/to/CRM_Almaz \
     --workspace-root /absolute/path/to/sdlc-workspaces \
     --open --run-agent
   ```

   По умолчанию Cursor Agent запускается без `--force`: команды, требующие
   разрешения, не выполняются без его политики. Добавлять `--unattended` можно
   только для выделенного service account и изолированного пилотного репозитория:
   этот флаг передаёт Cursor CLI `--force`.

4. Агент читает `TASK.md`, создаёт выходные артефакты или код и в конце запускает
   `submit-stage.mjs`. Скрипт создаёт commit и push, но никогда не делает merge.
5. Проверяющий в GitHub выбирает **Approve** либо **Request changes**. При
   approval workflow создаёт следующую stage-ветку, PR и workspace Issue;
   при request changes агент исправляет тот же PR и отправляет его повторно.

Для Cursor CLI можно указать другой бинарник через `CURSOR_AGENT_COMMAND`; по
умолчанию используется `cursor-agent`. Workspace-agent не требует прямого
входящего доступа к рабочей машине: он poll'ит только назначенные ему GitHub
Issues. `--once` выполняет один безопасный опрос, постоянный режим используется
для рабочего компьютера или выделенной VM.

## Защита и наблюдаемость

Перед пилотом включите для `main` и `feature/**` branch protection: требовать
PR, успешные checks, approval назначенного reviewer/Code Owner и сброс approval
после новых коммитов. Также включите GitHub auto-merge. Workflow может включить
auto-merge, но не обходит эти правила.

В trace должны попадать только `featureId`, роль, stage/revision, branch, PR URL,
merge SHA, reviewer и результаты checks. Полные тексты артефактов в трейс не
копируются. Legacy handoff `CP-STATUS-001` поддерживается валидатором в период
миграции; новый pipeline работает только с `schemaVersion: 2`.

## Локальные проверки

```bash
pnpm test:sdlc
pnpm sdlc:validate
```
