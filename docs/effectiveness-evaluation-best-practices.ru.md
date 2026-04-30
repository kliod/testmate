# Лучшие практики оценки эффективности AI-native quality gates

Этот документ описывает практичные и интеллектуально честные практики оценки AI-native систем качества, review и gating, похожих на TestMate.

Область применения - не обычный LLM chatbot. Целевая система анализирует изменения в коде, выполняет deterministic preflight checks, маршрутизирует работу к специализированным агентам, формирует structured decision contract, пишет audit logs и поддерживает решения в review, merge и release workflow через статусы `PASS`, `WARNING`, `BLOCK` и `NEED_INFO`.

## Что означает effectiveness

Effectiveness имеет два разных слоя, которые нельзя сводить в один score.

1. **Runtime decision quality**: насколько конкретное решение `PASS`, `WARNING`, `BLOCK` или `NEED_INFO` было корректным, объяснимым, достаточно воспроизводимым и полезным в момент принятия.
2. **Product and business effectiveness**: изменила ли система инженерное поведение ценным образом: меньше рискованных merge, лучшее покрытие тестами для значимых рисков, более быстрые или ясные review decisions, более явное принятие рисков и более высокая уверенность перед release.

Система не становится эффективной потому, что производит много findings. Она эффективна, когда помогает командам принимать лучшие инженерные решения при приемлемой цене в latency, внимании, деньгах и доверии.

## Типы метрик

Всегда явно маркируйте уровень уверенности в метриках.

- **Measured metrics**: прямо наблюдаемые факты, например runtime, decision status, schema validity, waiver count, tests added или был ли `BLOCK` resolved before merge.
- **Estimated metrics**: обоснованные приближения, например вероятно предотвращенные late-cycle defects или сэкономленное время на основе sampled evidence.
- **Inferred metrics**: косвенные выводы из паттернов, например risk reduction, improved review leverage или behavior change across teams.

Не представляйте estimated или inferred metrics как measured facts.

## Измерение product value

| Best practice | Зачем это важно | Что измерять | Чего не делать | Early stage | Mature stage |
| --- | --- | --- | --- | --- | --- |
| Измеряйте behavior change, а не активность инструмента | Отделяет "система что-то сказала" от "команда изменила поведение" | Measured: tests added, bugs fixed, PR changed, waiver created, merge delayed, merge blocked | Не считать run count или finding count product value | Critical | Critical |
| Отслеживайте цепочку decision-to-outcome | Связывает gate decisions с реальными workflow outcomes | Measured: decision -> follow-up action -> merge outcome -> post-merge issue. Estimated: prevented defect value | Не заявлять prevented defects без evidence и counterfactual humility | Manual tracking | Automated tracking |
| Отделяйте adoption от value | Использование не доказывает пользу | Measured: run frequency and repeated team use. Separately: action rate and accepted findings | Не считать DAU/MAU quality impact | Useful | Required |
| Измеряйте review leverage | Показывает, где система снижает нагрузку на senior engineering | Measured: actionable findings accepted without extended manual investigation; review comments replaced by structured gate output | Не заявлять линейную экономию времени без baseline | Interviews and samples | PR analytics and sampling |
| Честно отслеживайте avoided escalation | Дает business context без fake precision | Estimated: avoided late-cycle defect range using historical incident classes | Не публиковать точный dollar ROI без credible attribution | Qualitative ranges | Confidence-banded ranges |
| Сегментируйте по workflow mode | `pre_commit`, `pre_mr`, `pre_merge` и `pre_release` имеют разные value models | Measured: latency, block rate, override rate, and action rate per mode | Не смешивать local pre-commit и release gates в один score | Required | Required |
| Явно измеряйте user trust | Gate без доверия становится noise | Measured: override reasons, waiver quality, repeated disablement, maintainer feedback | Не считать отсутствие жалоб доверием | Lightweight feedback | Trust dashboard |

## Engineering and operational measurement

