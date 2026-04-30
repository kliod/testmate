# Архитектура телеметрии агентной работы TestMate

## Краткое резюме

- Командная телеметрия TestMate должна опираться на нормализованные записи `agent_work_run`, а не на сырые локальные файлы разработчиков.
- Локальные данные разработчика - это приватный исходный материал; CI artifacts - воспроизводимые командные доказательства; collector и aggregator - настоящий слой отчетности.
- Данные попадают в командные метрики только через явный экспорт, публикацию CI artifact или policy-governed upload.
- Каждая метрика должна сохранять источник и уровень достоверности: измерено, оценено, сообщено пользователем, выведено или недоступно.
- TestMate должен показывать evidence-aware quality work, а не фальшивый ROI, слежку за разработчиками или учет токенов, замаскированный под бизнес-ценность.

## Основная рекомендация

Нужна поэтапная гибридная архитектура. В v1 TestMate сохраняет локальные append-only records у разработчика и публикует artifacts для формальных CI gates. Отдельный scheduled/manual aggregator валидирует, дедуплицирует и собирает эти данные в sanitized reports. В v2 появляется легкий collector API для authenticated batch upload. В enterprise-версии добавляются tenant-scoped storage, retention controls, admin policy, IDE integrations и dashboard/reporting layers. Архитектура должна явно разделять local records, CI artifacts, normalized event storage, rollups и published reports, потому что у этих слоев разные свойства доверия и приватности.

## Почему отслеживания токенов недостаточно

Токены отвечают только на узкий вопрос: сколько model input/output было видно конкретному runtime. Они не показывают, предотвратил ли TestMate регрессию, было ли предупреждение валидным, имело ли высокорисковое изменение meaningful coverage, был ли добавлен тест после finding, и откуда пришли данные: от провайдера, инструмента, пользователя или оценки.

Работа TestMate может происходить в CLI, CI, ChatGPT, Codex, Cursor, других AI IDE, локальных моделях и ручном follow-up. Одни поверхности раскрывают provider-reported usage. Другие показывают только duration. Третьи не раскрывают почти ничего. Поэтому система телеметрии должна отдельно моделировать работу, evidence, риск, outcomes и visibility.

## Таксономия поверхностей выполнения

| Поверхность | Что можно измерить | Что оценивается | Что может быть недоступно | Рекомендуемая обработка |
| --- | --- | --- | --- | --- |
| `cli_api` | `runId`, mode, scope, duration, decision, risk, rules, model, provider usage | Стоимость модели по pricing table, human supervision | Фактическая invoice cost, post-run human effort | Автоматически писать `agent_work_run`. |
| `github_actions` | CI duration, PR metadata, formal decision, artifacts, exit status | Allocated CI cost, model cost при запуске через CLI | Human time, provider usage если скрыт wrapper | Публиковать workflow artifacts; опционально отправлять в collector. |
| `gitlab_ci` | Pipeline/job duration, MR metadata, formal decision, artifacts, exit status | Allocated CI cost, model cost | Human time, hidden provider usage | Публиковать job artifacts; опционально отправлять в collector. |
| `chatgpt_ui` | Manual summary, surface, outcome, follow-up link | Human time bucket, perceived risk | Tokens, actual compute cost, raw session metadata | Только manual record; не выводить точное usage. |
| `codex_desktop` | Tool-reported summary если доступен, duration если surface раскрывает | Human supervision, cost если billing недоступен | Raw token usage, actual platform cost, prompts | Manual или opt-in integration; маркировать confidence. |
| `cursor` | Plugin-reported session metadata при интеграции | Credits, cost, accepted work time | Exact provider usage, hidden IDE pricing | Plugin позже; manual entry в v1. |
| `claude_code` | CLI/session duration, tool calls при wrapper integration | Tokens/cost если нет provider-reported данных | Actual billing, prompts | Wrapper/export integration; маркировать источник. |
| `ai_ide_other` | Manual surface и outcome | Duration, cost, risk | Tokens, model, exact workflow | Generic advisory record с низким confidence. |
| `local_model` | Wall time, runtime, model name, hardware class | Energy/hardware allocation, token estimates | Actual cost, reliable token count | Показывать runtime/hardware отдельно; не монетизировать по умолчанию. |
| `local_openai_compatible` | Endpoint duration, model string, возможно usage | Provider identity, cost table | Actual billing если endpoint скрывает provider | Хранить как compatible endpoint, если не настроено иначе. |
| `manual_entry` | User-reported workflow, outcome, follow-up | Risk, duration, impact | Tokens, compute, exact metadata | Принимать с label `user_reported`. |
| `unknown` | Timestamp и известные safe fields | Почти все | Surface, provider, tokens, cost, duration | Принимать только если полезно; раскрывать unknown rate. |

