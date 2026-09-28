# Bug Report – The Untested API

Found by writing tests first (`task-api/tests/`) and running them against the **original** code.
Tests tagged `[BUG]` encode the correct behaviour; they failed before the fixes and pass now.

## Fixed (8)

| # | Bug | Where | Expected | Actual | How found | Fix |
|---|-----|-------|----------|--------|-----------|-----|
| 1 | **Pagination skips page 1** | `taskService.getPaginated` – `offset = page * limit` | `?page=1&limit=10` returns tasks 1-10 | Returns tasks 11-20 (first page is unreachable; page 1 with <=10 tasks is empty) | Integration test: create 15 tasks, request page 1 | `offset = (page - 1) * limit` |
| 2 | **Status filter uses substring match** | `taskService.getByStatus` – `t.status.includes(status)` | Exact match only | `?status=do` returns both `todo` and `done`; `?status=progress` matches `in_progress` | Unit test with `getByStatus('do')` | `t.status === status` |
| 3 | **Completing a task wipes its priority** | `taskService.completeTask` – hard-codes `priority: 'medium'` | Only `status` and `completedAt` change | A `high` task becomes `medium` after `/complete` | Test that creates a `high` task, completes it, checks priority | Removed the `priority` override |
| 4 | **Malformed JSON returns 500** | `app.js` error handler treats every error as 500 | 400 (client error) with a clear message | 500 "Internal server error" and a stack trace in the logs | Integration test posting `{"title": ` | Handler maps `entity.parse.failed` (and other 4xx body-parser errors, e.g. 413) to their proper status |
| 5 | **PUT allows overwriting server-managed fields (mass assignment)** | `taskService.update` – `{ ...task, ...fields }` | Client can't change `id`, `createdAt`, `completedAt` | `PUT {"id":"x","createdAt":"2000-..."}` rewrites them; changing `id` orphans the task | Test sending `id`/`createdAt` in the body | Whitelist: only `title, description, status, priority, dueDate` are copied |
| 7 | **`PUT` status change leaves `completedAt` out of sync** | `taskService.update` | `PUT {status:"done"}` sets `completedAt`; moving back out of `done` clears it | `completedAt` stays `null` on a done task (and stays set after re-opening) | Test: PUT status=done, assert `completedAt` | Derive `completedAt` from status transitions in the service |
| 8 | **Completing twice overwrites the original `completedAt`** | `taskService.completeTask` | Second call is a no-op; original completion time kept | Timestamp is replaced on every call | Unit test with fake timers (two calls, months apart) | Return the task unchanged if it is already `done` |
| 6 | **Status filter silently ignores pagination; pagination params aren't validated** | `routes/tasks.js` – `if (status) return ...` runs before pagination; `parseInt(page) \|\| 1` | `?status=done&page=2&limit=5` is paginated; `page=-1` / `limit=abc` rejected | Filter returns everything; `page=-1` gives a negative offset (`slice(-10, 0)`); `limit=0` silently becomes 10 | Integration tests for combined params and bad values | New `validatePagination` (positive integers only, `limit` capped at 100 -> 400 on bad input); service takes optional `status` |

## Found but NOT fixed (4, documented for follow-up)

| # | Issue | Where | Why it matters / suggested fix |
|---|-------|-------|--------------------------------|
| 9 | `create`/`update` return the live object stored in the array | `taskService` | A caller mutating the returned object mutates the store. Fix: return copies (`{ ...task }`). |
| 10 | Validators use truthiness (`body.status && ...`, `body.dueDate && ...`) | `validators.js` | An empty string / `0` skips validation; `description`/`priority` types aren't checked; `Date.parse` accepts odd strings like `"2020"`. |
| 11 | Unknown `?status=` value returns `200 []` instead of `400` | `routes/tasks.js` | Typos look like "no tasks". Left as-is to avoid a behaviour change not asked for. |
| 12 | No auth, no rate limiting, in-memory store | whole app | Fine for the exercise; not for production (see questions below). |

## Evidence: tests run against the ORIGINAL code

The first commit adds the tests only. Running `npm test` on it (before any fix) gave failures such as:

```
✕ [BUG] ?page=1&limit=10 returns the first 10 tasks
✕ [BUG] does not do substring matching ("do" must not match "todo"/"done")
✕ [BUG] keeps the task priority (does not reset it to "medium")
✕ [BUG] malformed JSON returns 400 (client error), not 500
✕ [BUG] cannot overwrite id / createdAt / completedAt through the body
✕ [BUG] status filter and pagination work together
```

After the fixes every one of them passes. To reproduce: `git checkout <first test commit> -- task-api/tests` on top of the original `src/`.

## Coverage (`npm run coverage`)

```
All files        |    97.4 |   96.61 |   94.28 |   97.68
 routes/tasks.js |     100 |     100 |     100 |     100
 taskService.js  |     100 |     100 |     100 |     100
 validators.js   |     100 |   98.07 |     100 |     100
 app.js          |   78.26 |   81.81 |      50 |   81.81   (server bootstrap + 500 branch)
Tests: 102 passed
```
`jest.config.js` enforces an 80% threshold, so a coverage drop fails the run (and CI).
