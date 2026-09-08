/**
 * UI 狀態聚合（對照 SliderGUI 的狀態集中式設計）
 * 存檔格式與原版完全一致：{version, puzzle, step_count, history:{history_index, snapshots:[{matrix,bounds,move_info?}]}}
 */

import { createContext, type CommandContext } from '../core/CommandBus.js';
import { SliderMatrix } from '../core/SliderMatrix.js';
import type { HistoryEntry } from '../core/GameHistory.js';

function matrixToBlocks(matrix: unknown, bounds: any): [number, number][] | null {
  if (!Array.isArray(matrix) || !bounds || !Number.isInteger(bounds.min_row) || !Number.isInteger(bounds.min_col)) return null;
  const out: [number, number][] = [];
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) return null;
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 1) out.push([bounds.min_row + r, bounds.min_col + c]);
    }
  }
  return out;
}

function blocksToMatrix(blocks: [number, number][]): { matrix: number[][]; bounds: { min_row: number; max_row: number; min_col: number; max_col: number } } {
  if (blocks.length === 0) {
    return { matrix: [], bounds: { min_row: 0, max_row: 0, min_col: 0, max_col: 0 } };
  }
  const rows = blocks.map((b) => b[0]);
  const cols = blocks.map((b) => b[1]);
  const min_row = Math.min(...rows);
  const max_row = Math.max(...rows);
  const min_col = Math.min(...cols);
  const max_col = Math.max(...cols);
  const set = new Set(blocks.map((b) => `${b[0]}:${b[1]}`));
  const matrix: number[][] = [];
  for (let r = min_row; r <= max_row; r++) {
    const row: number[] = [];
    for (let c = min_col; c <= max_col; c++) {
      row.push(set.has(`${r}:${c}`) ? 1 : 0);
    }
    matrix.push(row);
  }
  return { matrix, bounds: { min_row, max_row, min_col, max_col } };
}

export class GameStore {
  game: SliderMatrix;
  cmd: CommandContext;
  currentM: number;
  currentN: number;
  currentStep: number;

  constructor(m = 4, n = 4, step = 2) {
    this.currentM = m;
    this.currentN = n;
    this.currentStep = step;
    this.game = new SliderMatrix(m, n);
    this.cmd = createContext(this.game, step);
  }

  get solved(): boolean {
    return this.game.is_solved();
  }

  get selectedGap() {
    return this.cmd.selectedGap;
  }

  get selectedCells(): Set<string> {
    return new Set([...this.cmd.game.selected].map((b) => `${b.row}:${b.col}`));
  }

  newPuzzle(m: number, n: number, step: number): boolean {
    if (step >= Math.max(m, n)) return false;
    this.currentM = m;
    this.currentN = n;
    this.currentStep = step;
    this.game = new SliderMatrix(m, n);
    this.cmd = createContext(this.game, step);
    return true;
  }

  /** 序列化為與原版完全一致的結構。 */
  serialize(): SavePayload {
    const entries = this.cmd.history.snapshotAll();
    const snapshots = entries.map((e) => {
      const { matrix, bounds } = blocksToMatrix(e.blocks);
      const snap: any = { matrix, bounds };
      if (e.move_info) snap.move_info = e.move_info;
      return snap;
    });
    return {
      version: 1,
      puzzle: { m: this.currentM, n: this.currentN, step: this.currentStep },
      step_count: this.cmd.stepCount,
      history: {
        history_index: this.cmd.history.currentIndex,
        snapshots,
      },
    };
  }

  /** 由序列化結構還原（相容原版 save JSON；也相容舊版網頁格式）。 */
  deserialize(p: SavePayload): boolean {
    const m = p.puzzle?.m ?? this.currentM;
    const n = p.puzzle?.n ?? this.currentN;
    const step = p.puzzle?.step ?? this.currentStep;
    if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step)) return false;
    if (step >= Math.max(m, n)) return false;

    this.currentM = m;
    this.currentN = n;
    this.currentStep = step;
    this.game = new SliderMatrix(m, n);

    // 將各格式歷史轉為 HistoryEntry（blocks + move_info?）
    const entries: HistoryEntry[] = [];
    if (Array.isArray(p.history)) {
      // 舊版網頁格式：history 是 blocks 陣列
      for (const h of p.history as any[]) {
        if (Array.isArray(h?.blocks)) entries.push({ blocks: h.blocks, ...(h.move_info ? { move_info: h.move_info } : {}) });
      }
    } else if (p.history && Array.isArray(p.history.snapshots)) {
      // 原版格式：matrix + bounds + move_info?
      for (const snap of p.history.snapshots as any[]) {
        const blocks = matrixToBlocks(snap?.matrix, snap?.bounds);
        if (blocks) entries.push({ blocks, ...(snap?.move_info ? { move_info: snap.move_info } : {}) });
      }
    }

    if (entries.length > 0) {
      this.game.restore({ blocks: entries[entries.length - 1].blocks });
    }

    this.cmd = createContext(this.game, step);
    this.cmd.stepCount = p.step_count ?? 0;
    if (entries.length > 0) {
      this.cmd.history.restoreAll(entries);
      const idx = p.history && typeof p.history === 'object' && 'history_index' in p.history
        ? (p.history as any).history_index
        : entries.length - 1;
      this.cmd.history.setIndex(idx);
    }
    return true;
  }
}

export interface SavePayload {
  version: number;
  puzzle: { m: number; n: number; step: number };
  step_count: number;
  history?: { history_index: number; snapshots: any[] } | any[];
}