## Предлагаемая архитектура

### Фаза 1: локальные записи и агрегация CI artifacts

Фаза 1 должна работать без центрального сервера.

Локальные файлы остаются приватными и gitignored:

```text
.testmate/state/agent_work.jsonl
.testmate/state/metrics.jsonl
.testmate/state/effectiveness.jsonl
.testmate/state/telemetry-upload-state.json
```

Формальные CI gates экспортируют artifacts:

```text
.testmate/export/testmate-agent-work.ndjson
.testmate/export/testmate-rollup.json
logs/
```

Scheduled aggregation job или ручной script скачивает CI artifacts, опционально принимает явные локальные exports, валидирует records, дедуплицирует по `runId` и формирует sanitized weekly/monthly reports.

### Фаза 2: центральный telemetry collector

Фаза 2 добавляет authenticated collector endpoint:

```text
POST /v1/telemetry/batches
```

Collector принимает batches из CI, CLI и будущих IDE plugins. Он валидирует schema, применяет privacy rules, дедуплицирует по `exportId` и `runId`, сохраняет normalized records и возвращает ingestion result.

### Фаза 3: enterprise telemetry platform

Enterprise-готовность требует tenant-scoped storage, SSO/OIDC/SAML, scoped API tokens, retention policies, admin telemetry modes, export/delete controls, GitHub/GitLab integrations, IDE integrations, provider cost configuration и leadership reporting.

## Единая схема агентной работы

```json
{
  "recordType": "agent_work_run",
  "schemaVersion": 1,
  "runId": "string",
  "parentRunId": "string | null",
  "timestamp": "ISO-8601",
  "teamId": "string | null",
  "repoId": "string | null",
  "projectId": "string | null",
  "actorHash": "string | null",
  "executionSurface": "cli_api | github_actions | gitlab_ci | chatgpt_ui | codex_desktop | cursor | claude_code | ai_ide_other | local_model | local_openai_compatible | manual_entry | unknown",
  "workflowType": "formal_gate | local_advisory | fixture_replay | follow_up_recording | manual_review",
  "mode": "pre_commit | pre_mr | pre_merge | pre_release | advisory | unknown",
  "analysisScope": "DIFF | AFFECTED | FULL | unknown",
  "decisionStatus": "PASS | WARNING | BLOCK | NEED_INFO | not_applicable",
  "riskLevel": "LOW | MEDIUM | HIGH | CRITICAL | unknown",
  "policyRulesTriggered": [],
  "modelProvider": "openai | anthropic | google | ollama | llama_cpp | lmstudio | vllm | local_openai_compatible | unknown",
  "model": "string | null",
  "isLocalModel": false,
  "inputTokens": null,
  "outputTokens": null,
  "cachedInputTokens": null,
  "totalTokens": null,
  "tokenSource": "provider_reported | tokenizer_estimated | user_reported | unavailable",
  "usageVisibility": "provider_reported | tool_reported | user_reported | estimated | unavailable",
  "durationMs": null,
  "toolCallsCount": null,
  "ciProvider": "github_actions | gitlab_ci | local | unknown",
  "ciDurationMs": null,
  "hardwareClass": "developer_laptop | ci_runner | gpu_workstation | cloud_runner | unknown",
  "computeCostUsd": null,
  "computeCostType": "actual | estimated | allocated | unavailable",
  "humanSupervisionMinutes": null,
  "humanTimeSource": "user_reported | reviewer_sample | estimated | unavailable",
  "privacyMode": "local_only | ci_aggregated | centralized | manual_export",
  "rawPromptStored": false,
  "rawDiffStored": false,
  "customerPayloadStored": false,
  "auditLogPath": "string | null",
  "toolErrorsCount": 0,
  "notes": "string | null"
}
```

Обязательные поля: identity, timestamp, surface, workflow, privacy и visibility. Для formal gates также обязательны mode, scope, decision, risk, policy rules и audit log reference, когда применимо. Token, cost, duration, hardware и human time fields nullable и должны оставаться `null`, если данные недоступны.

## Слои хранения телеметрии

