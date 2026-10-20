/**
 * 棋盤互動控制器（M2）
 * 對照 gui/events.py 的三連互動與 gui/renderer.py 的命中測試。
 *
 * - 點縫隙 → selectGap（再點同縫隙 = 取消）
 * - 點方塊（已選縫隙）→ selectBlock（DFS 選中組）
 * - 鍵盤/方向鍵/拖動 → move（先 try_move 再 commit；非法則閃紅提示）
 * - 空白拖拽 → 平移鏡頭（camera）；**按在滑塊上不平移**（對照原版：點滑塊不能拖動地圖）
 * - **禁止整體滑動**：合法縫隙（is_valid_*_line）兩側必有方塊，選中組不可能是全體；
 *   手勢 8 區映射遇到整盤外沿會算出邊界縫，必須過 selectGap 校驗。命令層
 *   （CommandBus.move）與本層（animateMove）雙重攔截「把所有方塊作為一個剛體平移」；
 *   引擎層 try_move 對此放行，與原版語義一致——這是「網站不給這麼玩」，不是遊戲規則。
 */

import { BoardRenderer } from '../render/BoardRenderer.js';
import { GameStore } from '../store/GameStore.js';
import { selectBlock, selectGap } from '../core/CommandBus.js';
import { isValidDirectionForGap, type Direction } from '../core/rules.js';

export interface BoardControllerUI {
  canvas: HTMLCanvasElement;
  renderer: BoardRenderer;
  store: GameStore;
  /** 狀態/提示文字更新（main 據此顯示 toast / status） */
  onStatus?: (message: string) => void;
  /** 需要重繪時呼叫（main 的 on-demand rAF） */
  requestPaint?: () => void;
  /** 成功移動提交後呼叫（main 用於 autosave） */
  onChanged?: () => void;
  /** 縮放變更時呼叫（main 同步右側縮放滑條） */
  onZoomChange?: () => void;
  /** 移動前檢查（回傳訊息表示禁止移動，例如競速模式未開始） */
  beforeMove?: () => string | null;
  /** 復原懸浮窗按 Enter 保存（main 接 downloadSave） */
  onPopupSave?: () => void;
}

const DRAG_MOVE_THRESHOLD = 18;
/**
 * 觸控的判定門檻比滑鼠高一截（手機專項第 12 項「太容易誤觸」）：
 * 手指按下時會先抖一下、點擊也常帶幾 px 位移，門檻太小會把「點一下」誤判成
 * 「拖了某個方向」——結果是想選縫隙卻直接把滑塊推走。
 */
const DRAG_MOVE_THRESHOLD_TOUCH = 28;

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  /** 拖拽起始的 camera（空白平移用） */
  camX: number;
  camY: number;
  moved: boolean;
  /** 拖動選中組移動的累積向量 */
  ax: number;
  ay: number;
  /** 按下處若在滑塊上則禁止平移（對照原版：點滑塊不能拖動地圖） */
  pan: boolean;
  /** 這次是手指還是滑鼠（影響拖動門檻與點擊判定） */
  touch: boolean;
}

const DIRECTION_KEYS: Record<string, Direction> = {
  w: 'w',
  W: 'w',
  s: 's',
  S: 's',
  a: 'a',
  A: 'a',
  d: 'd',
  D: 'd',
  ArrowUp: 'w',
  ArrowDown: 's',
  ArrowLeft: 'a',
  ArrowRight: 'd',
};

/** 拖動判定為「移動」的最低位移（px） */

interface DirectGesture { gap: { type: 'h' | 'v'; line: number }; direction: Direction; }
const GAP_ABBR: ('d' | 'l' | 'r' | 'u')[] = ['d', 'l', 'r', 'd', 'u', 'r', 'l', 'u'];
const DIR_ABBR: ('r' | 'u' | 'l' | 'd')[] = ['r', 'u', 'u', 'l', 'l', 'd', 'd', 'r'];

