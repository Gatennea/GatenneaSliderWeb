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

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  zoom: number;
  cameraX: number;
  cameraY: number;
  animation: MoveAnimation | null = null;
  /** 選中動畫：短暫高亮的格子集合（undo/redo 時顯示移動過的組） */
  highlightCells: Set<string> | null = null;

  constructor(ctx: CanvasRenderingContext2D, zoom = 1) {
    this.ctx = ctx;
    this.zoom = zoom;
    this.cameraX = 0;
    this.cameraY = 0;
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

    // 3) 滑塊（動畫中則用插值位置）
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
      const selected = store.game.selected.has(block);
      ctx.fillStyle = selected ? COLORS.block_selected : COLORS.block;
      const radius = GEOMETRY.block_radius * this.zoom;
      this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
      ctx.fill();

      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = Math.max(1, GEOMETRY.block_border_width * this.zoom);
      this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
      ctx.stroke();

      if (this.highlightCells && this.highlightCells.has(`${Math.round(r)}:${Math.round(c)}`)) {
        ctx.strokeStyle = 'rgba(255, 205, 60, 0.9)';
        ctx.lineWidth = 3;
        this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
        ctx.stroke();
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
