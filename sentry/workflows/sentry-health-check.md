---
description: Fetch the top unresolved Sentry issues in production, triage them by impact, and fix them one by one with human approval at every step.
---

# sentry-health-check

<!-- ================================================================
  WORKFLOW VARIABLES
  If a variable is unset (?), the agent will ask the user and
  update this file automatically before continuing.
================================================================ -->

```yaml
# workflow.config
sentry_script:   ?   # path to the sentry API script, e.g. node .agents/skills/sentry-mcp/scripts/sentry-api.js
fix_branch:      ?   # branch to work on, e.g. fix/sentry-health
has_payments:    ?   # true | false — does the app process payments?
known_externals: ?   # comma-separated third-party domains to auto-flag, e.g. clickcease.com,clarity.ms,ahrefs.com
debug_workflow:  ?   # slash command or workflow to verify the fix plan, e.g. /systematic-debugging — leave blank to skip
```

---

## 0. Bootstrap (run once)

Read the `workflow.config` block above. For each variable still set to `?`:

1. Ask the user the corresponding question (table below).
2. Edit this file and replace `?` with the answer.
3. Never ask again on future runs.

| Variable | Question |
|---|---|
| `sentry_script` | What command runs your Sentry API script? (e.g. `node .agents/skills/sentry-mcp/scripts/sentry-api.js`) |
| `fix_branch` | Which branch should fixes be committed to? (e.g. `fix/sentry-health`) |
| `has_payments` | Does this app process payments or have a checkout flow? (`true` / `false`) |
| `known_externals` | List any third-party domains that generate noise in Sentry (comma-separated). Leave blank if none. |
| `debug_workflow` | Slash command or workflow to verify fix plans (e.g. `/systematic-debugging`). Leave blank to skip. |

Once all variables are set, proceed to step 1.

---

## 1. Prepare the environment

Check the current branch:

```bash
git branch --show-current
```

If not on `{{fix_branch}}`, switch to it or create it:

```bash
git switch {{fix_branch}} 2>/dev/null || git switch -c {{fix_branch}}
```

---

## 2. Fetch the top 5 issues

```bash
{{sentry_script}} list_issues 5
```

For each issue returned, note: `id`, `title`, `culprit`, `count` (total events), `userCount`.

---

## 3. Triage each issue

Classify every issue before doing any deep analysis. Two categories:

**🔴 Real** — the `culprit` points to your own codebase, or the error directly blocks a core user flow.

**⚪ External noise** — the `culprit` or `title` references a domain in `{{known_externals}}` or any other third-party service clearly unrelated to your code.

For **External noise** issues, present this summary and ask before archiving:

> `Issue <ID> — <title>`
> Culprit: `<culprit>` ← third-party, not in our code
> Scale: `<count>` events / `<userCount>` users
> **Archive permanently?** → `yes` / `skip`

Only run the ignore command if the user confirms `yes`:

```bash
{{sentry_script}} ignore_issue <issue_id>
```

---

## 4. Process issues one by one (up to 5 total)

Repeat steps 4a–4e for each **Real** issue, in order of severity.

### 4a. Get full details

```bash
{{sentry_script}} get_issue_details <issue_id>
```

Read `diagnostics.breadcrumbs` to reconstruct what the user was doing.
Locate the exact file and line in the local repository using `diagnostics.exception`.

### 4b. Determine impact

Score the issue across these dimensions:

| Dimension | Question |
|---|---|
| **User-facing** | Does this produce a visible error or broken UI for the end user? |
| **Flow-blocking** | Does it prevent the user from progressing through the app? |
{{#if has_payments}}| **Payment-blocking** | Does it occur during checkout or payment processing? |{{/if}}
| **Scope** | How many unique users are affected (`userCount`)? |

### 4c. Present the Diagnostic Report

Show this to the user before touching any code:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SENTRY ISSUE — <ID>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Title      : <title>
  Scale      : <count> events / <userCount> users
  Culprit    : <culprit>

  What happened
  <1–2 sentence reconstruction from breadcrumbs>

  Root cause
  <identified line / function / reason>

  Impact
  • User-facing       : yes / no
  • Flow-blocking     : yes / no
  • Payment-blocking  : yes / no   ← omit if has_payments is false
  • Affected users    : <userCount>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4d. Wait for user decision

> **What do you want to do?**
> `fix` — apply the fix now
> `next` — skip, move to the next issue
> `archive` — ignore it permanently in Sentry

- **`next`** → go to step 4a with the next issue.
- **`archive`** → run `{{sentry_script}} ignore_issue <issue_id>`, then go to step 4a.
- **`fix`** → continue to step 4e.

### 4e. Apply the fix

1. If `{{debug_workflow}}` is set, run it now passing the stack trace and breadcrumbs from 4a to verify the fix plan before writing any code.
2. Modify the code to resolve the root cause identified in 4a.
2. Run existing tests to verify nothing broke:
   ```bash
   npm test
   ```
3. Show a diff summary of every file changed.

Wait for user approval:

> **Changes look good?**
> `approve` — commit and mark as resolved
> `revise` — describe what to change, then repeat from step 4e

Once approved:

```bash
git add <changed files>
git commit -m "fix: resolve sentry <issue_id> — <title>"
{{sentry_script}} resolve_issue <issue_id>
```

Then go to step 4a with the next issue.

---

## 5. Session summary

After processing all 5 issues (or when the user decides to stop), print:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SENTRY HEALTH CHECK — DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fixed    : <n> issues  →  committed to {{fix_branch}}
  Skipped  : <n> issues  →  still open in Sentry
  Archived : <n> issues  →  ignored in Sentry
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If there are committed fixes, remind the user to open a PR from `{{fix_branch}}`.