/** 直接拖拽 8 區對應：0~45° 為第 0 區，每區 45°。
 * 縫隙順序：d l r d u r l u（d=下沿 h, l=左沿 v, r=右沿 v, u=上沿 h）
 * 移動順序：r u u l l d d r
 *
 * ⚠️ 起點方塊在整盤外沿時，這個映射會算出「邊界縫」（line = max_row / max_col），
 * 縫隙兩側只有一側有方塊——直接賦值 selectedGap 會讓整盤被一起拖走。呼叫方必須
 * 把結果交回 selectGap 校驗（is_valid_*_line 會否掉邊界縫）。
 */
export function directGestureFromDrag(row: number, col: number, dx: number, dy: number): DirectGesture | null {
  const angle = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360; // y 向上：0°=右、90°=上
  const sector = Math.floor(angle / 45) % 8;
  const gapAbbr = GAP_ABBR[sector];
  const moveAbbr = DIR_ABBR[sector];
  let gap: { type: 'h' | 'v'; line: number };
  if (gapAbbr === 'd') {
    gap = { type: 'h', line: row };       // 下沿：row 到 row+1 之間
  } else if (gapAbbr === 'u') {
    gap = { type: 'h', line: row - 1 };   // 上沿：row-1 到 row 之間
  } else if (gapAbbr === 'l') {
    gap = { type: 'v', line: col - 1 };   // 左沿
  } else {
    gap = { type: 'v', line: col };       // 右沿
  }
  const direction: Direction =
    moveAbbr === 'r' ? 'd' : moveAbbr === 'l' ? 'a' : moveAbbr === 'u' ? 'w' : 's';
  return { gap, direction };
}


export class BoardController {
  private ui: BoardControllerUI;
  private drag: DragState;
  /** 右側面板「滑動動畫」開關；關閉時移動瞬間完成 */
  animationEnabled = true;
  /** 右側面板「速度」滑條控制的移動動畫時長（ms） */
  moveDurationMs = 180;
  /** 控制模式：單次觸控（直接拖拽）、兩次觸控（先選縫隙再選組）、鼠標鍵盤（鍵盤移動） */
  singleTouchEnabled = true;
  twoTouchEnabled = true;
  keyboardMouseEnabled = true;

  /**
   * 能不能「選中」縫隙/滑塊（原版 events.py 的 selectable）。
   *
   * 原版是 `two_touch_on or mouse_kb_on`——兩次觸控與鼠標鍵盤**任一**開著就能選，
   * 因為鼠標也是靠點縫隙/點方塊來選中的（關掉兩者就沒有任何選中手段了）。
   * 單次觸控不在條件裡：它的拖拽自帶定縫，不需要先選。
   */
  get selectable(): boolean {
    return this.twoTouchEnabled || this.keyboardMouseEnabled;
  }
  /** 單次觸控完成後是否清空選中，確保下次拖拽是全新的單次操作 */
  clearSelectionAfterMove = false;
  private pinchDist = 0;
  /** 按下時的鼠標鍵（0=左鍵）；非左鍵不觸發點擊/滑動（原版僅左鍵操作） */
  private downButton = 0;
  private pinchZoom = 1;
  private pinchActive = false;

  constructor(ui: BoardControllerUI) {
    this.ui = ui;
    this.drag = { active: false, startX: 0, startY: 0, camX: 0, camY: 0, moved: false, ax: 0, ay: 0, pan: true, touch: false };
    this.attach();
  }

  /** 播放一段過場動畫（undo/redo 用）：從 from 到 to 平滑過渡後停在 to。 */
  playTransition(from: [number, number][], to: [number, number][], durationMs = this.moveDurationMs): void {
    const renderer = this.ui.renderer;
    renderer.animation = { start: from, end: to, progress: 0, durationMs };
    const t0 = performance.now();
    const frame = (now: number): void => {
      const anim = renderer.animation;
      if (!anim) return;
      const p = Math.min(1, (now - t0) / anim.durationMs);
      anim.progress = p;
      this.ui.requestPaint?.();
      if (p < 1) requestAnimationFrame(frame);
      else renderer.animation = null;
    };
    requestAnimationFrame(frame);
  }

