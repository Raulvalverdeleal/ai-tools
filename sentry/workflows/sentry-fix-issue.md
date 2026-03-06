---
description: Fetch a specific Sentry issue by ID, analyze its root cause and impact, then fix it with human approval at every step.
---

# sentry-fix

<!-- ================================================================
  WORKFLOW VARIABLES
  If a variable is unset (?), the agent will ask the user and
  update this file automatically before continuing.
================================================================ -->

```yaml
# workflow.config
sentry_script:   ?   # e.g. node .agents/skills/sentry-mcp/scripts/sentry-api.js
fix_branch:      ?   # e.g. fix/sentry-health
has_payments:    ?   # true | false — does the app process payments?
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
| `debug_workflow` | Slash command or workflow to verify fix plans (e.g. `/systematic-debugging`). Leave blank to skip. |

Once all variables are set, proceed to step 1.

---

## 1. Get the issue ID

Ask the user:

> **Which Sentry issue do you want to fix?** Paste the issue ID (e.g. `PROJECT-123`).

Wait for the answer before continuing.

---

## 2. Prepare the environment

Check the current branch:

```bash
git branch --show-current
```

If not on `{{fix_branch}}`, switch to it or create it:

```bash
git switch {{fix_branch}} 2>/dev/null || git switch -c {{fix_branch}}
```

---

## 3. Fetch issue details

```bash
{{sentry_script}} get_issue_details <issue_id>
```

Read `diagnostics.breadcrumbs` to reconstruct what the user was doing.
Locate the exact file and line in the local repository using `diagnostics.exception`.

---

## 4. Determine impact

Score the issue across these dimensions:

| Dimension | Question |
|---|---|
| **User-facing** | Does this produce a visible error or broken UI for the end user? |
| **Flow-blocking** | Does it prevent the user from progressing through the app? |
{{#if has_payments}}| **Payment-blocking** | Does it occur during checkout or payment processing? |{{/if}}
| **Scope** | How many unique users are affected (`userCount`)? |

---

## 5. Present the Diagnostic Report

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

---

## 6. Wait for user decision

> **What do you want to do?**
> `fix` — apply the fix now
> `archive` — ignore it permanently in Sentry

- **`archive`** → run `{{sentry_script}} ignore_issue <issue_id>`. Done.
- **`fix`** → continue to step 7.

---

## 7. Apply the fix

1. If `{{debug_workflow}}` is set, run it now passing the stack trace and breadcrumbs from step 3 to verify the fix plan before writing any code.
2. Modify the code to resolve the root cause identified in step 3.
2. Run existing tests to verify nothing broke:
   ```bash
   npm test
   ```
3. Show a diff summary of every file changed.

Wait for user approval:

> **Changes look good?**
> `approve` — commit and mark as resolved
> `revise` — describe what to change, then repeat from step 7

Once approved:

```bash
git add <changed files>
git commit -m "fix: resolve sentry <issue_id> — <title>"
{{sentry_script}} resolve_issue <issue_id>
```

Done. If there are committed fixes, remind the user to open a PR from `{{fix_branch}}`.
