/**
 * 復原彈窗的觸發判斷（純邏輯、無 DOM——方便無頭測試）。
 * 對照原版 GUI._maybe_show_solved_popup 的邊緣檢測與三個抑制條件：
 *
 *   became_solved = solved and not _prev_solved   （未復原→復原才算「過關」）
 *   抑制：via_redo（最後一步由重做實現）/ suppress（由撤銷實現）/
 *        _tut_board_locked（教程解法回放中，播完會撤回初始態）
 *   每次調用都同步 _prev_solved，保證「復原→離開→再復原」可再次觸發。
 */

export interface SolvedPopupTriggerOpts {
  /** 最後一步由重做實現（原版 via_redo：此時不提示） */
  viaRedo?: boolean;
  /** 由撤銷實現（原版 suppress：撤銷回到已達成的復原態，不重複提示） */
  viaUndo?: boolean;
  /** 教程解法回放中（原版 _tut_board_locked） */
  locked?: boolean;
}

export class SolvedPopupTracker {
  private prevSolved: boolean;

  constructor(initialSolved = false) {
    this.prevSolved = initialSolved;
  }

  /**
   * 換局 / 打亂 / 重設等「非玩家操作」後呼叫：同步邊緣檢測基線，永不觸發。
   * （原版把這個同步散在各命令裡；這裡集中一個方法，呼叫方不會漏。）
   */
  reset(solved: boolean): void {
    this.prevSolved = solved;
  }

  /**
   * 狀態提交後呼叫；回傳 true = 應該彈出復原懸浮窗。
   * 無論觸發與否都會同步基線——重複呼叫同一狀態不會二次觸發。
   */
  note(solved: boolean, opts: SolvedPopupTriggerOpts = {}): boolean {
    const became = solved && !this.prevSolved;
    this.prevSolved = solved;
    return became && !opts.viaRedo && !opts.viaUndo && !opts.locked;
  }
}
