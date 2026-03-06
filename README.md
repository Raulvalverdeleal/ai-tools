# ⚡ ai-tools

> Ready-to-use rules, skills, and workflows for any AI agent in any IDE.
> Copy what you need. Add your tokens. Start using it.

No MCP server configuration. No boilerplate hunting. Just open a file and go.

---

## How it works

This repo is organized by domain. Each domain can have **skills** and **workflows**.

```
ai-tools/
├── figma/
│   ├── skills/figma-mcp/       ← Figma API client + docs
│   └── workflows/              ← Figma → code workflows
├── sentry/
│   ├── skills/sentry-mcp/      ← Sentry API client + docs
│   └── workflows/              ← Issue triage and fix workflows
├── node/
│   └── workflows/              ← Node.js / Express workflows
└── other/
    └── skills/                 ← General-purpose debugging skills
```

**Skills** are tools your agent can call — a script, an API client, and a `SKILL.md` that explains how to use it. Drop a skill into your project and your agent knows how to operate it.

**Workflows** are step-by-step instruction files your agent follows from start to finish. They are self-configuring: the first time you run one, the agent asks for any missing project-specific values and saves them into the file so you never answer the same question twice.

---

## Installation

Skills and workflows are just files. Copy what you need into your project.

The recommended location is `.agent/` in your project root — most AI IDEs pick up instructions from there — but you can use any path your agent is configured to read from.

### Copy a skill

```bash
# Figma MCP
cp -r ai-tools/figma/skills/figma-mcp   my-project/.agent/skills/

# Sentry MCP
cp -r ai-tools/sentry/skills/sentry-mcp  my-project/.agent/skills/
```

### Copy a workflow

```bash
# All Figma workflows
cp ai-tools/figma/workflows/*.md         my-project/.agent/workflows/

# A single workflow
cp ai-tools/sentry/workflows/sentry-health-check.md  my-project/.agent/workflows/
```

### Install skill dependencies

Each skill that uses a local script has its own `package.json`:

```bash
cd my-project/.agent/skills/figma-mcp && npm install
cd my-project/.agent/skills/sentry-mcp && npm install
```

### Add your tokens

Every skill ships with a `config.sample.js`. Copy it and fill in your credentials:

```bash
cp .agent/skills/figma-mcp/config.sample.js   .agent/skills/figma-mcp/config.local.js
cp .agent/skills/sentry-mcp/config.sample.js  .agent/skills/sentry-mcp/config.local.js
```

Open each `config.local.js` and add your tokens. The skill reads from that file automatically.

> Add `config.local.js` to your `.gitignore` — never commit tokens.

---

## What's included

### Figma

#### Skill — `figma-mcp`

Lets your agent talk to the Figma API without leaving the IDE.

```bash
node .agent/skills/figma-mcp/figma-api.js discover          <file_key>
node .agent/skills/figma-mcp/figma-api.js read_nodes        <file_key> <node_id,...>
node .agent/skills/figma-mcp/figma-api.js search_components <file_key> [query]
node .agent/skills/figma-mcp/figma-api.js extract_styles    <file_key> [FILL,TEXT,EFFECT,GRID]
node .agent/skills/figma-mcp/figma-api.js export_images     <file_key> <node_id,...> [format] [scale]
```

See [`figma/skills/figma-mcp/SKILL.md`](figma/skills/figma-mcp/SKILL.md) for the full reference.

#### Workflows

| File | When to use |
|---|---|
| `figma-create-from-selection.md` | Turn a Figma frame into a new route, section, or feature block |
| `figma-create-component.md` | Turn a Figma component into a reusable codebase component |
| `figma-update-component.md` | Apply design updates from Figma to an existing component |

Paste a Figma URL and the agent handles the rest: reads the node tree, downloads assets, syncs design tokens, builds the layout with mocked data, and keeps all interactivity intact.

---

### Sentry

#### Skill — `sentry-mcp`

Lets your agent read and mutate Sentry issues from the terminal.

```bash
node .agent/skills/sentry-mcp/sentry-api.js discover
node .agent/skills/sentry-mcp/sentry-api.js list_issues        [limit] [cursor]
node .agent/skills/sentry-mcp/sentry-api.js get_issue_details  <issue_id>
node .agent/skills/sentry-mcp/sentry-api.js resolve_issue      <issue_id>
node .agent/skills/sentry-mcp/sentry-api.js ignore_issue       <issue_id>
```

See [`sentry/skills/sentry-mcp/SKILL.md`](sentry/skills/sentry-mcp/SKILL.md) for the full reference.

#### Workflows

| File | When to use |
|---|---|
| `sentry-health-check.md` | Fetch the top 5 unresolved production issues, triage, and fix them one by one |
| `sentry-fix-issue.md` | Fix a single known issue by ID |

The agent fetches issues, reconstructs what the user was doing from breadcrumbs, assesses impact, presents a diagnostic report, and waits for your approval before writing a single line of code or committing anything.

---

### Node.js

#### Workflows

| File | When to use |
|---|---|
| `node-test.md` | Generate or update tests after changing a Node.js / Express codebase |

Detects changed code, finds existing tests, decides what needs coverage, and writes tests that match the project's existing conventions.

---

### Other — Debugging Skills

General-purpose debugging skills that any workflow can reference.

| Skill | What it teaches the agent |
|---|---|
| `debugger` | How to use the debugger systematically |
| `debugging-strategies` | Structured approaches to isolating and diagnosing bugs |
| `debugging-toolkit-smart-debug` | Smart debug mode: triage → hypothesis → verify loop |

---

## Self-configuring workflows

Every workflow has a `workflow.config` block at the top:

```yaml
# workflow.config
sentry_script:   ?   # e.g. node .agent/skills/sentry-mcp/sentry-api.js
fix_branch:      ?   # e.g. fix/sentry-health
has_payments:    ?   # true | false
```

Any variable still set to `?` will trigger a question the first time you run the workflow. The agent fills in your answer and saves it to the file — so the next run starts immediately with no prompts.

This means the same workflow file works across every project in your team. Each project configures it once and never again.

---

## Project structure after setup

```
my-project/
└── .agent/
    ├── skills/
    │   ├── figma-mcp/
    │   │   ├── SKILL.md
    │   │   ├── figma-api.js
    │   │   ├── config.sample.js
    │   │   ├── config.local.js   ← your tokens (gitignored)
    │   │   └── package.json
    │   └── sentry-mcp/
    │       ├── SKILL.md
    │       ├── sentry-api.js
    │       ├── config.sample.js
    │       ├── config.local.js   ← your tokens (gitignored)
    │       └── package.json
    └── workflows/
        ├── figma-create-from-selection.md
        ├── figma-create-component.md
        ├── figma-update-component.md
        ├── sentry-health-check.md
        ├── sentry-fix-issue.md
        └── node-test.md
```

---

## Contributing

Got a workflow that saves you time? Open a PR.

- One file per workflow or skill
- Include a description frontmatter and a clear first section explaining what it does
- Workflows must use the `workflow.config` pattern for any project-specific value
- Skills must ship with a `SKILL.md`, a `config.sample.js`, and a `package.json`
- Test it in at least one IDE before submitting

---

## License

MIT