| Слой | Содержимое | Хранилище | Передается дальше? | Назначение |
| --- | --- | --- | --- | --- |
| Local safe event buffer | Индивидуальные safe `agent_work_run` records | `.testmate/state/*.jsonl` | Только через explicit export или policy upload | Локальная история и источник экспорта. |
| Export batch | Sanitized records с batch metadata | `.testmate/export/*.ndjson` или JSON | Да | Транспортная единица. |
| CI artifact storage | CI-generated events, rollups, logs | GitHub/GitLab artifact storage | Да | Воспроизводимые командные доказательства. |
| Normalized event store | Validated deduplicated records | Collector DB/object storage | Внутренне | Reporting source. |
| Rollups | Counts и distributions по period/repo/surface | DB/object storage/generated JSON | Да | Быстрая отчетность. |
| Published reports | Sanitized Markdown/JSON/HTML | `docs/reports/`, artifacts, dashboard | Да | История для людей. |

Локальные `.testmate/state/*.jsonl` не являются командным source of truth. Это приватный исходный материал. Командный source of truth начинается после export/upload, validation и deduplication.

## Локальный буфер телеметрии разработчика

Локальные buffer files должны быть gitignored по умолчанию:

```text
.testmate/state/agent_work.jsonl
.testmate/state/metrics.jsonl
.testmate/state/effectiveness.jsonl
.testmate/state/telemetry-upload-state.json
```

Правила:

- По возможности append-only.
- Без raw prompts.
- Без raw diffs.
- Без file contents.
- Без secrets.
- Без customer payloads.
- Без автоматического включения в team metrics при `privacyMode: "local_only"`.

## Поток безопасного экспорта

Локальные данные попадают в командный pipeline только через safe export или policy-governed upload.

```text
local state
  -> select eligible records
  -> schema validation
  -> privacy validation
  -> source classification
  -> batch creation
  -> local file or collector upload
```

Примеры команд:

```bash
testmate telemetry export --out .testmate/export/testmate-agent-work.ndjson
testmate telemetry upload --input .testmate/export/testmate-agent-work.ndjson
```

Перед manual export TestMate должен показывать preview:

```text
Ready to export:
- records: 14
- prompts: 0
- raw diffs: 0
- customer payloads: 0
- unavailable usage: 9
```

Records, которые не проходят privacy validation, должны быть пропущены и показаны локально.

## Публикация CI artifacts

Публикация CI artifact означает сохранение сгенерированных файлов в artifact storage CI-провайдера. Это не commit в git и не upload в TestMate Cloud по умолчанию.

Для GitHub Actions:

```yaml
- name: TestMate Tier 2 (Integrity)
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    node scripts/testmate.mjs pre_mr
    node scripts/testmate.mjs --export-telemetry --out .testmate/export/testmate-agent-work.ndjson
    node scripts/testmate.mjs --rollup-telemetry --out .testmate/export/testmate-rollup.json

- name: Upload TestMate telemetry artifact
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: testmate-telemetry-${{ github.run_id }}-${{ github.run_attempt }}
    path: |
      .testmate/export/testmate-agent-work.ndjson
      .testmate/export/testmate-rollup.json
      logs/
    retention-days: 30
```

Для GitLab CI:

```yaml
testmate-quality-gate:
  stage: quality
  image: node:20-slim
  script:
    - node scripts/testmate.mjs pre_mr
    - node scripts/testmate.mjs --export-telemetry --out .testmate/export/testmate-agent-work.ndjson
    - node scripts/testmate.mjs --rollup-telemetry --out .testmate/export/testmate-rollup.json
  artifacts:
    when: always
    paths:
      - .testmate/export/testmate-agent-work.ndjson
      - .testmate/export/testmate-rollup.json
      - logs/
    expire_in: 30 days
```

CI artifact storage - временное техническое хранилище evidence. Для долгосрочных командных метрик нужен scheduled aggregation в sanitized reports или collector/database.

## Collector и aggregator

Collector и aggregator - разные роли.

Collector принимает telemetry batches:

```text
POST /v1/telemetry/batches
```

Он выполняет authentication, schema validation, privacy rules, deduplication, persistence accepted records и возвращает ingestion result.

Aggregator рассчитывает метрики:

```text
normalized events
  -> daily/weekly rollups
  -> reports
  -> dashboards
```

В v1 TestMate может обойтись без collector и запускать aggregator поверх GitLab/GitHub artifacts и manual exports:

```text
GitLab artifacts + manual exports
  -> scheduled aggregation job
  -> weekly report
```

## Формат batch

