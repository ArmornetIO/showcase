// ── erd-layout.ts — pure geometry for the ERD diagram layer ─────────────────
// No Svelte, no DOM. Sizes table cards, packs them into subject-area regions,
// and routes FK edges to specific column rows (dbdiagram-style anchoring).

import type { ErdTable, ErdColumn, ErdForeignKey } from "./types.js";

export type DetailLevel = "all" | "keys" | "collapsed";

export const HEADER_H = 30;
export const ROW_H = 21;
export const CARD_PAD_BOTTOM = 4;
const CHAR_W = 6.4; // mono glyph estimate at 10.5px
const MIN_W = 176;
const MAX_W = 304;

// ── Column visibility under the detail ladder ───────────────────────────────

export function visibleColumns(
  table: ErdTable,
  level: DetailLevel,
): ErdColumn[] {
  if (level === "collapsed") return [];
  if (level === "keys")
    return table.columns.filter((c) => c.pk || c.fk || c.unique);
  return table.columns;
}

// ── Card size ────────────────────────────────────────────────────────────────

export function tableWidth(table: ErdTable): number {
  let w = table.name.length * 7.2 + 92; // header: name + rows chip
  for (const c of table.columns) {
    const badges = (c.pk ? 3 : 0) + (c.fk ? 3 : 0) + (c.unique ? 2 : 0);
    w = Math.max(w, (c.name.length + c.type.length + badges) * CHAR_W + 46);
  }
  return Math.round(Math.min(MAX_W, Math.max(MIN_W, w)));
}

export function tableHeight(table: ErdTable, level: DetailLevel): number {
  return (
    HEADER_H +
    visibleColumns(table, level).length * ROW_H +
    (level === "collapsed" ? 0 : CARD_PAD_BOTTOM)
  );
}

// ── Edge anchoring ───────────────────────────────────────────────────────────

/** World-space Y of a column row's center, or the header center when the
 *  column is hidden by the current detail level. */
export function anchorY(
  table: ErdTable,
  tableY: number,
  column: string,
  level: DetailLevel,
): number {
  const cols = visibleColumns(table, level);
  const i = cols.findIndex((c) => c.name === column);
  if (i < 0) return tableY + HEADER_H / 2;
  return tableY + HEADER_H + i * ROW_H + ROW_H / 2;
}

export interface EdgePath {
  d: string;
  /** Endpoint label positions — "1" sits at the referenced side, "*" (or "1"
   *  for one-to-one) at the FK side. */
  fromLabel: { x: number; y: number; text: string };
  toLabel: { x: number; y: number; text: string };
  /** Midpoint, for hover hit area + on-delete chip. */
  mid: { x: number; y: number };
}

