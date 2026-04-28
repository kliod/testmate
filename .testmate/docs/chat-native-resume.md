# Chat-Native NEED_INFO Resume Protocol

This protocol applies when TestMate is run by an AI IDE or LLM chat agent. In this mode, the chat agent is the orchestrator and must not launch `.testmate/testmate.mjs` unless the user explicitly asks for the CLI/CI runner.

## When To Return NEED_INFO

Return `NEED_INFO` only when missing information blocks a high-impact decision, such as:

- unknown role matrix for auth or permissions;
- missing API contract for a changed integration;
- undefined negative-path behavior for a critical form, route, or mutation;
- unclear product intent where guessing could produce a false `PASS`.

Do not use `NEED_INFO` for generic uncertainty. Ask at most three questions, and each question must state what decision it unblocks.

## Required Output Shape

When pausing in chat-native mode:

- set `status` to `NEED_INFO`;
- set `interaction.state` to `need_info`;
- set `interaction.blockedDecision`;
- populate `interaction.answersExpected`;
- mirror user-facing questions in `questionsForUser`;
- create the required audit log with the blocked decision and current evidence.

## Resume After User Answers

When the user answers:

1. Reuse the existing repository context, preflight facts, blocked decision, and audit trail from the current conversation.
2. Do not restart from scratch unless the diff changed materially or the previous context is unavailable.
3. Map each answer to the corresponding `interaction.answersExpected.id`.
4. Continue the blocked decision only.
5. Return a final `PASS`, `WARNING`, `BLOCK`, or another narrowly scoped `NEED_INFO`.

## Difference From CLI Resume

CLI mode persists resume state under `.testmate/state/` and resumes with:

```bash
node .testmate/testmate.mjs --resume=<token> --answers-file=<path>
```

Chat-native mode persists state in the conversation and audit log. It should not call the CLI runner to resume unless the user explicitly asks for CLI execution.

## Audit Expectations

The audit log for a chat-native `NEED_INFO` run should include:

- blocked decision;
- questions asked;
- evidence already inspected;
- residual risk if the user does not answer;
- the exact point where analysis should resume.
