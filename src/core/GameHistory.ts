/**
 * 快照式撤銷/重做（對照 history.py::GameHistory + move_info）
 *
 * 每筆快照記錄當下版面與「如何從前一版面到達此版面」的 move_info，
 * 供撤銷/重做只對該步滑塊組做動畫（對照原版 _start_undo_redo_animation）。
 */

import { Block } from './Block.js';
import type { SliderMatrix } from './SliderMatrix.js';

export interface MoveInfo {
  direction: 'w' | 's' | 'a' | 'd';
  step: number;
  gap_type?: 'h' | 'v';
  gap_line?: number;
  /** 移動前選中組的位置（原版 moved_positions） */
  moved_positions: [number, number][];
}

export interface HistoryEntry {
  blocks: [number, number][];
  move_info?: MoveInfo;
}

export class GameHistory {
  private entries: HistoryEntry[] = [];
  private index = -1;

  /** 保存當前狀態快照；若不在歷史末尾則截斷。 */
  save_snapshot(game: SliderMatrix, move_info?: MoveInfo): void {
    const snapshot: HistoryEntry = {
      blocks: game.blocks.map((b) => [b.row, b.col] as [number, number]),
    };
    if (move_info) snapshot.move_info = move_info;
    if (this.index < this.entries.length - 1) {
      this.entries = this.entries.slice(0, this.index + 1);
    }
    this.entries.push(snapshot);
    this.index = this.entries.length - 1;
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index >= 0 && this.index < this.entries.length - 1;
  }

  get length(): number {
    return this.entries.length;
  }

  get currentIndex(): number {
    return this.index;
  }

  /** 目前快照的 move_info（最後一步如何到達目前版面；undo 用它反向動畫）。 */
  currentMoveInfo(): MoveInfo | null {
    return this.entries[this.index]?.move_info ?? null;
  }

  /** 下一個 redo 目標快照的 move_info。 */
  nextMoveInfo(): MoveInfo | null {
    return this.entries[this.index + 1]?.move_info ?? null;
  }

  /** 撤銷：回退一步，並把快照套用到 game。 */
  undo(game: SliderMatrix): boolean {
    if (!this.canUndo) return false;
    this.index -= 1;
    this.apply(game, this.entries[this.index]);
    return true;
  }

  /** 重做：前進一步。 */
  redo(game: SliderMatrix): boolean {
    if (!this.canRedo) return false;
    this.index += 1;
    this.apply(game, this.entries[this.index]);
    return true;
  }

  /** 直接跳到指定歷史步（虛擬鍵盤「跳到某步」用）。 */
  jumpTo(game: SliderMatrix, index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.entries.length) return false;
    this.index = index;
    this.apply(game, this.entries[this.index]);
    return true;
  }

  /** 匯出全部快照（供存檔）。 */
  snapshotAll(): HistoryEntry[] {
    return this.entries.map((e) => ({
      blocks: e.blocks.map(([r, c]) => [r, c] as [number, number]),
      ...(e.move_info ? { move_info: e.move_info } : {}),
    }));
  }

  /** 由快照列表還原（index 設為末位，對應載入時停在最新狀態）。 */
  restoreAll(list: HistoryEntry[]): void {
    this.entries = list.map((e) => ({
      blocks: e.blocks.map(([r, c]) => [r, c] as [number, number]),
      ...(e.move_info ? { move_info: e.move_info } : {}),
    }));
    this.index = this.entries.length - 1;
  }

  private apply(game: SliderMatrix, entry: HistoryEntry): void {
    game.blocks = entry.blocks.map(([r, c]) => new Block([r, c]));
    game.selected.clear();
  }
}
