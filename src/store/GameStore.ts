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

/**
 * 把「依滑塊順序」排列的編號改成「依位置行主序」排列。
 * 存檔裡的 matrix 是按位置掃出來的，編號必須用同一個順序才不會錯位。
 */
function numbersInMatrixOrder(
  blocks: [number, number][],
  numbers?: (number | null)[],
): (number | null)[] | null {
  if (!numbers) return null;
  const order = blocks
    .map((_, i) => i)
    .sort((a, b) => blocks[a][0] - blocks[b][0] || blocks[a][1] - blocks[b][1]);
  return order.map((i) => numbers[i] ?? null);
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
  /** 數字形態（滑塊帶編號）。過關條件與方形相同，編號只是視覺線索。 */
  numbered: boolean;
  /**
   * 自定義目標形狀（創造模式手造形狀用）。null 表示沿用「m×n 實心矩形」判定。
   * 矩陣每次重建後都要重新掛回，所以集中在各 new SliderMatrix 之後賦值。
   */
  solutionMask: Set<string> | null = null;

  constructor(m = 4, n = 4, step = 2, numbered = false) {
    this.currentM = m;
    this.currentN = n;
    this.currentStep = step;
    this.numbered = numbered;
    this.game = new SliderMatrix(m, n);
    this.game.solutionMask = this.solutionMask;
    this.game.assignNumbers(numbered);
    this.cmd = createContext(this.game, step);
  }

  get solved(): boolean {
    return this.game.is_solved();
  }

  /** 謎題分組鍵（對照 puzzle_key）：數字形態後綴 #num，成績與狀態顯示都用它。 */
  get puzzleKey(): string {
    const base = `${this.currentStep}~${this.currentM}*${this.currentN}`;
    return this.numbered ? `${base}#num` : base;
  }

  get selectedGap() {
    return this.cmd.selectedGap;
  }

  get selectedCells(): Set<string> {
    return new Set([...this.cmd.game.selected].map((b) => `${b.row}:${b.col}`));
  }

  newPuzzle(m: number, n: number, step: number, numbered = this.numbered): boolean {
    if (step >= Math.max(m, n)) return false;
    this.currentM = m;
    this.currentN = n;
    this.currentStep = step;
    this.numbered = numbered;
    this.game = new SliderMatrix(m, n);
    this.game.solutionMask = this.solutionMask;
    this.game.assignNumbers(numbered);
    this.cmd = createContext(this.game, step);
    return true;
  }

  /**
   * 直接套用一段「以 [row,col] 列表描述的局面」作為新謎題起點（歷史清空為單一原點）。
   * 教程載入某一關的起始亂局、創造模式套用手造形狀都走這裡。
   * solutionMask 由呼叫方另行設定（教程為 null → 走矩形判定）。
   */
  applyPuzzle(m: number, n: number, step: number, blocks: [number, number][]): void {
    this.currentM = m;
    this.currentN = n;
    this.currentStep = step;
    this.numbered = false;
    this.game = new SliderMatrix(m, n);
    this.game.solutionMask = this.solutionMask;
    this.game.restore({ blocks });
    this.cmd = createContext(this.game, step);
    this.cmd.history.save_snapshot(this.game);
    this.cmd.stepCount = 0;
  }

  /**
   * 新手引導用的固定局面：4×4 等級 1，最下面一整排向右錯開一格。
   * 只要「選第 3、4 行之間的橫縫 → 點最下面一排 → 往左推」一步就回到原位，
   * 一次走完整套「點縫 → 點塊 → 推」的流程。
   */
  loadTutorialPosition(): void {
    this.newPuzzle(4, 4, 1, false);
    for (const b of this.game.blocks) {
      if (b.row === 3) b.location = [3, b.col + 1];
    }
    // 重建歷史，讓這個局面成為「原點」（撤銷不會退回還原態）
    this.cmd = createContext(this.game, 1);
    this.cmd.history.save_snapshot(this.game);
  }

  /** 在當前謎題上切換數字形態（重新編號，不重開一局）。 */
  setNumbered(on: boolean): void {
    if (this.numbered === on) return;
    this.numbered = on;
    this.game.assignNumbers(on);
  }

  /** 序列化為與原版完全一致的結構。 */
  serialize(): SavePayload {
    const entries = this.cmd.history.snapshotAll();
    const snapshots = entries.map((e) => {
      const { matrix, bounds } = blocksToMatrix(e.blocks);
      const snap: any = { matrix, bounds };
      if (e.move_info) snap.move_info = e.move_info;
      // 編號另外存，不塞進 matrix：原版存檔格式維持 0/1，原版開啟時退化為方形
      const nums = numbersInMatrixOrder(e.blocks, e.numbers);
      if (nums) snap.numbers = nums;
      return snap;
    });
    return {
      version: 1,
      puzzle: {
        m: this.currentM,
        n: this.currentN,
        step: this.currentStep,
        ...(this.numbered ? { kind: 'numbered' } : {}),
      },
      step_count: this.cmd.stepCount,
      ...(this.solutionMask ? { solution: Array.from(this.solutionMask) } : {}),
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
    this.numbered = (p.puzzle as any)?.kind === 'numbered';
    this.solutionMask = Array.isArray((p as any).solution)
      ? new Set((p as any).solution as string[])
      : null;
    this.game = new SliderMatrix(m, n);
    this.game.solutionMask = this.solutionMask;

    // 將各格式歷史轉為 HistoryEntry（blocks + numbers? + move_info?）
    const entries: HistoryEntry[] = [];
    if (Array.isArray(p.history)) {
      // 舊版網頁格式：history 是 blocks 陣列
      for (const h of p.history as any[]) {
        if (Array.isArray(h?.blocks)) entries.push({ blocks: h.blocks, ...(h.move_info ? { move_info: h.move_info } : {}) });
      }
    } else if (p.history && Array.isArray(p.history.snapshots)) {
      // 原版格式：matrix + bounds + move_info?
      // numbers 是網頁版數字形態的附加欄位，順序與 matrix 掃描順序一致
      for (const snap of p.history.snapshots as any[]) {
        const blocks = matrixToBlocks(snap?.matrix, snap?.bounds);
        if (blocks) {
          entries.push({
            blocks,
            ...(Array.isArray(snap?.numbers) ? { numbers: snap.numbers } : {}),
            ...(snap?.move_info ? { move_info: snap.move_info } : {}),
          });
        }
      }
    }

    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      this.game.restore({ blocks: last.blocks, ...(last.numbers ? { numbers: last.numbers } : {}) });
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
  /** 創造模式手造形狀的目標（座標 "r:c" 列表）；缺省表示走 m×n 矩形判定。 */
  solution?: string[];
  history?: { history_index: number; snapshots: any[] } | any[];
}
