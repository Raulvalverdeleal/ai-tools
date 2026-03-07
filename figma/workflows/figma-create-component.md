---
description: Translate a Figma component (button, input, navbar, card, etc.) into a reusable, self-contained codebase component.
---

# figma-create-component

<!-- ================================================================
  WORKFLOW VARIABLES
  If a variable is unset (?), the agent will ask the user and
  update this file automatically before continuing.
================================================================ -->

```yaml
# workflow.config
figma_script:      ?   # e.g. node .agents/skills/figma-mcp/scripts/figma-api.js
framework:         ?   # react | vue | svelte | astro
language:          ?   # typescript | javascript
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
| `language` | TypeScript or JavaScript? |
| `styling` | Styling approach? (`tailwind` / `css-modules` / `styled-components` / `scss`) |
| `components_dir` | Where do components live? (e.g. `src/components`) |
| `public_dir` | Where are static assets served from? (e.g. `public`) |
| `styles_file` | Where is the global CSS variables file? |

Once all variables are set, proceed to step 1.

---

## 1. Parse the Figma selection

Extract `file_key` and `node_id` from the Figma URL:

```
https://www.figma.com/file/FILE_KEY/Name?node-id=NODE_ID
```

- `FILE_KEY` → everything between `/file/` and the next `/`
- `NODE_ID` → the `node-id` query param — replace `-` with `:` for the API

Fetch the component node and search for related components in the file:

```bash
{{figma_script}} read_nodes <file_key> <node_id>
{{figma_script}} search_components <file_key> "<component name>"
```

Once fetched, check for a `description` field on the component and on each variant node. Designers often annotate components with intended usage, prop constraints, or behavior notes. If present, treat these as authoritative design intent — they take precedence over visual inference.

---

## 2. Inventory variants and states

Inspect the node tree and identify every variant or state defined in Figma:

| Category | What to look for |
|---|---|
| **Variants** | `variant` properties in component sets (e.g. `size=sm/md/lg`, `intent=primary/secondary/danger`) |
| **Interactive states** | `hover`, `focus`, `active`, `disabled`, `loading` nodes or boolean properties |
| **Content slots** | Optional children: leading icon, trailing icon, label, badge, avatar |
| **Responsive** | Separate mobile variants or auto-layout breakpoints |
| **Designer notes** | `description` fields on the component set or individual variants — may clarify when a variant should be used, what a prop controls, or behaviors not visible in the design |

List every variant and state before writing any code. If a `description` clarifies or contradicts what the visual tree suggests, note the discrepancy and follow the description.

---

## 3. Check for duplicates

Search `{{components_dir}}` for any existing component that covers the same pattern.

- If a partial match exists, extend it — do not create a duplicate.
- If an exact match exists, stop and tell the user: *"This component already exists at `<path>`. Did you mean to use `figma-update-component` instead?"*

---

## 4. Download assets

Scan the node tree for SVGs or images embedded in the component (icons, decorative images).

```bash
{{figma_script}} export_images <file_key> <node_id> svg
```

Save to `{{public_dir}}/icons/` or `{{public_dir}}/images/` as appropriate.

---

## 5. Sync design tokens

Extract color and typography tokens used by the component:

```bash
{{figma_script}} extract_styles <file_key> FILL,TEXT
```

Append any missing tokens to `{{styles_file}}`. Never overwrite existing values.

---

## 6. Build the component

Create the file at `{{components_dir}}/<ComponentName>/<ComponentName>.{{language extension}}`.

**Structure:**

1. **Props interface** — one prop per variant dimension and state:
   ```ts
   interface ButtonProps {
     label: string
     intent?: 'primary' | 'secondary' | 'danger'
     size?: 'sm' | 'md' | 'lg'
     isLoading?: boolean
     isDisabled?: boolean
     leadingIcon?: React.ReactNode
     onClick?: () => void
   }
   ```

2. **All variants rendered** — use conditional classes or a variant map, not duplicated JSX blocks.

3. **All interactive states wired up** — hover and focus via CSS, `isLoading` shows a spinner, `isDisabled` blocks interaction.

4. **Fully self-contained** — no API calls, no external state, no routing logic. Props in, UI out.

5. **CSS variables only** — no hardcoded color or font values.

---

## 7. Write a usage example

At the bottom of the file (or in a sibling `<ComponentName>.stories.tsx` / `<ComponentName>.example.tsx`), add a minimal usage block covering the main variants:

```tsx
// Usage example
<Button label="Save changes" intent="primary" size="md" />
<Button label="Delete" intent="danger" isLoading />
<Button label="Cancel" intent="secondary" isDisabled />
```

This doubles as a smoke test and makes the component immediately usable by teammates.

---

## 8. Final checklist

- [ ] Every Figma variant has a corresponding prop value
- [ ] Every interactive state (hover, focus, loading, disabled) is implemented
- [ ] Designer `description` notes read and applied where relevant
- [ ] No hardcoded color or font values — CSS variables only
- [ ] No API calls or external dependencies
- [ ] Usage example covers all main variants
- [ ] No existing component was duplicated
