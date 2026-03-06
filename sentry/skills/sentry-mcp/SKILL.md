---
description: Interact with the Sentry API to list, inspect, resolve, and archive production issues.
---

# SKILL — sentry-mcp

This skill exposes the Sentry API through a local Node.js script. Use it whenever you need to read or mutate Sentry issues during debugging or health-check workflows.

---

## Setup

All credentials live in `config.sample` (or your local `config.local`). The script will exit immediately with a clear error if any of these are missing:

| Key | Description |
|---|---|
| `SENTRY_TOKEN` | Bearer token from Sentry → Settings → Auth Tokens |
| `SENTRY_ORG` | Organization slug (e.g. `my-company`) |
| `SENTRY_PROJECT` | Project slug (e.g. `backend-api`) |
| `SENTRY_BASE_URL` | API base URL (e.g. `https://sentry.io/api/0`) |

If you don't know the org or project slug, run `discover` first (see below).

---

## Commands

All commands follow this pattern:

```bash
node <path-to-script>/sentry-api.js <command> [args]
```

---

### `discover`

Lists all projects available under your token. Run this once to find the correct `SENTRY_ORG` and `SENTRY_PROJECT` values.

```bash
node sentry-api.js discover
```

**Returns:** array of `{ name, slug, org_slug, platform }`.

---

### `list_issues [limit] [cursor]`

Fetches the top unresolved issues, sorted by frequency (most occurrences first).

```bash
node sentry-api.js list_issues 5          # top 5
node sentry-api.js list_issues 20         # top 20 (default)
node sentry-api.js list_issues 20 <cursor> # next page
```

**Returns:** `{ issues[], pagination }`.

Each issue contains:

| Field | What it tells you |
|---|---|
| `id` | Internal Sentry ID — use this for all other commands |
| `shortId` | Human-readable ID (e.g. `PROJECT-123`) |
| `title` | Error message or exception type |
| `culprit` | File/function/URL where the error originated — key for triage |
| `count` | Total number of events (occurrences) |
| `userCount` | Unique users affected |
| `firstSeen` / `lastSeen` | Age and recency of the issue |
| `priority` | Sentry-assigned priority level |
| `permalink` | Direct link to the issue in the Sentry UI |

**Pagination:** if `pagination.next.results` is `true`, there are more issues. Pass `pagination.next.cursor` as the second argument to fetch the next page.

---

### `get_issue_details <issue_id>`

Fetches full details for a single issue including the latest event, stack trace, breadcrumbs, and user context.

```bash
node sentry-api.js get_issue_details 4505067311
```

**Returns:** full issue object plus a `diagnostics` block derived from the latest event:

| Field | What it tells you |
|---|---|
| `diagnostics.message` | Exact error message at the time of the event |
| `diagnostics.timestamp` | When the latest event occurred |
| `diagnostics.environment` | `production`, `staging`, etc. |
| `diagnostics.release` | App version / git SHA where it happened |
| `diagnostics.user` | User ID, email, or IP of the affected user |
| `diagnostics.tags` | All Sentry tags as a flat key-value object |
| `diagnostics.breadcrumbs` | Ordered list of actions the user took before the crash — use this to reconstruct the journey |
| `diagnostics.exception` | Full stack trace with frames — use this to locate the exact file and line in the codebase |

**How to read the stack trace:**

```
diagnostics.exception[0].stacktrace.frames
```

Frames are ordered innermost-last. The last frame with a path that matches your codebase (not `node_modules`) is the crash site.

**How to read breadcrumbs:**

```
diagnostics.breadcrumbs  →  [{ timestamp, type, category, message, data }]
```

Read them chronologically. Look for the last few `http` or `navigation` entries before the crash to understand what the user was doing.

---

### `resolve_issue <issue_id>`

Marks an issue as resolved in Sentry. Call this after a fix has been committed and verified.

```bash
node sentry-api.js resolve_issue 4505067311
```

**Returns:** `{ success: true, id, status: "resolved" }`.

---

### `ignore_issue <issue_id>`

Archives an issue permanently. It will no longer appear in the unresolved list. Use for third-party noise or issues that are intentionally not fixed.

```bash
node sentry-api.js ignore_issue 4505067311
```

**Returns:** `{ success: true, id, status: "ignored", note: "Issue archived/ignored permanently" }`.

> ⚠️ Always ask the user for confirmation before running this command. Ignored issues are hidden from the default view and cannot be recovered without manually changing their status in the Sentry UI.

---

## Decision guide

```
list_issues
    │
    ├── culprit is third-party?
    │       └── ask user → ignore_issue
    │
    └── culprit is our code?
            └── get_issue_details
                    │
                    ├── analyze breadcrumbs + stack trace
                    ├── present Diagnostic Report to user
                    │
                    ├── user says fix
                    │       └── apply fix → npm test → commit → resolve_issue
                    │
                    ├── user says skip
                    │       └── move to next issue
                    │
                    └── user says archive
                            └── ignore_issue
```

---

## Error handling

Every command outputs JSON to stdout. On failure it writes `{ "error": "<message>" }` to stderr and exits with code 1.

Always check for an `error` key before processing the response:

```js
const result = JSON.parse(output);
if (result.error) {
  // surface the error to the user, do not continue
}
```

Common errors:

| Error | Likely cause |
|---|---|
| `HTTP 401` | `SENTRY_TOKEN` is invalid or expired |
| `HTTP 403` | Token lacks permission for this org/project |
| `HTTP 404` | Wrong `issue_id`, `SENTRY_ORG`, or `SENTRY_PROJECT` |
| `Missing required Sentry configuration` | `config.sample` / `config.local` is incomplete |