| Best practice | Зачем это важно | Что измерять | Чего не делать | Early stage | Mature stage |
| --- | --- | --- | --- | --- | --- |
| Определяйте latency budgets per mode | Quality gates не должны ломать developer flow | Measured: p50, p90, and p95 runtime by mode, repository size, and diff size | Не оптимизировать только average runtime | Critical | Critical |
| Мониторьте deterministic preflight health | Deterministic checks - фундамент надежных решений | Measured: parse failures, missing diff data, CI metadata failures, changed-file detection errors | Не прятать preflight failures внутри LLM prose | Critical | Critical |
| Оценивайте routing correctness | Неверный routing дает missed risks или лишнюю работу | Measured: expected agents vs selected agents on labeled samples | Не считать "more agents ran" лучшим качеством | Sample-based | Regression suite |
| Отслеживайте cost per useful decision | Удерживает platform economics в реальности | Measured: runtime cost, token cost, compute cost. Derived: cost per accepted finding or actioned decision | Не отслеживать cost per run без usefulness | Basic cost view | Optimization target |
| Обеспечивайте structured contract reliability | Gate output должен быть machine-checkable | Measured: JSON schema pass rate, missing fields, invalid statuses, audit log creation rate | Не принимать free-form output как production gate | Critical | Critical |
| Отслеживайте false stops и infrastructure failures | Operational failures нельзя смешивать с легитимным `NEED_INFO` | Measured: failed runs, partial runs, tool errors, missing logs | Не смешивать infra failures с valid uncertainty | Required | Required |
| Тестируйте сам gate | Quality system тоже может регрессировать | Measured: golden fixtures, known PR replays, stable output checks | Не тестировать только happy paths | Start in v1 | Required |

## Decision quality measurement

| Best practice | Зачем это важно | Что измерять | Чего не делать | Early stage | Mature stage |
| --- | --- | --- | --- | --- | --- |
| Стройте confusion matrix by decision class | Показывает calibration для `PASS`, `WARNING`, `BLOCK` и `NEED_INFO` | Measured on labeled samples: true block, false block, missed block, correct pass | Не сводить quality к одному accuracy score | Sample-based | Continuous eval |
| Используйте severity-weighted evaluation | Пропустить auth bug хуже, чем шумный CSS warning | Measured: correctness weighted by risk level and affected area | Не давать каждому finding одинаковый вес | Required | Required |
| Оценивайте test impact analysis accuracy | Это core value для TestMate-like system | Measured: predicted affected areas vs actual files and tests changed after review | Не вознаграждать vague recommendations | Required | Required |
| Измеряйте actionability | Findings должны давать понятные next steps | Measured: accepted findings, clarified findings, ignored findings with reason | Не вознаграждать длинные reports | Critical | Critical |
| Осторожно интерпретируйте overrides и waivers | Overrides не всегда failures | Measured: override reason, approver role, later outcome, repeated patterns | Не считать каждый override false positive | Required | Required |
| Отслеживайте regression test follow-through | Bug fixes должны вести к regression coverage или explicit waiver | Measured: tests added after `BLOCK` or `WARNING`; waiver if no test was added | Не заставлять писать low-value tests только для закрытия gate | Required | Required |
| Измеряйте `NEED_INFO` precision | `NEED_INFO` полезен только если действительно не хватает конкретного context | Measured: resolution rate, unnecessary `NEED_INFO` rate, time to resolution | Не использовать `NEED_INFO` как safe escape hatch | Required | Required |
| Проводите missed-risk postmortems | Escaped defects - лучшие evaluation data | Measured: post-merge defects mapped back to original gate decision | Не превращать это в blame | Manual RCA | Formal feedback loop |

## Governance, trust, and auditability