export interface PlacedTable {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One-to-one when the FK column set is itself the PK or unique (org_quotas). */
export function fkCardinality(
  fk: ErdForeignKey,
  fromTable: ErdTable,
): "1" | "*" {
  const set = new Set(fk.fromColumns);
  const pkIsFk =
    fromTable.primaryKey.length === fk.fromColumns.length &&
    fromTable.primaryKey.every((c) => set.has(c));
  const uniqueFk =
    fk.fromColumns.length === 1 &&
    (fromTable.columns.find((c) => c.name === fk.fromColumns[0])?.unique ??
      false);
  return pkIsFk || uniqueFk ? "1" : "*";
}

export function routeEdge(
  from: PlacedTable,
  fromY: number,
  to: PlacedTable,
  toY: number,
  cardinality: "1" | "*",
  selfRef: boolean,
): EdgePath {
  if (selfRef) {
    // Loop out of the right edge and back in.
    const x = from.x + from.w;
    const out = 42;
    const d = `M ${x} ${fromY} C ${x + out} ${fromY}, ${x + out} ${toY}, ${x} ${toY}`;
    return {
      d,
      fromLabel: { x: x + 10, y: fromY - 6, text: cardinality },
      toLabel: { x: x + 10, y: toY + 13, text: "1" },
      mid: { x: x + out * 0.75, y: (fromY + toY) / 2 },
    };
  }
  // Pick the facing sides: exit toward the other card.
  const fromRight = from.x + from.w / 2 <= to.x + to.w / 2;
  const x1 = fromRight ? from.x + from.w : from.x;
  const x2 = fromRight ? to.x : to.x + to.w;
  const gap = Math.abs(x2 - x1);
  const reach = Math.max(36, Math.min(120, gap * 0.45));
  const h1 = fromRight ? x1 + reach : x1 - reach;
  const h2 = fromRight ? x2 - reach : x2 + reach;
  const d = `M ${x1} ${fromY} C ${h1} ${fromY}, ${h2} ${toY}, ${x2} ${toY}`;
  const dir1 = fromRight ? 1 : -1;
  return {
    d,
    fromLabel: { x: x1 + 9 * dir1, y: fromY - 5, text: cardinality },
    toLabel: { x: x2 - 9 * dir1, y: toY - 5, text: "1" },
    mid: { x: (x1 + x2) / 2, y: (fromY + toY) / 2 },
  };
}

// ── Auto-layout: masonry per subject area, areas packed into rows ────────────

const GROUP_ORDER = [
  "identity",
  "tenancy",
  "fga",
  "assessment",
  "vendor",
  "mesh",
  "dns",
  "alerting",
  "jobboard",
  "system",
];
const TABLE_GAP = 26;
const GROUP_PAD = 34;
const GROUP_GAP = 70;
const ROW_MAX_W = 3400;

export interface AutoLayoutResult {
  positions: Record<string, { x: number; y: number }>;
}

export function autoLayout(
  tables: ErdTable[],
  level: DetailLevel,
): AutoLayoutResult {
  const byGroup = new Map<string, ErdTable[]>();
  for (const t of tables) {
    const g = byGroup.get(t.group) ?? [];
    g.push(t);
    byGroup.set(t.group, g);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  // Pack each group into columns (shortest-column masonry), then flow group
  // blocks left→right into rows.
  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;

  for (const gid of GROUP_ORDER) {
    const members = byGroup.get(gid);
    if (!members) continue;
    // Hubs (highest FK degree) first so they sit top-left of their region.
    const sorted = [...members].sort(
      (a, b) =>
        b.columns.length - a.columns.length || a.name.localeCompare(b.name),
    );
    const nCols = Math.max(1, Math.ceil(Math.sqrt(sorted.length / 1.9)));
    const colW = Math.max(...sorted.map(tableWidth)) + TABLE_GAP;
    const colHeights = new Array<number>(nCols).fill(0);
    const local: Record<string, { x: number; y: number }> = {};
    for (const t of sorted) {
      let c = 0;
      for (let i = 1; i < nCols; i++) if (colHeights[i] < colHeights[c]) c = i;
      local[t.name] = { x: c * colW, y: colHeights[c] };
      colHeights[c] += tableHeight(t, level) + TABLE_GAP;
    }
    const blockW = nCols * colW - TABLE_GAP + GROUP_PAD * 2;
    const blockH = Math.max(...colHeights) - TABLE_GAP + GROUP_PAD * 2;

    if (cursorX > 0 && cursorX + blockW > ROW_MAX_W) {
      cursorX = 0;
      cursorY += rowH + GROUP_GAP;
      rowH = 0;
    }
    for (const [name, p] of Object.entries(local)) {
      positions[name] = {
        x: cursorX + GROUP_PAD + p.x,
        y: cursorY + GROUP_PAD + p.y,
      };
    }
    cursorX += blockW + GROUP_GAP;
    rowH = Math.max(rowH, blockH);
  }

  return { positions };
}

/** Bounding box of a set of placed tables, padded — the group region. */
export function groupBounds(
  members: ErdTable[],
  positions: Record<string, { x: number; y: number }>,
  level: DetailLevel,
  pad = GROUP_PAD - 12,
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const t of members) {
    const p = positions[t.name];
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + tableWidth(t));
    maxY = Math.max(maxY, p.y + tableHeight(t, level));
  }
  if (!isFinite(minX)) return null;
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}
