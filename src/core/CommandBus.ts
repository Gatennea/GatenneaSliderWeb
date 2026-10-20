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
  // 禁止整體滑動：合法縫隙（is_valid_*_line）兩側必有方塊，選中組不可能等於全體；
  // 相等只可能是繞過 selectGap 校驗的邊界縫。整盤剛體平移不改變形狀，而判勝只看
  // 形狀——零進度的無意義操作，命令層直接拒絕。
  // （引擎層 try_move 對此放行，與原版一致；規則屬於「網站不給這麼玩」，不是遊戲規則。）
  if (ctx.game.selected.size > 0 && ctx.game.selected.size === ctx.game.blocks.length) {
    return { ok: false, message: '整盤平移沒有意義：過關只看形狀，不看絕對位置' };
  }

  const finalPositions = ctx.game.try_move(direction, ctx.step);
  if (!finalPositions) {
    return { ok: false, message: '移動不合法（碰撞或斷連）' };
  }

  const movedPositions = ctx.game.blocks
    .filter((b) => ctx.game.selected.has(b))
    .map((b) => [b.row, b.col] as [number, number]);

  ctx.game.commit_move(finalPositions);
  // 對照原版：移動後保留縫隙/滑塊組選中，以便連續滑動
  ctx.stepCount += 1;
  ctx.history.save_snapshot(ctx.game, {
    direction,
    step: ctx.step,
    gap_type: ctx.selectedGap?.type,
    gap_line: ctx.selectedGap?.line,
    moved_positions: movedPositions,
  });
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

export interface ShuffleOptions {
  /**
   * 是否走「安全打亂」（每一步都驗證可逆，保證打亂結果必定可還原）。
   * 預設 true —— 本遊戲存在合法但不可逆的一步，普通隨機打亂有機率直接把玩家
   * 送進還原不了的死局。想要與原版逐位一致的行為才設 false。
   */
  safe?: boolean;
  rng?: () => number;
}

/**
 * 安全打亂的 attempts 折減係數。
 *
 * 普通 shuffle() 每次嘗試有約 2/3 會因 try_move 失敗而作廢（實測成功率約三成），
 * 但 shuffle_safe() 會在 tries 內換一組再試，幾乎每次都能走成功（成功率接近 100%）。
 * 同樣的 attempts 下，安全打亂的**實際步數會多好幾倍** —— 既過度打亂，
 * 大棋盤還會拖慢（8×8 attempts=640 實測 1.8 秒，畫面明顯卡住）。
 * 故折減 attempts，讓兩種模式的實際打亂步數大致相當。
 */
const SAFE_ATTEMPTS_RATIO = 0.4;

export function shuffle(ctx: CommandContext, attempts = 100, opts: ShuffleOptions = {}): Reply {
  const safe = opts.safe ?? true;
  ctx.shuffleBefore = ctx.game.snapshot();
  if (safe) {
    ctx.game.shuffle_safe(Math.max(1, Math.round(attempts * SAFE_ATTEMPTS_RATIO)), ctx.step, opts.rng);
  } else {
    ctx.game.shuffle(attempts, ctx.step, opts.rng);
  }
  ctx.selectedGap = null;
  ctx.selectedBlock = null;
  ctx.stepCount = 0;
  ctx.history = new GameHistory();
  // 打亂後存快照，作為 undo 的基準（退回打亂後第一個狀態）
  ctx.history.save_snapshot(ctx.game);
  return { ok: true, message: '已打亂' };
}

/** reset = 回到復原狀態並清空歷史（對照原版 reset_puzzle → new_puzzle(current m/n/step)）。 */
export function reset(ctx: CommandContext): Reply {
  const m = ctx.game.m;
  const n = ctx.game.n;
  ctx.game.resetTo(m, n);
  ctx.selectedGap = null;
  ctx.selectedBlock = null;
  ctx.stepCount = 0;
  ctx.history = new GameHistory();
  ctx.history.save_snapshot(ctx.game);
  ctx.shuffleBefore = null;
  return { ok: true, message: '已重置' };
}
