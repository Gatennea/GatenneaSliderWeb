/**
 * UI 狀態聚合（對照 SliderGUI 的狀態集中式設計）
 * M1 先放核心狀態；計時/面板等後續里程碑再加。
 */

import { createContext, type CommandContext } from '../core/CommandBus.js';
import { SliderMatrix } from '../core/SliderMatrix.js';

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

  /** 便捷方法：轉換謎題（對照 new {m,n,step}）。 */
  newPuzzle(m: number, n: number, step: number): boolean {
    if (step >= Math.max(m, n)) return false;
    this.currentM = m;
    this.currentN = n;
    this.currentStep = step;
    this.game = new SliderMatrix(m, n);
    this.cmd = createContext(this.game, step);
    return true;
  }

  /** 序列化為可存檔的 JSON 結構（體驗版用 map 文本當核心，不照搬原版 matrix/bounds）。 */
  serialize(): SavePayload {
    return {
      version: 1,
      puzzle: { m: this.currentM, n: this.currentN, step: this.currentStep },
      step_count: this.cmd.stepCount,
      map: this.game.export_map(),
      history: this.cmd.history.snapshotAll(),
    };
  }

  /** 由序列化結構還原（相容體驗版 JSON 與原版 save JSON）。 */
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

    // 原版存檔：history.snapshots 內是 matrix + bounds
    const snapshots: { blocks: [number, number][] }[] = [];
    if (Array.isArray(p.history)) {
      snapshots.push(...p.history.filter((h: any) => Array.isArray(h?.blocks)));
    } else if (p.history && Array.isArray(p.history.snapshots)) {
      for (const snap of p.history.snapshots) {
        const blocks = matrixToBlocks(snap?.matrix, snap?.bounds);
        if (blocks) snapshots.push({ blocks });
      }
    }

    if (typeof p.map === 'string' && p.map.trim().length > 0) {
      this.game.import_map(p.map);
      this.game.m = m;
      this.game.n = n;
    } else if (snapshots.length > 0) {
      this.game.restore({ blocks: snapshots[snapshots.length - 1].blocks });
    }

    this.cmd = createContext(this.game, step);
    this.cmd.stepCount = p.step_count ?? 0;
    if (snapshots.length > 0) {
      this.cmd.history.restoreAll(snapshots);
    }
    return true;
  }
}

export interface SavePayload {
  version: number;
  puzzle: { m: number; n: number; step: number };
  step_count: number;
  map?: string;
  history?: any;
}
