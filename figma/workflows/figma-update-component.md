---
description: Apply design updates from a Figma selection to an existing codebase component. Preserves all logic and functionality — only visual changes.
---

# figma-update-component

<!-- ================================================================
  WORKFLOW VARIABLES
  If a variable is unset (?), the agent will ask the user and
  update this file automatically before continuing.
================================================================ -->

```yaml
# workflow.config
figma_script:      ?   # e.g. node .agents/skills/figma-mcp/scripts/figma-api.js
framework:         ?   # react | vue | svelte | astro
styling:           ?   # tailwind | css-modules | styled-components | scss
components_dir:    ?   # e.g. src/components
public_dir:        ?   # e.g. public
styles_file:       ?   # path to global CSS variables file, e.g. src/styles/variables.css
```

---

## 0. Bootstrap (run once)

Read the `workflow.config` block above. For each variable still set to `?`:

1. Ask the user the corresponding question (table below).
2. Edit this file and replace `?` with the answer.
3. Never ask again on future runs.

| Variable | Question |
|---|---|
| `figma_script` | What command runs your Figma API script? |
| `framework` | Which framework? (`react` / `vue` / `svelte` / `astro`) |
| `styling` | Styling approach? (`tailwind` / `css-modules` / `styled-components` / `scss`) |
| `components_dir` | Where do components live? (e.g. `src/components`) |
| `public_dir` | Where are static assets served from? (e.g. `public`) |
| `styles_file` | Where is the global CSS variables file? |

Once all variables are set, proceed to step 1.

---

## 1. Collect inputs

Ask the user for both inputs before doing anything else:

1. **Figma selection link** — the URL of the updated component in Figma
2. **Existing component file** — the path to the component file in the codebase (e.g. `src/components/Button/Button.tsx`)

Read the existing component file fully before fetching from Figma.

---

## 2. Parse the Figma selection

Extract `file_key` and `node_id` from the Figma URL:

```
https://www.figma.com/file/FILE_KEY/Name?node-id=NODE_ID
```

- `FILE_KEY` → everything between `/file/` and the next `/`
- `NODE_ID` → the `node-id` query param — replace `-` with `:` for the API

```bash
{{figma_script}} read_nodes <file_key> <node_id>
```

Once fetched, check for a `description` field on the component and on each variant node. Designers often leave update notes here — intended changes, removed behaviors, or migration hints. If present, treat these as authoritative and factor them into the diff before comparing visually.

---

## 3. Diff design vs. code

Compare the Figma node tree against the existing component and build a change list.

Examine each dimension:

| Dimension | What to compare |
|---|---|
| **Colors** | Fill colors, border colors, text colors — map to CSS variables |
| **Typography** | Font family, weight, size, line height, letter spacing |
| **Spacing** | Padding, margin, gap — expressed in the design's spacing scale |
| **Border & radius** | Border width, style, color, corner radius |
| **Shadows & effects** | Drop shadows, blurs, overlays |
| **Layout** | Direction, alignment, distribution, wrapping |
| **New variants** | Any variant or state present in Figma that doesn't exist in code |
| **Removed variants** | Any variant in code that no longer exists in the design |
| **New assets** | Icons or images added or replaced |
| **Designer notes** | Any `description` changes that clarify intent or flag behavioral updates |

Present the change list to the user **before touching any code**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DESIGN DIFF — <ComponentName>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Visual changes
  • Background: #E2E8F0 → #F1F5F9
  • Border radius: 4px → 8px
  • Padding: 8px 16px → 10px 20px

  Structural changes
  • New variant: size="xs" added
  • Removed variant: intent="ghost" no longer in design

  Assets
  • Icon "arrow-right" replaced with "chevron-right"

  Designer notes
  • "ghost variant deprecated, use secondary instead"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Wait for the user to confirm before proceeding.

---

## 4. Clarify structural changes

If the diff includes structural changes (new or removed variants, new slots, layout changes), ask the user:

- **New variants:** Should they be added, or was this an intentional omission from the Figma file?
- **Removed variants:** Should they be deleted from code, or kept for backward compatibility?
- **Layout shifts:** Does this affect any consumer of the component (pages or other components that use it)?

Do not remove existing variants or props without explicit user confirmation.

---

## 5. Download new or replaced assets

For any asset that changed or was added in step 3:

```bash
{{figma_script}} export_images <file_key> <node_id> svg
```

Save to `{{public_dir}}/icons/` or `{{public_dir}}/images/`. Remove the old asset only after the new one is confirmed in place.

---

## 6. Sync updated design tokens

Extract tokens for the updated component:

```bash
{{figma_script}} extract_styles <file_key> FILL,TEXT
```

Update only the tokens that changed in `{{styles_file}}`. Flag any token rename to the user — renaming a CSS variable is a breaking change that may affect other components.

---

## 7. Apply the changes

Edit the existing component file. Hard rules:

- **Touch only what the diff requires** — do not refactor, reformat, or reorganize unrelated code
- **Preserve all logic** — event handlers, state, refs, context, side effects stay exactly as they are
- **Preserve all props** — only add new ones; never remove or rename existing props without user confirmation
- **CSS variables only** — no hardcoded values, even for "temporary" tweaks

Show a diff summary of every line changed before finishing.

---

## 8. Final checklist

- [ ] Every visual change from the diff has been applied
- [ ] Designer `description` notes read and applied where relevant
- [ ] No logic, handlers, or state was modified
- [ ] No existing props were removed or renamed without confirmation
- [ ] New assets are in `{{public_dir}}` and referenced correctly
- [ ] Only CSS variables used — no hardcoded values
- [ ] Diff summary shown and approved by the user