Телеметрия должна передаваться версионированными batches, а не произвольными JSON-файлами.

```json
{
  "batchType": "testmate_telemetry_export",
  "schemaVersion": 1,
  "exportId": "01HVEXPORT...",
  "createdAt": "2026-04-29T15:00:00Z",
  "teamId": "team_123",
  "repoId": "testmate",
  "privacyMode": "manual_export",
  "recordsCount": 1,
  "records": [
    {
      "recordType": "agent_work_run",
      "schemaVersion": 1,
      "runId": "01HVRUN...",
      "timestamp": "2026-04-29T14:30:00Z",
      "executionSurface": "cli_api",
      "workflowType": "formal_gate",
      "mode": "pre_mr",
      "analysisScope": "AFFECTED",
      "decisionStatus": "WARNING",
      "riskLevel": "HIGH",
      "usageVisibility": "provider_reported",
      "privacyMode": "ci_aggregated",
      "rawPromptStored": false,
      "rawDiffStored": false,
      "customerPayloadStored": false
    }
  ]
}
```

`exportId` - idempotency key для batch. `runId` - deduplication key для отдельных records.

## Формат rollup

Rollups - производные агрегаты. Их безопаснее публиковать, потому что они не содержат индивидуальную историю работы.

```json
{
  "recordType": "agent_work_rollup",
  "schemaVersion": 1,
  "rollupId": "team_123:testmate:2026-W18",
  "period": {
    "type": "week",
    "start": "2026-04-27",
    "end": "2026-05-03"
  },
  "teamId": "team_123",
  "repoId": "testmate",
  "runsTotal": 42,
  "byWorkflowType": {
    "formal_gate": 18,
    "local_advisory": 16,
    "follow_up_recording": 8
  },
  "byExecutionSurface": {
    "gitlab_ci": 12,
    "cli_api": 6,
    "codex_desktop": 10,
    "chatgpt_ui": 4,
    "cursor": 2,
    "manual_entry": 8
  },
  "byDecisionStatus": {
    "PASS": 21,
    "WARNING": 11,
    "BLOCK": 4,
    "NEED_INFO": 2,
    "not_applicable": 4
  },
  "usageVisibility": {
    "provider_reported": 12,
    "tool_reported": 6,
    "user_reported": 14,
    "estimated": 3,
    "unavailable": 7
  },
  "costTotalsUsd": {
    "actual": 18.42,
    "estimated": 6.1,
    "allocated": null,
    "unavailableRuns": 20
  },
  "followUp": {
    "testsAdded": 7,
    "issuesOpened": 5,
    "waiversAccepted": 2,
    "overridesRecorded": 1,
    "noActionRecorded": 3
  },
  "dataQuality": {
    "recordsWithEvidenceLink": 19,
    "recordsWithReasonCode": 24,
    "recordsWithReviewedBy": 11,
    "unknownUsageRate": 0.1667
  }
}
```

Actual, estimated, allocated и unavailable values должны оставаться раздельными.

## Policy-governed telemetry daemon

Daemon - это policy-governed uploader для safe TestMate telemetry, а не activity monitor.

Он должен читать только локальный safe buffer TestMate:

```text
.testmate/state/agent_work.jsonl
.testmate/state/metrics.jsonl
.testmate/state/effectiveness.jsonl
.testmate/state/telemetry-upload-state.json
```

Цикл daemon:

```text
wake up
  -> acquire lock
  -> read safe local records
  -> select non-exported runIds
  -> apply policy
  -> privacy validation
  -> create batch
  -> upload
  -> wait for ack
  -> mark accepted runIds as exported
  -> retry failed records with backoff
```

Daemon не должен сканировать IDE history, chat transcripts, raw git diffs, prompts, file contents или произвольные project files.

Пример policy:

```json
{
  "telemetry": {
    "mode": "auto_upload",
    "collectorUrl": "https://telemetry.company.dev",
    "autoUpload": {
      "enabled": true,
      "allowedWorkflows": ["formal_gate", "fixture_replay", "follow_up_recording"],
      "requireConsentForAdvisory": true,
      "allowedSurfaces": ["cli_api", "gitlab_ci", "github_actions"],
      "denySurfaces": ["chatgpt_ui", "codex_desktop", "cursor"],
      "maxBatchSize": 100,
      "intervalMinutes": 60
    }
  }
}
```

Ack должен прийти до обновления local exported state. Retries безопасны, потому что collector дедуплицирует по `exportId` и `runId`.