  private get canvas(): HTMLCanvasElement {
    return this.ui.canvas;
  }

  private notify(message: string): void {
    this.ui.onStatus?.(message);
    this.ui.requestPaint?.();
  }

  private flashInvalid(): void {
    // 簡化的非法移動反饋：短暫把畫布外框閃紅
    const c = this.canvas;
    const prev = c.style.outline;
    c.style.transition = 'outline 0.12s';
    c.style.outline = '3px solid rgba(255, 0, 0, 0.85)';
    setTimeout(() => {
      c.style.outline = prev || 'none';
    }, 200);
  }

  private attach(): void {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => this.onPointerDown(e.offsetX, e.offsetY, e.button));
    c.addEventListener('mousemove', (e) => this.onPointerMove(e.offsetX, e.offsetY));
    window.addEventListener('mouseup', () => this.onPointerUp());

    // 觸控
    const dist = (a: Touch, b: Touch): number =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    c.addEventListener('mousemove', (e) => this.updateHover(e.offsetX, e.offsetY));
    c.addEventListener('mouseleave', () => {
      this.ui.renderer.hoverCell = null;
      this.ui.requestPaint?.();
    });

    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length >= 2) {
        this.pinchDist = dist(e.touches[0], e.touches[1]);
        this.pinchZoom = this.ui.renderer.zoom;
        this.pinchActive = true;
        return;
      }
      const t = e.touches[0];
      const rect = c.getBoundingClientRect();
      this.onPointerDown(t.clientX - rect.left, t.clientY - rect.top, 0, true);
    }, { passive: false });
    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length >= 2 && this.pinchActive && this.pinchDist > 0) {
        const d = dist(e.touches[0], e.touches[1]);
        const factor = d / this.pinchDist;
        this.ui.renderer.zoom = Math.max(0.1, Math.min(4, this.pinchZoom * factor));
        this.ui.onZoomChange?.();
        this.ui.requestPaint?.();
        return;
      }
      const t = e.touches[0];
      const rect = c.getBoundingClientRect();
      this.onPointerMove(t.clientX - rect.left, t.clientY - rect.top);
    }, { passive: false });
    c.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this.pinchActive) {
        if (e.touches.length < 2) this.pinchActive = false;
        return;
      }
      this.onPointerUp();
    }, { passive: false });

    window.addEventListener('keydown', (e) => this.onKeyDown(e));

    // 右鍵取消選中（對照原版 event.button == 3）
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.deselect();
      this.notify('已取消选中');
    });
  }

  private updateHover(x: number, y: number): void {
    const { renderer } = this.ui;
    if (!renderer.chainHintEnabled) {
      if (renderer.hoverCell) { renderer.hoverCell = null; this.ui.requestPaint?.(); }
      return;
    }
    const cell = renderer.getCellAtPos(x, y);
    const prev = renderer.hoverCell;
    const changed = (!!cell !== !!prev) || (cell && prev && (cell[0] !== prev[0] || cell[1] !== prev[1]));
    renderer.hoverCell = cell;
    if (changed) this.ui.requestPaint?.();
  }

  private onPointerDown(x: number, y: number, button = 0, touch = false): void {
    // 原版：事件分發最前面呼叫 spawn_click_feedback —— 左鍵按下都給漣漪
    this.downButton = button;
    if (button === 0) this.ui.renderer.spawnClickFeedback(x, y);

    // 按在滑塊上時禁止平移地圖（對照原版）；按在縫隙/空白才能拖動平移。
    // 但原版 events.py 記拖拽起點的條件是「單次 or 兩次觸控」——兩者都關時
    // 按在滑塊上也只是平移（全關就該只剩平移/縮放），否則會留下起點卻不給滑。
    const onBlock = this.ui.renderer.getBlockAtPos(x, y, this.ui.store) !== null;
    const draggable = this.singleTouchEnabled || this.twoTouchEnabled;
    this.drag = {
      active: true,
      startX: x,
      startY: y,
      camX: this.ui.renderer.cameraX,
      camY: this.ui.renderer.cameraY,
      moved: false,
      ax: 0,
      ay: 0,
      pan: !onBlock || !draggable,
      touch,
    };
  }

  private onPointerMove(x: number, y: number): void {
    if (!this.drag.active) return;
    const dx = x - this.drag.startX;
    const dy = y - this.drag.startY;
    // 判定「這是拖不是點」的位移量：手指抖動比滑鼠大，門檻也跟著放寬
    const slop = this.drag.touch ? 10 : 4;
    if (Math.abs(dx) + Math.abs(dy) > slop) this.drag.moved = true;
    this.drag.ax = dx;
    this.drag.ay = dy;
    // 拖拽期間即時平移鏡頭（不等到 mouseup）；只有「空白/縫隙按下」才允許平移
    if (this.drag.pan) {
      const r = this.ui.renderer;
      r.cameraX = this.drag.camX + dx;
      r.cameraY = this.drag.camY + dy;
      this.ui.requestPaint?.();
    }
  }

  private onPointerUp(): void {
    const downButton = this.downButton;
    this.downButton = 0;
    if (!this.drag.active) return;
    const { store } = this.ui;
    const r = this.ui.renderer;
    const moved = this.drag.moved;
    const dx = this.drag.ax;
    const dy = this.drag.ay;
    const [x, y] = [this.drag.startX, this.drag.startY];

    this.drag.active = false;

    // 非左鍵鬆開：平移已在 move 期間跟手生效，這裡不再觸發點擊/滑動
    if (downButton !== 0) return;

    if (!moved) {
      // 視為點擊
      this.handleClick(x, y);
      return;
    }

    // 拖動：若已選中縫隙，且起點在滑塊上，超過閾值 → 直接選中組並滑動（不必先點方塊）
    const threshold = this.drag.touch ? DRAG_MOVE_THRESHOLD_TOUCH : DRAG_MOVE_THRESHOLD;
    const overThreshold = Math.abs(dx) > threshold || Math.abs(dy) > threshold;
    const startBlock = r.getBlockAtPos(x, y, store);
    const direction: Direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'd' : 'a')
      : (dy > 0 ? 's' : 'w');

    if (startBlock && overThreshold) {
      if (this.twoTouchEnabled && store.cmd.selectedGap) {
        if (!store.cmd.selectedBlock) {
          const reply = selectBlock(store.cmd, startBlock.row, startBlock.col);
          if (!reply.ok) return;
        }
        this.animateMove(direction);
      } else if (this.singleTouchEnabled && !store.cmd.selectedGap) {
        // 無縫隙時：依拖拽角度直接判定縫隙/方向（8 區）；單次觸控完成後清空選中
        const gesture = directGestureFromDrag(startBlock.row, startBlock.col, dx, dy);
        if (gesture) {
          // 手勢算出的縫隙必須過 selectGap 校驗：起點方塊在整盤外沿時，8 區映射會算出
          // 「邊界縫」（所有方塊都在縫的同一側），直接賦值會讓整盤被一起拖走——那是
          // 零進度的無意義操作（判勝只看形狀，不看絕對坐標）。原版 is_valid_*_line
          // 同樣不把邊界縫算作合法縫，這裡只是把該有的校驗補回手勢路徑。
          const gapReply = selectGap(store.cmd, gesture.gap.type, gesture.gap.line);
          if (!gapReply.ok) {
            this.notify('这个方向没有可推的缝隙（別拖整盘外沿）');
            return;
          }
          const reply = selectBlock(store.cmd, startBlock.row, startBlock.col);
          if (reply.ok) this.animateMove(gesture.direction, true);
        }
      }
    } else if (this.drag.pan) {
      // 平移鏡頭（已在 move 期間跟手，這裡確保最終位置一致）
      r.cameraX = this.drag.camX + dx;
      r.cameraY = this.drag.camY + dy;
      this.ui.requestPaint?.();
    }
  }

  private handleClick(x: number, y: number): void {
    const { store, renderer } = this.ui;

    // 復原懸浮窗命中優先於一切（對照原版事件層先問 _solved_popup_rect）：
    // 點彈窗 = 關閉，不穿透到棋盤
    if (renderer.hitSolvedPopup(x, y)) {
      renderer.closeSolvedPopup();
      return;
    }

    // 箭頭按鍵命中優先於選縫隙（原版 events 裡先問它，否則會被「點空白起拖」吃掉）。
    // 它是五種操作方式之一，有自己的開關：關掉時按鍵不畫、也不該還能點中。
    if (renderer.arrowEnabled) {
      const arrowDir = renderer.hitArrowButton(x, y);
      if (arrowDir) {
        this.animateMove(arrowDir);
        return;
      }
    }

    const gap = renderer.getGapAtPos(x, y, store);
    const block = renderer.getBlockAtPos(x, y, store);

    // 原版 events.py：selectable = 兩次觸控 or 鼠標鍵盤。兩者都關時只能平移/縮放，
    // 點縫隙/滑塊不該有反應——但要說一句，不能默默無反應
    if ((gap !== null || block !== null) && !this.selectable) {
      this.notify('兩次触控与鼠标键盘都关闭：只能平移/缩放（到「设置 → 控制模式」开回来）');
      return;
    }

    if (gap !== null) {
      // 再點同一縫隙 = 取消
      const cur = store.cmd.selectedGap;
      if (cur && cur.type === gap.type && cur.line === gap.line) {
        store.cmd.selectedGap = null;
        store.cmd.selectedBlock = null;
        store.game.selected.clear();
        renderer.lastBlockClickWorld = null;
        this.notify('已取消缝隙');
      } else {
        const reply = selectGap(store.cmd, gap.type, gap.line);
        renderer.lastBlockClickWorld = null;
        this.notify(reply.ok ? `选中${gap.type === 'v' ? '纵' : '横'}向缝隙` : reply.message);
      }
    } else if (block !== null && store.cmd.selectedGap !== null) {
      const reply = selectBlock(store.cmd, block.row, block.col);
      if (reply.ok) renderer.lastBlockClickWorld = renderer.screenToWorld(x, y);
      this.notify(reply.ok ? `选中滑块组 共${store.game.selected.size}个` : reply.message);
    } else if (renderer.isBlankArea(x, y, store)) {
      this.deselect();
      renderer.lastBlockClickWorld = null;
      this.notify('已取消选中');
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    // 復原懸浮窗的按鍵優先於控制模式開關（UI 層按鍵，任何模式都能用）：
    // Enter = 保存（對照原版提示「按 Enter 保存」），Esc = 關閉。
    if (this.ui.renderer.solvedPopupActive) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.ui.renderer.closeSolvedPopup();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this.ui.onPopupSave?.();
        this.ui.renderer.closeSolvedPopup();
        return;
      }
    }
    if (!this.keyboardMouseEnabled) return;
    if (e.ctrlKey || e.metaKey) return; // 保留給 undo/redo 快捷鍵（M3）
    const dir = DIRECTION_KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    this.animateMove(dir);
  }

  /** 對外：虛擬鍵盤/程式化移動入口。 */
  move(direction: Direction): void {
    this.animateMove(direction);
  }

  /** 帶動畫的移動：預測 → 動畫插值 → 提交。 */
  private animateMove(direction: Direction, clearAfter = false): void {
    const { store, renderer } = this.ui;
    const cmd = store.cmd;
    const blocked = this.ui.beforeMove?.();
    if (blocked) {
      this.clearSelectionAfterMove = false;
      this.notify(blocked);
      return;
    }
    this.clearSelectionAfterMove = clearAfter;

    // 禁止整體滑動（攔截層）：合法縫隙兩側必有方塊，選中組不可能等於全體；相等只可能是
    // 繞過校驗的邊界縫。整盤剛體平移不改變形狀，而判勝只看形狀——零進度操作，直接拒絕。
    // 引擎層（SliderMatrix.try_move）有同樣的護欄，這裡負責給出人話提示。
    if (store.game.selected.size > 0 && store.game.selected.size === store.game.blocks.length) {
      this.clearSelectionAfterMove = false;
      this.flashInvalid();
      this.notify('整盘平移没有意义：过关只看形状，不看绝对位置');
      return;
    }

    if (!cmd.selectedGap) {
      this.clearSelectionAfterMove = false;
      this.notify('请先选中缝隙');
      return;
    }
    if (!cmd.selectedBlock) {
      this.clearSelectionAfterMove = false;
      this.notify('请先选中滑块');
      return;
    }
    if (!isValidDirectionForGap(cmd.selectedGap.type, direction)) {
      this.clearSelectionAfterMove = false;
      this.flashInvalid();
      this.notify(`移动方向非法（${cmd.selectedGap.type === 'h' ? 'h→a/d' : 'v→w/s'}）`);
      return;
    }

    const finalPositions = store.game.try_move(direction, store.currentStep);
    if (!finalPositions) {
      this.clearSelectionAfterMove = false;
      this.flashInvalid();
      this.notify('移动不合法（碰撞或断连）');
      return;
    }

    // 建立全量 block 的起點/終點（選中組終點用 finalPositions，其餘原地）
    const selectedList = store.game.blocks.filter((b) => store.game.selected.has(b));
    const movedPositions = selectedList.map((b) => [b.row, b.col] as [number, number]);
    const endBySelected = new Map(selectedList.map((b, i) => [b, finalPositions[i]] as const));
    const start = store.game.blocks.map((b) => [b.row, b.col] as [number, number]);
    const end = store.game.blocks.map((b) => {
      const e = endBySelected.get(b);
      return e ? ([e[0], e[1]] as [number, number]) : ([b.row, b.col] as [number, number]);
    });

    if (!this.animationEnabled) {
      // 關閉動畫：瞬間提交；保留選中以便連續滑動
      store.game.commit_move(finalPositions);
      cmd.stepCount += 1;
      cmd.history.save_snapshot(store.game, {
        direction,
        step: store.currentStep,
        gap_type: cmd.selectedGap?.type,
        gap_line: cmd.selectedGap?.line,
        moved_positions: movedPositions,
      });
      this.notify(`移动 ${direction}`);
      this.ui.onChanged?.();
      this.ui.requestPaint?.();
      return;
    }

    renderer.animation = { start, end, progress: 0, durationMs: this.moveDurationMs };
    const t0 = performance.now();

    const frame = (now: number): void => {
      const anim = renderer.animation;
      if (!anim) return;
      const p = Math.min(1, (now - t0) / anim.durationMs);
      anim.progress = p;
      this.ui.requestPaint?.();
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        renderer.animation = null;
        // 提交（對照 CommandBus.move 的 commit 尾巴；保留選中以便連續滑動）
        store.game.commit_move(finalPositions);
        cmd.stepCount += 1;
        cmd.history.save_snapshot(store.game, {
          direction,
          step: store.currentStep,
          gap_type: cmd.selectedGap?.type,
          gap_line: cmd.selectedGap?.line,
          moved_positions: movedPositions,
        });
        this.notify(`移动 ${direction}`);
        this.ui.onChanged?.();
        if (this.clearSelectionAfterMove) {
          store.game.selected.clear();
          cmd.selectedGap = null;
          cmd.selectedBlock = null;
        }
        this.clearSelectionAfterMove = false;
        this.ui.requestPaint?.();
      }
    };
    requestAnimationFrame(frame);
  }

  private deselect(): void {
    const { store } = this.ui;
    store.cmd.selectedGap = null;
    store.cmd.selectedBlock = null;
    store.game.selected.clear();
    this.ui.requestPaint?.();
  }
}
