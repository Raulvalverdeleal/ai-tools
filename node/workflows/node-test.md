---
description: Testing Workflow
---

# Testing Workflow

<!-- ================================================================
  WORKFLOW VARIABLES
  Before running, ensure all variables below are configured.
  If a variable is unset (?), the agent will ask the user and
  update this file automatically before continuing.
================================================================ -->

```yaml
# workflow.config
test_folder: ?                  # e.g. test/ or __tests__ or src/**/*.test.ts
file_naming: ?                  # camelCase | kebab-case | snake_case
mock_database: ?                # true | false
mock_policy: ?                  # description of what to mock and why
```

---

## 0. Bootstrap (run once)

Before doing anything else, read the `workflow.config` block above.

For each variable still set to `?`:
1. Ask the user the corresponding question (see table below).
2. Once answered, **edit this file** and replace `?` with the user's answer.
3. Continue — do not ask again in future runs.

| Variable | Question to ask the user |
|---|---|
| `test_folder` | Where are your test files located? (e.g. `test/`, `__tests__/`, `src/**/*.spec.ts`) |
| `file_naming` | What naming convention do test files use? (`camelCase`, `kebab-case`, `snake_case`) |
| `mock_database` | Should the database be mocked, or is a real test DB available? (`true` = mock it / `false` = use real DB) |
| `mock_policy` | Besides the database, what else should be mocked? (e.g. "only external APIs and third-party services") |

Once all variables are set, proceed from step 1.

---

## 1. Identify changed code

Get the current branch:

```bash
git branch --show-current
```

If the branch **is not** `main`, compare against main:

```bash
git diff main...HEAD
git diff main...HEAD --name-only
```

If the branch **is** `main`, get the commits not yet pushed:

```bash
git diff origin/main..HEAD
git diff origin/main..HEAD --name-only
```

Also check for uncommitted changes:

```bash
git status
git diff
```

Note the affected functions, classes, routes, and middlewares.

---

## 2. Analyze impact

For each changed file, trace:
- Which routes or middlewares are affected.
- Which service/controller/util functions are involved.
- Whether the change affects input validation, auth, DB access, or external calls.

---

## 3. Locate existing tests

Search in `{{test_folder}}`:

```bash
grep -r "functionName\|keyword" {{test_folder}}
grep -r "routePath" {{test_folder}}
grep -r "describe\|it(" {{test_folder}} | grep "keyword"
```

Map each changed unit to its test file. If a test file exists, read it fully before writing anything new.

---

## 4. Decide whether to create a test

Create a test if any of these apply:
- The changed function has business logic, validation, or error handling.
- It's a route handler (any HTTP method).
- It handles auth, permissions, or sensitive data.
- The bug/feature is non-trivial.

Skip if the change is purely cosmetic (formatting, renaming with no logic change).

---

## 5. Create the test

Before writing anything, read `{{test_folder}}` to understand the conventions — syntax, structure, helpers, setup/teardown, and assertion style. Match them exactly.

**File naming:** `{{file_naming}}`

**File creation policy:**
If a test file for the same topic already exists, append the new test at the end of that file. Do not create a new file.

**Mocking policy:**
- Database: `mock_database: {{mock_database}}`
- Everything else: `{{mock_policy}}`

**Coverage rules by test type:**

- **Unit** — one function in isolation. Cover: happy path, edge cases, invalid inputs, thrown errors.
- **Integration** — route → controller → service → DB. Cover: valid flow, validation errors, not found, auth failures.
- **E2E** — full HTTP cycle against the real app. Cover: status codes, response headers, response body shape.

---

## 6. Run the test

```bash
npm test                         # all tests
node {{test_folder}}/my-test.js  # single file
```

---

## 7. Debug the test

If the test fails:
- Read the assertion error — compare actual vs expected.
- Verify the DB state before the operation (setup/teardown).
- Check that async flows are properly awaited.
- Use `console.log` or `node --inspect` only if the error isn't obvious.
- If the test itself is wrong, fix it first and justify why before touching source code.
