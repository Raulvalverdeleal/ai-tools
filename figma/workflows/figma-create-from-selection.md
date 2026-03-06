---
description: Translate a Figma frame or section into production-ready layout code. Mocks data and requests, keeps interactivity.
---

# figma-create-from-selection

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
pages_dir:         ?   # e.g. src/pages or src/app (Next.js app router: src/app)
public_dir:        ?   # e.g. public
styles_file:       ?   # path to global CSS variables file, e.g. src/styles/variables.css
router:            ?   # nextjs-app | nextjs-pages | react-router | nuxt | sveltekit
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
| `pages_dir` | Where do pages/routes live? (e.g. `src/pages`, `src/app`) |
| `public_dir` | Where are static assets served from? (e.g. `public`) |
| `styles_file` | Where is the global CSS variables file? |
| `router` | Which router? (`nextjs-app` / `nextjs-pages` / `react-router` / `nuxt` / `sveltekit`) |

Once all variables are set, proceed to step 1.

---

## 1. Parse the Figma selection

Extract `file_key` and `node_id` from the Figma URL:

```
https://www.figma.com/file/FILE_KEY/Name?node-id=NODE_ID
                        ^^^^^^^^                ^^^^^^^^
```

- `FILE_KEY` → everything between `/file/` and the next `/`
- `NODE_ID` → the `node-id` query param — replace `-` with `:` for the API

Fetch the selected node and get a broad orientation of the file:

```bash
{{figma_script}} read_nodes <file_key> <node_id>
{{figma_script}} discover <file_key>
```

---

## 2. Classify the selection

Based on the node tree, determine what this frame is. Ask the user if it is not obvious.

| Type | Signals | Output |
|---|---|---|
| **New route** | Top-level frame, full viewport width, has a page title or distinct URL concept | New file in `{{pages_dir}}` |
| **Section** | Part of a larger page, no independent navigation concept | New section component, inserted into an existing route |
| **Feature block** | Self-contained area (hero, pricing table, testimonials) | New component in `{{components_dir}}`, imported into a route |
| **Isolated component** | Small, reusable (card, banner, empty state) | → use `figma-create-component` workflow instead |

> If classification is unclear, ask the user: *"Is this a new page, a section within an existing page, or a self-contained block?"*

---

## 3. Surface ambiguities — ask before building

Do not proceed until these are resolved:

- **Placement:** Which existing route does this belong to, or what is the new route path?
- **Interaction states:** Are hover, focus, loading, empty, and error states shown in the design? If not, confirm what behavior is expected.
- **Responsive breakpoints:** Are there mobile/tablet variants in the file? Which breakpoints apply?
- **Animations:** Are any elements animated? Flag them — implement as static first, leave a `// TODO: animate` comment.
- **Existing overlap:** Are any components in `{{components_dir}}` already covering part of this design? Check before creating new files.

---

## 4. Download assets

Scan the node tree for assets that need to be saved to `{{public_dir}}`:

- Image fills (`type: IMAGE`)
- Vector/SVG nodes (icons, illustrations, logos)
- Background textures or patterns

For each asset, export and download immediately — URLs expire in ~30 minutes:

```bash
{{figma_script}} export_images <file_key> <node_id> svg     # for vectors
{{figma_script}} export_images <file_key> <node_id> png 2   # for rasters
```

Save to:

```
{{public_dir}}/
  images/    ← raster images (png, jpg)
  icons/     ← SVG icons
  logos/     ← brand assets
```

---

## 5. Sync design tokens

Extract all tokens from the file:

```bash
{{figma_script}} extract_styles <file_key> FILL,TEXT,EFFECT
```

Compare against `{{styles_file}}`. Append only tokens that do not already exist — never overwrite existing values.

```css
/* {{styles_file}} — append only */
:root {
  --color-primary: #3B5BDB;
  --font-heading: 'Inter', sans-serif;
  /* ... */
}
```

---

## 6. Build sub-components

Identify every distinct UI piece inside the selection that is not already in `{{components_dir}}`.

For each missing piece:

1. Create `{{components_dir}}/<ComponentName>/<ComponentName>.{{language extension}}`
2. Props interface / type at the top of the file
3. Static props only — no API calls, no data fetching
4. Keep all interactions: clicks, hovers, form inputs, toggles, open/close states
5. Use `{{styling}}` conventions matching the rest of the codebase

---

## 7. Mock data and requests

All external data is static. No API calls anywhere in new code.

**Rules:**
- Define mock data in a sibling `<name>.mock.ts` (or `.js`) file
- Use realistic content — no Lorem ipsum
- Mock loading and error states as boolean props (`isLoading`, `hasError`)
- For requests (forms, mutations): wire up the handler, `console.log` the payload, show a success/error state — do not call any endpoint
- Replace complex unimplementable pieces (maps, rich editors, charts) with a black placeholder div and a `// TODO:` comment

```tsx
// TODO: replace with <RevenueChart /> once integrated
<div style={{ background: '#000', width: '100%', height: 320 }} aria-label="Chart placeholder" />
```

---

## 8. Assemble the layout

Create the route or section file based on the classification in step 2.

1. Import all sub-components from step 6
2. Pass mock data from step 7 as props
3. Reference assets from `{{public_dir}}` using the paths from step 4
4. Use only CSS variables from `{{styles_file}}` — no hardcoded color or font values
5. Match the Figma frame at the primary breakpoint; add responsive rules for others identified in step 3

---

## 9. Final checklist

Before finishing, verify:

- [ ] All assets are in `{{public_dir}}` and referenced correctly
- [ ] No hardcoded color or font values — CSS variables only
- [ ] No API calls in any new file
- [ ] All interactions work: clicks, forms, toggles, loading states
- [ ] Every unimplemented piece has a `// TODO:` placeholder
- [ ] Layout matches the Figma frame at the target breakpoint
- [ ] No existing component was duplicated
