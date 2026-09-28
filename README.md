# Task Manager API + Task Desk UI

Take-home assignment: **The Untested API**. Node.js, Express, Jest, Supertest, plus a small web UI.

- **Live app:** `<add your Render URL here>`
- **API base:** same URL (e.g. `GET /tasks`)
- **CI:** GitHub Actions runs the tests on Node 18/20/22 (`.github/workflows/ci.yml`)
- **Bug report:** [BUG_REPORT.md](BUG_REPORT.md)  |  **Original brief:** [ASSIGNMENT.md](ASSIGNMENT.md)

## Run locally

```bash
cd task-api
npm install
npm start          # http://localhost:3000  (UI at /, API at /tasks)
npm test           # 102 tests
npm run coverage   # ~97% statements
```

## What was done

| Part | Status |
|------|--------|
| Day 1 – unit + integration tests, 80%+ coverage | 102 tests, ~97% coverage (`task-api/tests/`) |
| Part A – bug report | 8 bugs fixed, 4 more documented ([BUG_REPORT.md](BUG_REPORT.md)) |
| Part B – fix a bug | Fixed bugs #1-#8 (each has a `[BUG]`-tagged test that failed before the fix) |
| Part C – `PATCH /tasks/:id/assign` | Implemented + tested |
| Bonus – front end | `task-api/public/index.html`, served by Express (single deployable service) |

Commit history is intentional: the first commit contains tests that fail against the original code,
the next ones contain the fixes and the feature.

## `PATCH /tasks/:id/assign`

```bash
curl -X PATCH localhost:3000/tasks/<id>/assign -H "Content-Type: application/json" -d '{"assignee":"Asha"}'
```

Design decisions:

- **Empty / whitespace-only / missing / non-string `assignee` -> 400.** Un-assigning is a different intent and should be an explicit operation, not a side effect of sending `""`.
- **Trimmed and capped at 100 chars**, so `"  Asha "` and `"Asha"` are the same person and the UI can't be broken by huge values.
- **Already assigned -> allowed, replaces the assignee** (200). Blocking with 409 would force a "clear first" step for a routine hand-off. Trade-off: no audit trail of who it was assigned to before.
- **Unknown id -> 404.** Validation runs before the lookup, matching the existing `PUT` convention.
- Works on tasks in any status (including `done`) because "who did this" is still useful information.
- New tasks now include `assignee: null`. `PUT` cannot set `assignee`; only this endpoint can.

## Other API changes (all covered by tests)

- Pages are 1-indexed; invalid `page`/`limit` -> 400; `limit` capped at 100; `status` and pagination combine.
- Unknown routes return JSON 404; `GET /health` added for the host's health check.

## Notes for the reviewer

**What I'd test next:** concurrency (rapid parallel writes), very large payloads / unicode titles, timezone edge cases around `dueDate` and "overdue", property-based tests for pagination, and a contract test for the UI <-> API.

**What surprised me:** `completeTask` silently resetting priority to `medium` (looks like a leftover, and only a test that checks a non-default priority catches it), and that `getByStatus` used `includes` on a string, so a typo-like filter still "works" and hides the bug.

**Questions before production:** Who can see/modify which tasks (auth, per-user tasks)? Is a real database required (persistence, IDs, concurrent writes)? Should assignees be real user ids instead of free-text names? Should un-assign / assignment history exist? What are the expected list sizes (cursor pagination, sorting, search)?

## Deploy (Render, free tier)

1. Push this repo to your GitHub.
2. Render -> New -> **Blueprint** -> pick the repo (it reads `render.yaml`), or New -> Web Service with root dir `task-api`, build `npm install`, start `npm start`.
3. Paste the resulting URL at the top of this README and in your submission.

The free tier sleeps after inactivity, so the first request can take ~30 s; open the URL once before submitting.
