/**
 * Canvas 棋盤渲染（M2：命中測試 + 選中縫隙紅線 + camera/zoom + 移動動畫）。
 *
 * 座標模型（對照 GUI.py，唯一真理源）：
 *   - CELL = base_cell_size、GAP = gap_width（未縮放基底）
 *   - 世界座標以「像素」為單位：滑塊(col,row) 左上角 = (col*(CELL+GAP), row*(CELL+GAP))
 *   - 世界 → 螢幕：screen = world * zoom + camera（不重複乘 zoom）
 *   - 縫隙 h line：y = (line+1)*(CELL+GAP) - GAP/2；v 同理
 */

import type { GameStore } from '../store/GameStore.js';
import type { Block } from '../core/Block.js';
import type { GapType } from '../core/rules.js';
import { COLORS, GEOMETRY, easeOut } from './theme.js';

const CELL = GEOMETRY.base_cell_size;
const GAP = GEOMETRY.gap_width;

/** 移動動畫狀態 */
export interface MoveAnimation {
  /** 依序與 store.game.blocks 中的滑塊對應的 [起點, 終點] 位置(row,col 各為基數) */
  start: [number, number][];
  end: [number, number][];
  progress: number; // 0..1
  durationMs: number;
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0; let g = 0; let b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** 把 rgb(r, g, b) 往白色提亮 amount（0~1），對照原版 _lighten。 */
function lightenCss(color: string, amount: number): string {
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return color;
  const ch = [Number(m[1]), Number(m[2]), Number(m[3])].map((c) => Math.round(c + (255 - c) * amount));
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  zoom: number;
  cameraX: number;
  cameraY: number;
  animation: MoveAnimation | null = null;
  /** 選中動畫：短暫高亮的格子集合（undo/redo 時顯示移動過的組） */
  highlightCells: Set<string> | null = null;
  /** 著色器：按 (r%step,c%step) 給滑塊描邊同色 */
  coloringEnabled = false;
  /** 連鎖器：懸停時提亮同組位置（含空格） */
  chainHintEnabled = false;
  /** 目前懸停格（棋盤座標；可為空格） */
  hoverCell: [number, number] | null = null;
  private lastBounds: { min_row: number; max_row: number; min_col: number; max_col: number } | null = null;

  constructor(ctx: CanvasRenderingContext2D, zoom = 1) {
    this.ctx = ctx;
    this.zoom = zoom;
    this.cameraX = 0;
    this.cameraY = 0;
  }

  /** 分組描邊色：由 (r%step, c%step) 唯一決定（對照原版 _group_color）。 */
  groupColor(r: number, c: number, step: number): string {
    const k = ((r % step) + step) % step * step + ((c % step) + step) % step;
    const n = step * step;
    let hue: number;
    if (n <= 16) hue = (k * 360) / n;
    else hue = ((k * 0.618033988749895) % 1) * 360;
    const [rr, gg, bb] = hsvToRgb(hue, 0.75, 0.92);
    return `rgb(${rr}, ${gg}, ${bb})`;
  }

  /** 連鎖提示格（含空格）：邊界盒內與懸停格同 (r%step,c%step) 的位置。 */
  chainHintCells(step: number): { cells: Set<string>; hover: [number, number] } | null {
    if (!this.chainHintEnabled || !this.hoverCell || step <= 1) return null;
    const [hr, hc] = this.hoverCell;
    const b = this.lastBounds;
    if (!b) return null;
    if (hr < b.min_row - 1 || hr > b.max_row + 1 || hc < b.min_col - 1 || hc > b.max_col + 1) return null;
    const cells = new Set<string>();
    for (let r = b.min_row; r <= b.max_row; r++) {
      for (let c = b.min_col; c <= b.max_col; c++) {
        if (((r % step) + step) % step === ((hr % step) + step) % step &&
            ((c % step) + step) % step === ((hc % step) + step) % step) {
          cells.add(`${r}:${c}`);
        }
      }
    }
    return { cells, hover: [hr, hc] };
  }

  get cell(): number {
    return CELL;
  }
  get gap(): number {
    return GAP;
  }
  get step(): number {
    return CELL + GAP;
  }
  /** 畫布上一個格的實際大小（含 zoom） */
  get scaledCell(): number {
    return CELL * this.zoom;
  }
  get scaledGap(): number {
    return GAP * this.zoom;
  }
  /** 供 main 置中用的週期（含縮放） */
  get stepPx(): number {
    return this.step * this.zoom;
  }

  /** 世界 → 螢幕。對照 GUI.world_to_screen（world*zoom + camera）。 */
  worldToScreen(worldX: number, worldY: number): [number, number] {
    return [worldX * this.zoom + this.cameraX, worldY * this.zoom + this.cameraY];
  }

  /** 螢幕 → 世界。對照 GUI.screen_to_world。 */
  screenToWorld(screenX: number, screenY: number): [number, number] {
    return [(screenX - this.cameraX) / this.zoom, (screenY - this.cameraY) / this.zoom];
  }

  /** 滑塊世界左上角。 */
  private blockOrigin(r: number, c: number): [number, number] {
    return [c * this.step, r * this.step];
  }

  /** 根據畫布座標取得滑塊。對照 GUI.get_block_at_pos。 */
  getBlockAtPos(screenX: number, screenY: number, store: GameStore): Block | null {
    const [wx, wy] = this.screenToWorld(screenX, screenY);
    for (const block of store.game.blocks) {
      const [bx, by] = this.blockOrigin(block.row, block.col);
      if (wx >= bx && wx < bx + CELL && wy >= by && wy < by + CELL) {
        return block;
      }
    }
    return null;
  }

  /** 根據畫布座標取得格座標 (r,c)，落在縫隙上回 null。對照 GUI.get_cell_at_pos。 */
  getCellAtPos(screenX: number, screenY: number): [number, number] | null {
    const [wx, wy] = this.screenToWorld(screenX, screenY);
    const step = this.step;
    const c = Math.floor(wx / step);
    const r = Math.floor(wy / step);
    if (wx - c * step >= CELL || wy - r * step >= CELL) {
      return null;
    }
    return [r, c];
  }

  /** 根據畫布座標取得縫隙。對照 GUI.get_gap_at_pos。 */
  getGapAtPos(screenX: number, screenY: number, store: GameStore): {
    type: GapType;
    line: number;
  } | null {
    const [wx, wy] = this.screenToWorld(screenX, screenY);
    const bounds = store.game.get_boundaries();
    const { min_row, max_row, min_col, max_col } = bounds;
    const gap = GAP;
    const tolerance = gap + 10;

    for (let i = min_row; i <= max_row + 1; i++) {
      const gapY = i * this.step - gap / 2;
      if (Math.abs(wy - gapY) < tolerance) {
        const boardLeft = min_col * this.step;
        const boardRight = (max_col + 1) * this.step;
        if (boardLeft - 50 < wx && wx < boardRight + 50) {
          const line = i - 1;
          if (store.game.is_valid_h_line(line)) return { type: 'h', line };
        }
      }
    }

    for (let j = min_col; j <= max_col + 1; j++) {
      const gapX = j * this.step - gap / 2;
      if (Math.abs(wx - gapX) < tolerance) {
        const boardTop = min_row * this.step;
        const boardBottom = (max_row + 1) * this.step;
        if (boardTop - 50 < wy && wy < boardBottom + 50) {
          const line = j - 1;
          if (store.game.is_valid_v_line(line)) return { type: 'v', line };
        }
      }
    }
    return null;
  }

  /** 空白區域 = 不在滑塊也不在縫隙。對照 GUI.is_blank_area。 */
  isBlankArea(screenX: number, screenY: number, store: GameStore): boolean {
    return (
      this.getBlockAtPos(screenX, screenY, store) === null &&
      this.getGapAtPos(screenX, screenY, store) === null
    );
  }

  draw(store: GameStore): void {
    const { ctx } = this;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, W, H);

    const bounds = store.game.get_boundaries();
    this.lastBounds = bounds;
    const selectedGap = store.cmd.selectedGap;

    // 1) 無限網格背景
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let r = bounds.min_row - 1; r <= bounds.max_row + 1; r++) {
      for (let c = bounds.min_col - 1; c <= bounds.max_col + 1; c++) {
        const [x, y] = this.worldToScreen(c * this.step, r * this.step);
        ctx.strokeRect(x, y, this.scaledCell, this.scaledCell);
      }
    }