| Best practice | Зачем это важно | Что измерять | Чего не делать | Early stage | Mature stage |
| --- | --- | --- | --- | --- | --- |
| Пишите immutable audit logs | Decisions должны быть inspectable later | Measured: log completeness, inputs, agents run, commands, status, waiver data | Не хранить только final summary | Critical | Critical |
| Сохраняйте decision provenance | Команды должны понимать, что пришло из deterministic logic, а что из LLM reasoning | Measured: source attribution per finding: rule, preflight, LLM, test output, human override | Не смешивать evidence и speculation | Required | Required |
| Держите blocking policy as code | `BLOCK` должен быть predictable and governable | Measured: policy version, triggered rule, exception path | Не позволять LLM придумывать blocking policy | Critical | Critical |
| Управляйте human overrides | Нужен escape hatch, но не invisible one | Measured: who overrode, why, risk level, expiry, follow-up issue | Не делать override невозможным или неотслеживаемым | Required | Required |
| Поддерживайте replay and reproducibility | Позволяет debug disputed decisions | Measured: ability to replay same diff, context, policy, and model version | Не ожидать full determinism от LLM без snapshotting | v2 | Required |
| Мониторьте model and prompt drift | Model behavior может меняться | Measured: golden eval deltas by model, prompt, and policy version | Не менять model или prompt без baseline | Manual | Required |
| Делайте explanations evidence-based | Leaders нужны traceable reasoning, не confident prose | Measured: rationale quality, evidence links, affected files, tests, policy references | Не генерировать certainty без evidence | Required | Required |

## Metrics to collect in v1

v1 measurement system должен быть небольшим, надежным и outcome-oriented.

| Metric | Type | Почему это нужно в v1 |
| --- | --- | --- |
| Decision status distribution: `PASS`, `WARNING`, `BLOCK`, `NEED_INFO` | measured | Формирует baseline gate behavior |
| Risk level distribution | measured | Показывает, где система видит risk |
| Runtime p50, p90, p95 by mode | measured | Защищает developer experience |
| Audit log creation success rate | measured | Минимальное governance requirement |
| Structured contract schema validity | measured | Production readiness requirement |
| Follow-up action rate after non-`PASS` decisions | measured | Early value signal |
| Override and waiver rate with reason | measured | Calibration and trust signal |
| Tests added after decision | measured | Сильное evidence of changed engineering behavior |
| `BLOCK` resolved before merge | measured | Direct workflow impact |
| `NEED_INFO` resolution rate | measured | Проверяет, полезна ли uncertainty |
| Manual sample review of decisions | measured | Самая честная early decision-quality evaluation |

## Metrics to defer to v2 or v3

| Metric or practice | Type | Почему отложить |
| --- | --- | --- |
| Severity-weighted escaped defect reduction | inferred / estimated | Требует достаточно historical defect data |
| Cost of avoided defects | estimated | Требует mature incident taxonomy |
| Full confusion matrix by repo and team | measured | Требует labeled datasets |
| Model drift dashboard | measured | Полезно после стабилизации prompt and model policy |
| Automated counterfactual analysis | inferred | Легко превращается в pseudo-science |
| Predictive risk scoring | inferred | Опасно до накопления validated data |
| Team-level productivity impact | estimated | Много confounding variables |
| Cross-repository benchmarks | inferred | Repositories and team processes часто несопоставимы |

## Metrics that are usually misleading

| Metric | Почему вводит в заблуждение |
| --- | --- |
| Number of issues found | Вознаграждает noise and long reports |
| `BLOCK` rate as a success metric | High block rate может означать poor calibration |
| Single LLM accuracy score | Скрывает severity, risk class, false negatives и actionability |
| Tokens used without outcome context | Cost metric, not value metric |
| Time saved without baseline and sampling | Часто становится fictional ROI |
| Developer satisfaction without behavioral data | Sentiment может скрывать process problems |
| Pass rate | Может означать хорошее качество кода или blind gate |
| Accepted findings by count | Один auth finding может быть важнее многих cosmetic comments |

## Best practices for hybrid deterministic and LLM-driven systems

### Separate deterministic and LLM decision layers

Каждый важный decision element должен иметь provenance.

