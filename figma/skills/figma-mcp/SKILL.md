---
description: Interact with the Figma API to read files, inspect nodes, extract design tokens, search components, and export images.
---

# SKILL — figma-mcp

This skill exposes the Figma API through a local Node.js script. Use it to read design files, extract tokens, locate components, and export assets — without opening Figma.

---

## Setup

The script requires a single credential in `config` (or your local `config.local`):

| Key | Description |
|---|---|
| `TOKEN` | Personal access token from Figma → Account Settings → Personal access tokens |

If you don't know the `file_key` of a design file, you can find it in the Figma URL:
`https://www.figma.com/file/<file_key>/...`

---

## Commands

All commands follow this pattern:

```bash
node <path-to-script>/figma-api.js <command> [args]
```

---

### `discover <file_key>`

Quick overview of a file: name, pages, and top-level frames. **Always run this first** when working with an unfamiliar file — it gives you the page and frame IDs needed for all other commands.

```bash
node figma-api.js discover abc123xyz
```

**Returns:** `{ name, lastModified, pages[] }` — each page includes its child frames with `id`, `name`, and `type`.

---

### `read_file <file_key> [depth]`

Reads the full document tree pruned to a given depth (default `2`). Use higher depths only when you need to inspect nested components — the response grows quickly.

```bash
node figma-api.js read_file abc123xyz        # depth 2 (default)
node figma-api.js read_file abc123xyz 4      # deeper inspection
```

**Returns:** `{ name, lastModified, version, document }` — the document tree with children pruned at the specified depth.

**Depth guide:**

| Depth | What you see |
|---|---|
| `1` | Pages only |
| `2` | Pages + top-level frames (good starting point) |
| `3` | Frames + direct children (sections, groups) |
| `4+` | Deep component internals |

---

### `read_nodes <file_key> <node_id,...>`

Fetches one or more specific nodes by ID. Use this after `discover` or `read_file` to zoom into a frame or component you care about.

```bash
node figma-api.js read_nodes abc123xyz 12:34
node figma-api.js read_nodes abc123xyz 12:34,56:78,90:12   # multiple
```

**Returns:** a map of `{ [node_id]: { document } }` — full node data including all properties, fills, constraints, and children.

---

### `search_components <file_key> [query]`

Lists all published components and variant sets in the file. Optionally filter by name.

```bash
node figma-api.js search_components abc123xyz             # all components
node figma-api.js search_components abc123xyz "Button"    # filter by name
```

**Returns:** `{ total, components[], component_sets[] }` — each entry has `id`, `key`, `name`, `description`.

**When to use:** before implementing a UI feature — check whether a component already exists in the design system before building from scratch.

---

### `extract_styles <file_key> [types]`

Extracts design tokens from the file. Types can be filtered to `FILL`, `TEXT`, `EFFECT`, or `GRID` (comma-separated). Omit the filter to get everything.

```bash
node figma-api.js extract_styles abc123xyz                    # all tokens
node figma-api.js extract_styles abc123xyz FILL               # colors only
node figma-api.js extract_styles abc123xyz FILL,TEXT          # colors + typography
```

**Returns:** `{ total, colors[], typography[], effects[], grids[] }`

**Colors** include both `hex` and `rgba` values:
```json
{ "name": "Brand/Primary", "fills": [{ "color": { "hex": "#FF5C00", "rgba": "rgba(255,92,0,1)" } }] }
```

**Typography** includes the full font spec:
```json
{ "name": "Heading/H1", "typography": { "fontFamily": "Inter", "fontWeight": 700, "fontSize": 48, "lineHeightPx": 56 } }
```

**When to use:** when converting a design to code — extract all tokens first, then map them to CSS variables or a design token file before touching any component.

---

### `export_images <file_key> <node_id,...> [format] [scale]`

Exports nodes as images. Returns temporary URLs (expire in ~30 minutes).

```bash
node figma-api.js export_images abc123xyz 12:34                      # PNG at 1x
node figma-api.js export_images abc123xyz 12:34 svg                  # SVG
node figma-api.js export_images abc123xyz 12:34 png 2                # PNG at 2x
node figma-api.js export_images abc123xyz 12:34,56:78 jpg 1          # multiple nodes
```

| Argument | Options | Default |
|---|---|---|
| `format` | `png` `svg` `jpg` `pdf` | `png` |
| `scale` | `1` – `4` | `1` |

**Returns:** `{ images: [{ node_id, url, format, scale }], note }`.

> ⚠️ URLs expire in ~30 minutes. Download or embed them immediately — do not store the URL as a permanent reference.

---

## Typical workflows

### Implementing a screen from a design file

```
discover <file_key>
  → find the target page and frame IDs

read_nodes <file_key> <frame_id>
  → inspect layout, children, constraints

search_components <file_key> "ComponentName"
  → check what's in the design system

extract_styles <file_key> FILL,TEXT
  → map colors and typography to CSS variables

export_images <file_key> <icon_node_id> svg
  → export any icons or illustrations needed
```

### Auditing a design system

```
extract_styles <file_key>
  → full token inventory (colors, type, effects, grids)

search_components <file_key>
  → full component and variant inventory

read_file <file_key> 3
  → structural overview of all pages and sections
```

---

## Error handling

Every command outputs JSON to stdout. On failure it writes `{ "error": "<message>" }` to stderr and exits with code 1.

Always check for an `error` key before processing:

```js
const result = JSON.parse(output);
if (result.error) {
  // surface the error to the user, do not continue
}
```

Common errors:

| Error | Likely cause |
|---|---|
| `Figma 403` | Token is invalid, expired, or lacks access to this file |
| `Figma 404` | Wrong `file_key` or `node_id` |
| `Missing FIGMA_TOKEN env var` | `config` is missing the `TOKEN` value |
| `err` field in export response | Invalid node ID or unsupported export format for that node type |