    // 2) 縫隙線（先畫，讓滑塊蓋在上面；選中紅線、其餘灰線）
    this.drawGapLines(bounds, selectedGap);

    // 3) 滑塊（動畫中則用插值位置；著色器描邊；連鎖器提亮）
    const hint = this.chainHintCells(store.currentStep);
    for (let idx = 0; idx < store.game.blocks.length; idx++) {
      const block = store.game.blocks[idx];
      let r = block.row;
      let c = block.col;
      if (this.animation) {
        const t = easeOut(this.animation.progress);
        const sr = this.animation.start[idx][0];
        const sc = this.animation.start[idx][1];
        const er = this.animation.end[idx][0];
        const ec = this.animation.end[idx][1];
        r = sr + (er - sr) * t;
        c = sc + (ec - sc) * t;
      }
      const [x, y] = this.worldToScreen(c * this.step, r * this.step);
      const key = `${Math.round(r)}:${Math.round(c)}`;
      const selected = store.game.selected.has(block);
      const hl = this.highlightCells !== null && this.highlightCells.has(key);

      let fill = selected || hl ? COLORS.block_selected : COLORS.block;
      if (hint && hint.cells.has(key)) {
        const amt = hint.hover[0] === Math.round(r) && hint.hover[1] === Math.round(c) ? 0.55 : 0.35;
        fill = lightenCss(fill, amt);
      }
      const radius = GEOMETRY.block_radius * this.zoom;
      if (this.coloringEnabled && store.currentStep > 1) {
        // 著色器：從滑塊邊緣向內畫一圈分組色（原版 pygame 邊框是向內畫的）
        const ring = Math.max(2, 6 * this.zoom);
        ctx.fillStyle = this.groupColor(Math.round(r), Math.round(c), store.currentStep);
        this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
        ctx.fill();
        const inner = Math.max(0, this.scaledCell - ring * 2);
        const innerRadius = Math.max(0, radius - ring);
        ctx.fillStyle = fill;
        this.roundRect(x + ring, y + ring, inner, inner, innerRadius);
        ctx.fill();
      } else {
        ctx.fillStyle = fill;
        this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
        ctx.fill();
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = Math.max(1, GEOMETRY.block_border_width * this.zoom);
        this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
        ctx.stroke();
      }

      if (this.highlightCells && this.highlightCells.has(key)) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 2;
        this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
        ctx.stroke();
      }
    }

    // 4) 連鎖器：同組的空格也提亮（對照原版 _chain_hint_cells）
    if (hint) {
      const occupied = new Set(store.game.blocks.map((b) => `${b.row}:${b.col}`));
      for (const key of hint.cells) {
        if (occupied.has(key)) continue;
        const [r, c] = key.split(':').map(Number);
        const amt = r === hint.hover[0] && c === hint.hover[1] ? 0.55 : 0.35;
        const [x, y] = this.worldToScreen(c * this.step, r * this.step);
        ctx.fillStyle = lightenCss(COLORS.background, amt);
        this.roundRect(x, y, this.scaledCell, this.scaledCell, GEOMETRY.block_radius * this.zoom);
        ctx.fill();
      }
    }
  }

  private drawGapLines(
    bounds: { min_row: number; max_row: number; min_col: number; max_col: number },
    selectedGap: { type: GapType; line: number } | null,
  ): void {
    const { ctx } = this;
    const gap = this.scaledGap;
    const pad = 20; // 對照原版：縫隙向外多畫 20px，但只在棋盤範圍附近，不跨全屏

    // 棋盤實際左右/上下邊界（螢幕座標）
    const left = this.worldToScreen(bounds.min_col * this.step, 0)[0];
    const right = this.worldToScreen(bounds.max_col * this.step + CELL, 0)[0];
    const top = this.worldToScreen(0, bounds.min_row * this.step)[1];
    const bottom = this.worldToScreen(0, bounds.max_row * this.step + CELL)[1];

    // h（橫縫）：只在棋盤左右範圍（外擴 pad）
    for (let i = bounds.min_row; i <= bounds.max_row + 1; i++) {
      const sy = this.worldToScreen(0, i * this.step - GAP / 2)[1];
      const isSelected = !!selectedGap && selectedGap.type === 'h' && selectedGap.line === i - 1;
      ctx.strokeStyle = isSelected ? COLORS.line : COLORS.gap;
      ctx.lineWidth = isSelected ? GEOMETRY.selected_line_width : Math.max(1, gap);
      ctx.beginPath();
      ctx.moveTo(left - pad, sy);
      ctx.lineTo(right + pad, sy);
      ctx.stroke();
    }

    // v（縱縫）：只在棋盤上下範圍（外擴 pad）
    for (let j = bounds.min_col; j <= bounds.max_col + 1; j++) {
      const sx = this.worldToScreen(j * this.step - GAP / 2, 0)[0];
      const isSelected = !!selectedGap && selectedGap.type === 'v' && selectedGap.line === j - 1;
      ctx.strokeStyle = isSelected ? COLORS.line : COLORS.gap;
      ctx.lineWidth = isSelected ? GEOMETRY.selected_line_width : Math.max(1, gap);
      ctx.beginPath();
      ctx.moveTo(sx, top - pad);
      ctx.lineTo(sx, bottom + pad);
      ctx.stroke();
    }
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