| Decision element | Preferred source |
| --- | --- |
| Changed files | Deterministic diff parser |
| Package and test runner detection | Deterministic preflight |
| Policy trigger | Deterministic rules |
| Risk classification | Rules plus LLM reasoning |
| Missing coverage explanation | LLM grounded in deterministic evidence |
| Final `BLOCK` eligibility | Policy-as-code |

LLM reasoning может рекомендовать, объяснять, классифицировать и синтезировать. Blocking policy должна быть explicit and versioned.

### Treat `BLOCK`, `WARNING`, and `NEED_INFO` as different products

`BLOCK` должен быть rare, explainable, policy-backed и иметь clear unblock path.

Measure:

- upheld block rate;
- resolved-before-merge rate;
- false block rate;
- override reason.

`WARNING` должен быть actionable, не decorative.

Measure:

- action rate;
- ignored-with-reason rate;
- repeated warning fatigue.

`NEED_INFO` должен точно указывать, какой context отсутствует.

Measure:

- resolution rate;
- unnecessary `NEED_INFO` rate;
- time to resolution.

Не используйте `WARNING` как dumping ground для uncertain LLM observations.

### Treat follow-up actions as part of the decision

Decision не завершен в момент emission JSON. Отслеживайте, что произошло дальше:

- tests added after the decision;
- code changed after a finding;
- waiver created;
- waiver expired or converted into an issue;
- `BLOCK` resolved;
- `WARNING` ignored with a reason;
- post-merge defect linked back to the original decision.

Без follow-up tracking система измеряет собственную речь, а не влияние на engineering behavior.

### Interpret overrides and waivers carefully

Override может означать несколько разных вещей:

- false positive;
- acceptable business risk;
- risk covered elsewhere;
- urgent hotfix;
- test infeasible now;
- incorrect context;
- duplicate finding;
- policy disagreement.

Override rate без reason taxonomy - слабое evidence. Его нельзя интерпретировать как automatic failure или automatic success.

### Evaluate tests added after decision

Tests added after a `BLOCK`, `WARNING` or `NEED_INFO` - один из сильнейших early value signals.

Measure:

- был ли добавлен unit, component, integration или e2e test;
- покрывает ли test risk, identified by system;
- был ли test добавлен before merge или after merge;
- был ли test required, recommended или manually chosen.

Не считайте любой новый test automatic success. Low-value tests, написанные только чтобы удовлетворить gate, могут снижать trust.

## Measuring outcome after a decision

Используйте decision-to-outcome chain:

```text
Change submitted
-> TestMate decision
-> Human or team action
-> Merge or release decision
-> Post-merge or post-release outcome
-> Feedback into policy and evaluation
```

Track each stage.

| Stage | What to record |
| --- | --- |
| Decision | status, risk, affected areas, required coverage, evidence |
| Action | code changed, tests added, waiver, override, no-op |
| Merge | merged, delayed, rejected, split PR, hotfix exception |
| After merge | incident, rollback, flaky failure, QA bug, no known issue |
| Feedback | true positive, false positive, false negative, policy adjustment |

Key distinction:

- "The system said X" is not impact.
- "Because the system said X, the team did Y, and risk Z was reduced or explicitly accepted" is impact.

## Measuring usefulness without analytics theater

Избегайте больших dashboards, которые не поддерживают decisions. Используйте несколько evidence loops.

### Monthly decision review sample

Review 20 to 50 decisions with a senior engineer and product or quality owner.

Classify each decision:

- correct, partially correct, or incorrect;
- actionable or not actionable;
- changed behavior or did not change behavior;
- false positive, false negative, or acceptable judgment call;
- policy issue, model issue, routing issue, or missing-context issue.

### Outcome-linked metrics only

Useful dashboard должен отвечать: what changed after the decision?

Prefer:

- follow-up action rate;
- tests added;
- block resolution;
- waiver reason;
- missed-risk register.

Avoid:

- raw finding count;
- raw run count;
- single quality score;
- unqualified time-saved claims.

### Use ranges for estimated value

Acceptable:

