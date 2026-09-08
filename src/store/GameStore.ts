/**
 * UI 狀態聚合（對照 SliderGUI 的狀態集中式設計）
 * M1 先放核心狀態；計時/面板等後續里程碑再加。
 */

import { createContext, type CommandContext } from '../core/CommandBus.js';
import { SliderMatrix } from '../core/SliderMatrix.js';

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
}
