# Bug Report – The Untested API

Found by writing tests first (`task-api/tests/`) and running them against the **original** code.
Tests tagged `[BUG]` encode the correct behaviour; they failed before the fixes and pass now.

## Fixed

| # | Bug | Where | Expected | Actual | How found | Fix |
|---|-----|-------|----------|--------|-----------|-----|
| 1 | **Pagination skips page 1** | `taskService.getPaginated` – `offset = page * limit` | `?page=1&limit=10` returns tasks 1-10 | Returns tasks 11-20 (first page is unreachable; page 1 with <=10 tasks is empty) | Integration test: create 15 tasks, request page 1 | `offset = (page - 1) * limit` |
| 2 | **Status filter uses substring match** | `taskService.getByStatus` – `t.status.includes(status)` | Exact match only | `?status=do` returns both `todo` and `done`; `?status=progress` matches `in_progress` | Unit test with `getByStatus('do')` | `t.status === status` |
| 3 | **Completing a task wipes its priority** | `taskService.completeTask` – hard-codes `priority: 'medium'` | Only `status` and `completedAt` change | A `high` task becomes `medium` after `/complete` | Test that creates a `high` task, completes it, checks priority | Removed the `priority` override |
| 4 | **Malformed JSON returns 500** | `app.js` error handler treats every error as 500 | 400 (client error) with a clear message | 500 "Internal server error" and a stack trace in the logs | Integration test posting `{"title": ` | Handler maps `entity.parse.failed` (and other 4xx body-parser errors, e.g. 413) to their proper status |
| 5 | **PUT allows overwriting server-managed fields (mass assignment)** | `taskService.update` – `{ ...task, ...fields }` | Client can't change `id`, `createdAt`, `completedAt` | `PUT {"id":"x","createdAt":"2000-..."}` rewrites them; changing `id` orphans the task | Test sending `id`/`createdAt` in the body | Whitelist: only `title, description, status, priority, dueDate` are copied |
| 6 | **Status filter silently ignores pagination; pagination params aren't validated** | `routes/tasks.js` – `if (status) return ...` runs before pagination; `parseInt(page) \|\| 1` | `?status=done&page=2&limit=5` is paginated; `page=-1` / `limit=abc` rejected | Filter returns everything; `page=-1` gives a negative offset (`slice(-10, 0)`); `limit=0` silently becomes 10 | Integration tests for combined params and bad values | New `validatePagination` (positive integers only, `limit` capped at 100 -> 400 on bad input); service takes optional `status` |

## Found but NOT fixed (documented for follow-up)

| # | Issue | Where | Why it matters / suggested fix |
|---|-------|-------|--------------------------------|
| 7 | `PUT` with `status: "done"` does not set `completedAt` (and moving away from `done` doesn't clear it) | `taskService.update` | `completedAt` and `status` can disagree. Fix: derive `completedAt` from status transitions inside the service. |
| 8 | Completing an already-completed task overwrites the original `completedAt` | `taskService.completeTask` | Loses the real completion time. Fix: return the task unchanged if already `done`. |
| 9 | `create`/`update` return the live object stored in the array | `taskService` | A caller mutating the returned object mutates the store. Fix: return copies (`{ ...task }`). |
| 10 | Validators use truthiness (`body.status && ...`, `body.dueDate && ...`) | `validators.js` | An empty string / `0` skips validation; `description`/`priority` types aren't checked; `Date.parse` accepts odd strings like `"2020"`. |
| 11 | Unknown `?status=` value returns `200 []` instead of `400` | `routes/tasks.js` | Typos look like "no tasks". Left as-is to avoid a behaviour change not asked for. |
| 12 | No auth, no rate limiting, in-memory store | whole app | Fine for the exercise; not for production (see questions below). |

## Coverage (`npm run coverage`)

```
All files        |   97.35 |    96.36 |   94.28 |   97.64
 routes/tasks.js |     100 |      100 |     100 |     100
 taskService.js  |     100 |    95.65 |     100 |     100
 validators.js   |     100 |    98.07 |     100 |     100
 app.js          |   78.26 |    81.81 |      50 |   81.81   (server bootstrap + 500 branch)
Tests: 97 passed
```