```text
Estimated: the system likely helped prevent 2-4 late-cycle defects this month, based on accepted BLOCK/WARNING findings that were fixed before merge.
Confidence: medium, because post-merge defect attribution is still manually reviewed.
```

Not acceptable:

```text
Saved $48,231 this month.
```

### Maintain false positive and false negative registers

Эти registers ценнее polished aggregate score.

Registers должны feed back into:

- deterministic rules;
- routing;
- prompt and model evaluation fixtures;
- policy thresholds;
- documentation and team education.

### Use qualitative evidence responsibly

Concrete example from a staff engineer, tied to a specific PR and outcome, can be more honest than a weak metric.

Qualitative evidence не должно заменять measurement, но может объяснять, почему measured impact важен.

## Explainable ROI narrative

Credible ROI narrative должна быть causal, range-based and evidence-backed.

Example:

```text
In the last month, TestMate ran on 143 PRs.
It produced 18 BLOCK decisions and 41 WARNING decisions.

Of those non-PASS decisions, 27 led to concrete follow-up actions:
- 14 regression tests added
- 8 code fixes before merge
- 3 explicit waivers
- 2 PRs split due to risk

In sampled review, 21 of 27 actions were judged meaningful by maintainers.

Estimated value: reduced late-cycle defect risk in auth, forms, and cache-sensitive areas.
Confidence: medium.
Limitation: post-merge defect attribution is still manual.
```

This separates:

- measured facts;
- estimated value;
- confidence;
- limitations.

Не используйте pseudo-precise ROI math, когда causal chain недостаточно сильна.

## Recommended minimum evaluation framework

Это minimum set of practices, который можно внедрить без перегрузки команды.

### 1. Instrument every run

Record:

- mode;
- scope;
- status;
- risk level;
- affected areas;
- subagents or rules triggered;
- required coverage;
- blockers and warnings;
- audit log path;
- deterministic vs LLM provenance.

### 2. Track five outcome metrics

| Metric | Type |
| --- | --- |
| Follow-up action rate after non-`PASS` | measured |
| Tests added after decision | measured |
| Override or waiver rate with reason | measured |
| `BLOCK` resolved before merge | measured |
| `NEED_INFO` resolved vs abandoned | measured |

### 3. Review samples weekly or biweekly

For 20 to 30 decisions, classify:

- correct / partially correct / incorrect;
- actionable / not actionable;
- changed behavior / no behavior change;
- false positive / false negative;
- policy issue / model issue / missing context.

### 4. Maintain two registers

Maintain:

- false positives and noisy findings;
- missed risks and escaped defects.

Use both to improve:

- deterministic preflight;
- routing;
- policies;
- prompts;
- test fixtures;
- documentation.

### 5. Keep `BLOCK` policy deterministic

LLM может recommend, classify, and explain. Blocking decision должен map to explicit policy and evidence.

### 6. Report value as an evidence narrative

Monthly reporting should include:

- measured outcomes;
- estimated impact ranges;
- representative examples;
- known limitations;
- next improvements to policy, routing, or model behavior.

## Executive summary

1. Оценивайте TestMate-like systems по outcomes after decisions, а не по числу findings или LLM activity.
2. Держите runtime decision quality отдельно от product and business effectiveness.
3. Лучшие v1 metrics: follow-up actions, tests added, overrides and waivers with reasons, `BLOCK` resolution, `NEED_INFO` resolution, schema validity, and audit reliability.
4. Рассматривайте `BLOCK`, `WARNING`, and `NEED_INFO` как разные decision products с разными quality bars.
5. Deterministic logic должен владеть policy, preflight, routing evidence, and auditability; LLM reasoning должен помогать с classification, explanation, and synthesis.
6. ROI должен быть evidence-based and range-based: сначала measured facts, затем estimated value, confidence and limitations always visible.
7. Practical minimum framework: instrument every run, review sampled decisions, track outcomes, maintain false-positive and false-negative registers, and evolve policy from evidence.
