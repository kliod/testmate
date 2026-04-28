# Web Feature Coverage Matrix

| Feature Area | Required Coverage |
|---|---|
| Static UI | component smoke or visual only if shared/critical |
| Interactive component | component tests |
| Form | component + validation tests |
| Form with API submit | component/integration + API mocks |
| API read | integration with loading/error/empty/success |
| API mutation | integration with success/error/cache update |
| Auth | integration/e2e critical path |
| Permissions | role-based component/integration tests |
| Routing | route guard tests + e2e if critical |
| File upload | integration + e2e if business-critical |
| Tables/lists | filters/sort/pagination/empty/error |
| Search | query, empty results, loading, errors |
| Modal/dialog | open/close/focus/keyboard |
| Cache | invalidation/refetch/optimistic rollback |
| Visual shared component | Storybook + visual regression |
| Accessibility-sensitive UI | a11y automated + manual keyboard check |
| Production bug fix | regression test required |
| Critical user journey | E2E @critical |