## Политика автоматической выгрузки

| Источник данных | Auto export | Auto upload | Default |
| --- | --- | --- | --- |
| GitLab/GitHub CI gate | Да | Да, если collector настроен | Разрешено |
| Local CLI formal gate | Да | Opt-in | Осторожно |
| Fixture replay | Да | Opt-in или CI-only | Разрешено |
| Follow-up record | Да | Opt-in | Осторожно |
| ChatGPT/Codex/Cursor advisory | Нет | Только explicit consent | Manual |
| Raw local state | Нет | Никогда | Запрещено |

## End-to-end pipeline

```text
Developer local work
  -> local safe event buffer
  -> export/upload if policy allows

GitLab/GitHub CI formal gate
  -> CI artifacts
  -> optional collector upload

Collector/Aggregator
  -> schema validation
  -> privacy validation
  -> dedupe by runId/exportId
  -> classify by surface/source
  -> join with follow-up outcomes
  -> build rollups
  -> publish reports
```

Team-level reporting view строится только из validated, deduplicated, source-labeled records.

## Правила агрегации

1. Валидировать до ingest.
2. Выполнять privacy checks до upload.
3. Дедуплицировать records по `runId`.
4. Использовать `exportId` как batch idempotency key.
5. Retries не должны раздувать metrics.
6. Связывать reruns через `parentRunId` или attempt metadata.
7. Не сворачивать actual, estimated, allocated и unavailable cost в один unlabeled total.
8. Advisory и formal gate metrics должны оставаться разделимыми.
9. Исключать `local_only` records из team metrics.
10. Коммитить только sanitized rollups/reports, никогда individual event streams.

## Приватность и governance

Обязательные controls:

- Не хранить raw prompts.
- Не хранить raw diffs.
- Не хранить secrets.
- Не хранить customer payloads.
- Не хранить full file contents.
- Не допускать unapproved developer surveillance.
- Псевдонимизировать actor identifiers через team-controlled salt.
- Поддерживать режимы `local_only`, `manual_export`, `ci_aggregated` и `centralized`.
- Отделять formal audit logs от aggregate telemetry.
- Поддерживать retention, export и deletion controls.
- Делать telemetry disablement явным.
- Показывать unknown/unavailable rates.

## Модель отчетности

Leadership reporting должен включать:

- Decision distribution.
- Risk distribution.
- High-risk coverage.
- Waiver and override quality.
- Follow-up conversion.
- Event quality coverage.
- Local advisory vs CI gate split.
- Execution surface distribution.
- Model/provider distribution where known.
- Token usage where available.
- Compute/runtime cost where available.
- Human supervision estimates where available.
- Unknown and unavailable data disclosures.

Reports должны отдельно показывать measured facts, estimated values, inferred conclusions и unavailable data.

## Чего избегать

- Не хранить prompts, diffs, secrets, customer payloads или full file contents.
- Не считать local developer buffers командным source of truth.
- Не выводить exact usage для surfaces, которые его не раскрывают.
- Не превращать local model runtime в cost без team-configured cost model.
- Не смешивать measured cost, estimated cost и unavailable cost в одно unlabeled number.
- Не использовать telemetry как employee surveillance.
- Не сворачивать decision quality, cost, coverage и follow-up в один score.
- Не коммитить individual telemetry event streams в git.

## Рекомендуемый roadmap

### Ближайший этап

1. Определить `agent_work_run` schema v1 и validation.
2. Emit CI artifacts для formal gates.
3. Добавить safe export и rollup commands.
4. Генерировать static reports из artifacts и manual exports.

### Средний этап

1. Добавить manual advisory recording.
2. Добавить scheduled GitLab/GitHub artifact aggregation.
3. Добавить policy-governed local upload.
4. Добавить collector API и deduplication.

### Позже

1. Добавить tenant-scoped enterprise storage.
2. Добавить admin privacy policies и retention controls.
3. Добавить optional IDE/Codex/Cursor integrations.
4. Добавить dashboards и signed report exports.

## Финальный C-level вывод

Командная телеметрия TestMate должна рассматривать локальные данные разработчиков как приватный исходный материал, CI artifacts как воспроизводимые командные доказательства, а collector/aggregator outputs как настоящий слой отчетности. Данные попадают в team metrics только через explicit export, CI artifact publication или policy-governed upload. Каждое значение должно сохранять source и confidence label. Это делает TestMate полезным для engineering leadership, не превращая его в developer surveillance или fake ROI accounting.

