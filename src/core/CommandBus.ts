/**
 * 內部指令匯流排（對照 gui/events.py::process_commands 的動作語義）
 *
 * 體驗版不做 HTTP/stdin 通道；用同一套 action 名稱封裝，方便日後
 * 把求解器掛到 Web Worker 時沿用原版指令協定。
 */

import { GameHistory } from './GameHistory.js';
import { SliderMatrix } from './SliderMatrix.js';
import { isValidDirectionForGap, type Direction, type GapType } from './rules.js';

export interface Reply {
  ok: boolean;
  message: string;
}

export interface CommandContext {
  game: SliderMatrix;
  history: GameHistory;
  /** 目前選中的縫隙（對照 SliderGUI.selected_gap） */
  selectedGap: { type: GapType; line: number } | null;
  /** 目前選中的滑塊位置（對照 SliderGUI.selected_block） */
  selectedBlock: [number, number] | null;
  step: number;
  stepCount: number;
  shuffleBefore: SnapshotMark | null;
}

export interface SnapshotMark {
  blocks: [number, number][];
}

export function createContext(game: SliderMatrix, step: number): CommandContext {
  const ctx: CommandContext = {
    game,
    history: new GameHistory(),
    selectedGap: null,
    selectedBlock: null,
    step,
    stepCount: 0,
    shuffleBefore: null,
  };
  // 存初始快照作為 undo 基準（第一個 move 才能撤回到初始版面）
  ctx.history.save_snapshot(game);
  return ctx;
}

export function selectGap(ctx: CommandContext, type: GapType, line: number): Reply {
  const valid =
    type === 'h' ? ctx.game.is_valid_h_line(line) : ctx.game.is_valid_v_line(line);
  if (!valid) {
    return { ok: false, message: `${type} 分割線 ${line} 不合法` };
  }
  ctx.selectedGap = { type, line };
  ctx.game.selected.clear();
  ctx.selectedBlock = null;
  return { ok: true, message: `已選中縫隙: ${type} ${line}` };
}

export function selectBlock(ctx: CommandContext, row: number, col: number): Reply {
  if (!ctx.selectedGap) {
    return { ok: false, message: '請先選中縫隙' };
  }
  const block = ctx.game.blocks.find((b) => b.row === row && b.col === col);
  if (!block) {
    return { ok: false, message: `位置 (${row}, ${col}) 沒有滑塊` };
  }
  ctx.game.opt(ctx.selectedGap.type, ctx.selectedGap.line, block);
  ctx.selectedBlock = [row, col];
  const n = ctx.game.selected.size;
  return { ok: true, message: `選中滑塊組 共${n}個` };
}

export function move(ctx: CommandContext, direction: Direction): Reply {
  if (!ctx.selectedGap) {
    return { ok: false, message: '請先選中縫隙' };
  }
  if (!ctx.selectedBlock) {
    return { ok: false, message: '請先選中滑塊' };
  }
  if (!isValidDirectionForGap(ctx.selectedGap.type, direction)) {
    const g = ctx.selectedGap.type === 'h' ? 'h→a/d' : 'v→w/s';
    return { ok: false, message: `移動方向非法（${g}）` };
  }

  const finalPositions = ctx.game.try_move(direction, ctx.step);
  if (!finalPositions) {
    return { ok: false, message: '移動不合法（碰撞或斷連）' };
  }

  ctx.game.commit_move(finalPositions);
  ctx.game.selected.clear();
  ctx.selectedGap = null;
  ctx.selectedBlock = null;
  ctx.stepCount += 1;
  ctx.history.save_snapshot(ctx.game);
  return { ok: true, message: `移動 ${direction}` };
}

export function undo(ctx: CommandContext): Reply {
  if (!ctx.history.canUndo) {
    return { ok: false, message: '沒有可撤銷的步驟' };
  }
  ctx.history.undo(ctx.game);
  ctx.stepCount = Math.max(0, ctx.stepCount - 1);
  return { ok: true, message: '撤銷' };
}

export function redo(ctx: CommandContext): Reply {
  if (!ctx.history.canRedo) {
    return { ok: false, message: '沒有可重做的步驟' };
  }
  ctx.history.redo(ctx.game);
  ctx.stepCount += 1;
  return { ok: true, message: '重做' };
}

export function shuffle(ctx: CommandContext, attempts = 100): Reply {
  ctx.shuffleBefore = ctx.game.snapshot();
  ctx.game.shuffle(attempts, ctx.step);
  ctx.selectedGap = null;
  ctx.selectedBlock = null;
  ctx.stepCount = 0;
  ctx.history = new GameHistory();
  // 打亂後存快照，作為 undo 的基準（退回打亂後第一個狀態）
  ctx.history.save_snapshot(ctx.game);
  return { ok: true, message: '已打亂' };
}

/** reset = 回到打亂前（體驗版語義：回到本局打亂前快照），對照原版 reset。 */
export function reset(ctx: CommandContext): Reply {
  if (ctx.shuffleBefore) {
    ctx.game.restore(ctx.shuffleBefore);
    ctx.selectedGap = null;
    ctx.selectedBlock = null;
    ctx.stepCount = 0;
    ctx.history = new GameHistory();
    ctx.history.save_snapshot(ctx.game);
    return { ok: true, message: '已重置' };
  }
  return { ok: false, message: '尚無可重置的起點' };
}
