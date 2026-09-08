/**
 * 求解器預留介面（體驗版不做）
 *
 * 原版：solver/__init__.py SOLVER_ALGORITHMS 註冊表
 * 網頁版：日後可掛 Web Worker / Wasm 調用，不阻塞主線程。
 * 語義對照 readme.md §5：
 *   f(game, step, max_steps, cancel_check?, progress_callback?) -> list<action> | null
 */
export function solveNotImplemented(): never {
  throw new Error('體驗版不含求解器功能');
}
