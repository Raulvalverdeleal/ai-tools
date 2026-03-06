#!/usr/bin/env node

const config = require('../config');
const {TOKEN} = config;
if (!TOKEN) {
  console.error(JSON.stringify({ error: "Missing FIGMA_TOKEN env var" }));
  process.exit(1);
}

const BASE = "https://api.figma.com/v1";
const headers = { "X-Figma-Token": TOKEN, "Content-Type": "application/json" };

// ── Figma API ────────────────────────────────────────────────────────────────

async function figma(path) {
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`Figma ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Commands ─────────────────────────────────────────────────────────────────

/**
 * Quick overview of a file: name, pages, and top-level frames.
 * Useful for orienting yourself before diving deeper.
 */
async function discover(fileKey) {
  const data = await figma(`/files/${fileKey}?depth=2`);
  const pages = (data.document?.children ?? []).map(page => ({
    id: page.id,
    name: page.name,
    frames: (page.children ?? []).map(f => ({ id: f.id, name: f.name, type: f.type })),
  }));
  console.log(JSON.stringify({ name: data.name, lastModified: data.lastModified, pages }, null, 2));
}

/**
 * Read the full document tree up to a given depth (default 2).
 */
async function readFile(fileKey, depth = 2) {
  const data = await figma(`/files/${fileKey}`);

  function prune(node, d) {
    if (!node) return node;
    const { children, ...rest } = node;
    if (d <= 0 || !children) return rest;
    return { ...rest, children: children.map(c => prune(c, d - 1)) };
  }

  console.log(JSON.stringify({
    name: data.name,
    lastModified: data.lastModified,
    version: data.version,
    document: prune(data.document, depth),
  }, null, 2));
}

/**
 * Fetch one or more nodes by ID (comma-separated).
 */
async function readNodes(fileKey, nodeIds) {
  const ids = nodeIds.join(",");
  const data = await figma(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`);
  console.log(JSON.stringify(data.nodes, null, 2));
}

/**
 * Search for components and variant sets. Optionally filter by name query.
 */
async function searchComponents(fileKey, query) {
  const [c, s] = await Promise.all([
    figma(`/files/${fileKey}/components`),
    figma(`/files/${fileKey}/component_sets`),
  ]);

  const q = query?.toLowerCase();
  const fmt = x => ({ id: x.node_id, key: x.key, name: x.name, description: x.description });
  const filter = arr => q ? arr.filter(x => x.name.toLowerCase().includes(q)) : arr;

  const components    = filter(c.meta?.components ?? []).map(fmt);
  const componentSets = filter(s.meta?.component_sets ?? []).map(fmt);

  console.log(JSON.stringify({
    total: components.length + componentSets.length,
    components,
    component_sets: componentSets,
  }, null, 2));
}

/**
 * Extract design tokens: colors (hex+rgba), typography, effects, grids.
 */
async function extractStyles(fileKey, types) {
  const stylesData = await figma(`/files/${fileKey}/styles`);
  let styles = stylesData.meta?.styles ?? [];
  if (types?.length) styles = styles.filter(s => types.includes(s.style_type));

  const toCSS = c => {
    if (!c) return null;
    const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
    const hex = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    return { hex, rgba: `rgba(${r},${g},${b},${c.a ?? 1})` };
  };

  const grouped = { FILL: [], TEXT: [], EFFECT: [], GRID: [] };
  for (const s of styles) {
    grouped[s.style_type]?.push({ id: s.node_id, key: s.key, name: s.name, description: s.description });
  }

  // Enrich fills with actual color values
  if (grouped.FILL.length) {
    try {
      const ids = grouped.FILL.map(s => s.id).join(",");
      const nodes = await figma(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`);
      grouped.FILL = grouped.FILL.map(s => ({
        ...s,
        fills: (nodes.nodes?.[s.id]?.document?.fills ?? []).map(f => ({
          type: f.type, color: toCSS(f.color), opacity: f.opacity ?? 1,
        })),
      }));
    } catch { /* return without color details */ }
  }

  // Enrich text styles with font info
  if (grouped.TEXT.length) {
    try {
      const ids = grouped.TEXT.map(s => s.id).join(",");
      const nodes = await figma(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`);
      grouped.TEXT = grouped.TEXT.map(s => {
        const ts = nodes.nodes?.[s.id]?.document?.style ?? {};
        return {
          ...s,
          typography: {
            fontFamily: ts.fontFamily, fontWeight: ts.fontWeight,
            fontSize: ts.fontSize, lineHeightPx: ts.lineHeightPx,
            letterSpacing: ts.letterSpacing, textCase: ts.textCase,
          },
        };
      });
    } catch { /* return without typography details */ }
  }

  console.log(JSON.stringify({
    total: styles.length,
    colors: grouped.FILL,
    typography: grouped.TEXT,
    effects: grouped.EFFECT,
    grids: grouped.GRID,
  }, null, 2));
}

/**
 * Export nodes as images. Returns temporary URLs (~30 min expiry).
 * format: png | svg | jpg | pdf  (default: png)
 * scale:  1–4                    (default: 1)
 */
async function exportImages(fileKey, nodeIds, format = "png", scale = 1) {
  const ids = nodeIds.join(",");
  const data = await figma(`/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`);
  if (data.err) throw new Error(data.err);

  console.log(JSON.stringify({
    images: Object.entries(data.images ?? {}).map(([node_id, url]) => ({ node_id, url, format, scale })),
    note: "URLs expire in ~30 minutes.",
  }, null, 2));
}

// ── CLI Runner ───────────────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

(async () => {
  try {
    switch (command) {

      case "discover":
        if (!args[0]) throw new Error("Usage: discover <file_key>");
        await discover(args[0]);
        break;

      case "read_file":
        if (!args[0]) throw new Error("Usage: read_file <file_key> [depth]");
        await readFile(args[0], args[1] ? parseInt(args[1], 10) : 2);
        break;

      case "read_nodes":
        if (!args[0] || !args[1]) throw new Error("Usage: read_nodes <file_key> <node_id,node_id,...>");
        await readNodes(args[0], args[1].split(","));
        break;

      case "search_components":
        if (!args[0]) throw new Error("Usage: search_components <file_key> [query]");
        await searchComponents(args[0], args[1]);
        break;

      case "extract_styles":
        if (!args[0]) throw new Error("Usage: extract_styles <file_key> [FILL,TEXT,EFFECT,GRID]");
        await extractStyles(args[0], args[1] ? args[1].split(",") : null);
        break;

      case "export_images":
        if (!args[0] || !args[1]) throw new Error("Usage: export_images <file_key> <node_id,node_id,...> [format] [scale]");
        await exportImages(args[0], args[1].split(","), args[2] ?? "png", parseFloat(args[3] ?? "1"));
        break;

      default:
        console.error([
          "Usage: node figma-api.js <command> [args]",
          "",
          "Commands:",
          "  discover         <file_key>                              — pages + top-level frames",
          "  read_file        <file_key> [depth]                     — full document tree",
          "  read_nodes       <file_key> <id,id,...>                 — specific nodes by ID",
          "  search_components <file_key> [query]                    — components + variants",
          "  extract_styles   <file_key> [FILL,TEXT,EFFECT,GRID]     — design tokens",
          "  export_images    <file_key> <id,id,...> [format] [scale] — image export URLs",
        ].join("\n"));
        process.exit(1);
    }
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
})();
