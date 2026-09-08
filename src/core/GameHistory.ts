/**
 * 快照式撤銷/重做（對照 history.py::GameHistory）
 *
 * 原版快照存 matrix + bounds；網頁版直接存 blocks 位置列表，
 * 語義一致、更適合純邏輯層。
 */

import { Block } from './Block.js';
import type { SliderMatrix } from './SliderMatrix.js';

interface Entry {
  blocks: [number, number][];
}

export class GameHistory {
  private entries: Entry[] = [];
  private index = -1;

  /** 保存當前狀態快照；若不在歷史末尾則截斷。 */
  save_snapshot(game: SliderMatrix): void {
    const snapshot: Entry = {
      blocks: game.blocks.map((b) => [b.row, b.col] as [number, number]),
    };
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
  snapshotAll(): { blocks: [number, number][] }[] {
    return this.entries.map((e) => ({ blocks: e.blocks.map(([r, c]) => [r, c]) }));
  }

  /** 由快照列表還原（index 設為末位，對應載入時停在最新狀態）。 */
  restoreAll(list: { blocks: [number, number][] }[]): void {
    this.entries = list.map((e) => ({ blocks: e.blocks.map(([r, c]) => [r, c] as [number, number]) }));
    this.index = this.entries.length - 1;
  }

  private apply(game: SliderMatrix, entry: Entry): void {
    game.blocks = entry.blocks.map(([r, c]) => new Block([r, c]));
    game.selected.clear();
  }
}
