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
import type { Block } from '../core/Block.js';
import { selectBlock, selectGap } from '../core/CommandBus.js';
import { isValidDirectionForGap, type Direction } from '../core/rules.js';
import { probeMaxCells, followFrame, quantizeCells, continuationRatio } from '../feature/dragFollow.js';

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
  /** 按下處的滑塊（拖拽跟隨的起點；對照原版 st['block']，按下時記住） */
  block: Block | null;
}

/** 拖拽跟隨狀態（缺陷 18）。對照原版 drag_follow_* 一族欄位。 */
interface FollowState {
  /** 鎖定的移動方向（進入時定，之後不再變） */
  direction: Direction;
  /** 鎖定的縫隙（h/v + line） */
  gap: { type: 'h' | 'v'; line: number };
  /** 沿 direction 可推進的最大格數（進入時探一次，期間棋盤不變） */
  maxCells: number;
  /** 按下時的屏幕位置：偏移從這裡算起（對照原版 drag_follow_start_screen） */
  startScreen: [number, number];
  /** 單次觸控發起（無預選縫隙）→ 結束自動取消選中（原版 drag_follow_auto_deselect） */
  autoDeselect: boolean;
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
  /** 拖拽跟隨狀態（缺陷 18）；null = 不在跟隨中 */
  private follow: FollowState | null = null;
  /** 觸點越過可達上限（容差 0.05 格）：光標變禁止圖標、鬆手撞牆回彈 */
  private followInvalid = false;
  /** 上一次跟隨進入失敗的提示（同一條不重複彈，避免拖動中瘋狂刷 toast） */
  private lastFollowFail = '';

  constructor(ui: BoardControllerUI) {
    this.ui = ui;
    this.drag = { active: false, startX: 0, startY: 0, camX: 0, camY: 0, moved: false, ax: 0, ay: 0, pan: true, touch: false, block: null };
    this.attach();
  }

  /** 播放一段過場動畫（undo/redo 用）：從 from 到 to 平滑過渡後停在 to。 */
  playTransition(from: [number, number][], to: [number, number][], durationMs = this.moveDurationMs): void {
    // 過場動畫與拖拽跟隨互斥（對照原版 anim_map 優先於 follow_map）
    this.clearFollow();
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
        // 第二根手指 = 縮放：放棄當前的拖拽與跟隨。否則跟隨偏移會凍結在舊值一直
        // 顯示，且這期間不會再收到 touchmove 更新（缺陷 18）
        this.drag.active = false;
        this.clearFollow();
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
        if (e.touches.length < 2) {
          // 縮放結束：剩下的那根手指不接續舊拖拽（起手時已被放棄），重新按過才有效
          this.pinchActive = false;
          this.drag.active = false;
          this.clearFollow();
        }
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
    const startBlock = this.ui.renderer.getBlockAtPos(x, y, this.ui.store);
    const onBlock = startBlock !== null;
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
      block: startBlock,
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

    // 拖拽跟隨中（缺陷 18）：每帧更新偏移。**不受閾值限制**——拖回起點附近時位移
    // 會小於閾值，若受門控偏移會凍結在舊值，鬆手後仍按舊偏移移動（對照原版註解）
    if (this.follow) {
      this.updateFollow(x, y);
      return;
    }

    // 拖拽期間即時平移鏡頭（不等到 mouseup）；只有「空白/縫隙按下」才允許平移
    if (this.drag.pan) {
      const r = this.ui.renderer;
      r.cameraX = this.drag.camX + dx;
      r.cameraY = this.drag.camY + dy;
      this.ui.requestPaint?.();
      return;
    }

    // 超過拖動門檻、且按在滑塊上：嘗試進入跟隨（一邊拖一邊動的實時預覽）。
    // 與松手時的手勢判定共用同一套閾值——兩條路只會走一條。
    const threshold = this.drag.touch ? DRAG_MOVE_THRESHOLD_TOUCH : DRAG_MOVE_THRESHOLD;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      // 進入成功後立刻按「這一次」的位移算偏移：原版在同一事件裡先 _init_drag_follow
      // 再走每帧更新，漏掉這步會表現為「第一拖沒有跟手，要再動一下才動」
      if (this.tryEnterFollow(dx, dy)) this.updateFollow(x, y);
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

    // 非左鍵鬆開：平移已在 move 期間跟手生效，這裡不再觸發點擊/滑動；跟隨也一併取消
    if (downButton !== 0) { this.clearFollow(); return; }

    // 拖拽跟隨中（缺陷 18）：松手提交（含量化 + 拖拽接續），不再走下面的手勢路徑
    if (this.follow) { this.commitFollow(); return; }

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

  // ---------- 拖拽跟隨（缺陷 18：一邊拖一邊動 + 越界判定） ----------
  // 對照原版 gui/drag.py 的 DragMixin + gui/events.py 的 MOUSEMOTION 分發。

  /**
   * 嘗試進入拖拽跟隨。對照原版 drag.py::_init_drag_follow：
   * 定縫（單次觸控 8 區 / 兩次觸控沿已選縫主軸）→ 縫須在棋形內部（邊界縫拒絕）
   * → 選中連通組 → 探可達上限。回傳 true 表示已進入跟隨。
   *
   * 與松手路徑的關係：進入失敗就退回舊路徑（松手時的手勢判定），
   * 對照原版「跟隨初始化失敗：回退到舊路徑」。
   */
  private tryEnterFollow(dx: number, dy: number): boolean {
    const block = this.drag.block;
    if (!block) return false;
    const { store, renderer } = this.ui;
    // 動畫播放中不進入（對照原版 animating 拒絕）：按住左鍵時另一只手按了方向鍵
    if (renderer.animation) return false;

    const gap = store.cmd.selectedGap;
    let gapType: 'h' | 'v';
    let line: number;
    let direction: Direction;
    if (gap) {
      // 兩次觸控：沿已有縫隙的主方向軸
      if (!this.twoTouchEnabled) return false;
      gapType = gap.type;
      line = gap.line;
      direction = gap.type === 'h' ? (dx > 0 ? 'd' : 'a') : (dy > 0 ? 's' : 'w');
      if (!store.cmd.selectedBlock) {
        const reply = selectBlock(store.cmd, block.row, block.col);
        if (!reply.ok) return false;
      }
    } else {
      // 單次觸控：8 區角度直接判定
      if (!this.singleTouchEnabled) return false;
      const gesture = directGestureFromDrag(block.row, block.col, dx, dy);
      if (!gesture) return false;
      // 手勢算出的縫隙必須過 selectGap 校驗：起點方塊在整盤外沿時 8 區映射會算出
      // 「邊界縫」（所有方塊都在縫的同一側），整盤剛體平移是零進度操作——與第 1 項
      // 「禁止整體滑動」同源，這裡在跟隨入口再攔一次。
      const gapReply = selectGap(store.cmd, gesture.gap.type, gesture.gap.line);
      if (!gapReply.ok) {
        if (this.lastFollowFail !== gapReply.message) {
          this.lastFollowFail = gapReply.message;
          this.notify('这个方向没有可推的缝隙（別拖整盘外沿）');
        }
        return false;
      }
      const reply = selectBlock(store.cmd, block.row, block.col);
      if (!reply.ok) return false;
      gapType = gesture.gap.type;
      line = gesture.gap.line;
      direction = gesture.direction;
    }

    const maxCells = probeMaxCells(store.game, direction, store.currentStep);
    this.follow = {
      direction,
      gap: { type: gapType, line },
      maxCells,
      startScreen: [this.drag.startX, this.drag.startY],
      autoDeselect: gap === null,
    };
    this.followInvalid = false;
    this.lastFollowFail = '';
    renderer.dragFollow = { dr: 0, dc: 0 };
    this.ui.requestPaint?.();
    return true;
  }

  /** 跟隨中：把指針位移投影到鎖定方向，夾到 [0, maxCells]（對照 events.py 每帧更新）。 */
  private updateFollow(x: number, y: number): void {
    const f = this.follow;
    if (!f) return;
    const { renderer } = this.ui;
    // 每格像素數用「格+間隙」的間距（renderer.stepPx）而不是 scaledCell：少了間隙會把
    // 位移低估約一成，拖一格間距的距離卻讀出 >1 格（對照原版 cell_size + gap_width）
    const frame = followFrame(
      f.direction,
      x - f.startScreen[0],
      y - f.startScreen[1],
      renderer.stepPx,
      f.maxCells,
    );
    renderer.dragFollow = { dr: frame.dr, dc: frame.dc };
    if (frame.invalid !== this.followInvalid) {
      this.followInvalid = frame.invalid;
      // 越過可達上限：光標變禁止圖標（對照原版 SYSTEM_CURSOR_NO）
      this.canvas.style.cursor = frame.invalid ? 'not-allowed' : '';
    }
    this.ui.requestPaint?.();
  }

  /** 離開跟隨：清偏移與光標。選中狀態不動，由呼叫方決定去留。 */
  private clearFollow(): void {
    this.follow = null;
    this.followInvalid = false;
    if (this.ui.renderer.dragFollow) {
      this.ui.renderer.dragFollow = null;
      this.canvas.style.cursor = '';
      this.ui.requestPaint?.();
    }
  }

  /**
   * 松手提交。對照原版 drag.py::_commit_drag_move：
   * 偏移量化到 step 整數倍，從大步長遞減找第一個可接受的（兜底）；
   * 拖拽接續——動畫起點接到松手那刻的跟隨位置，否則整組會跳回原位再滑一次。
   */
  private commitFollow(): void {
    const f = this.follow;
    if (!f) return;
    const { store, renderer } = this.ui;
    const dr = renderer.dragFollow?.dr ?? 0;
    const dc = renderer.dragFollow?.dc ?? 0;
    const invalid = this.followInvalid;
    const autoDeselect = f.autoDeselect;
    this.clearFollow();

    // 跟隨期間若已經有一步在播（按住左鍵時另一只手按了方向鍵）：只收尾，不移動
    if (renderer.animation) {
      if (autoDeselect) this.deselect();
      return;
    }

    const step = Math.max(1, store.currentStep);
    // 取 max 而非 abs 之和：方形四向必然只有一個分量非零（兩者等價）
    const cells = Math.max(0, Math.abs(dr), Math.abs(dc));
    let n = quantizeCells(cells, step);
    // 循環遞減兜底：從最大合法步長開始，逐次減少 step，找到第一個可接受的值
    while (n > 0 && !store.game.try_move(f.direction, n)) n -= step;

    if (n > 0) {
      this.animateMove(f.direction, autoDeselect, n, [dr, dc]);
      return;
    }
    // 沒走成：越界松手 → 撞牆回彈 + 明說上限（玩家要的就是「最多能推多遠」的反饋）
    if (invalid) {
      this.flashInvalid();
      this.notify(f.maxCells > 0 ? `这个方向最多能推 ${f.maxCells} 格` : '这个方向已经推不动了');
      renderer.spawnFollowShake(store.game.selected, dr, dc);
    }
    if (autoDeselect) this.deselect();
  }

  /**
   * 對外：打斷跟隨（撤销/重做/打乱/重置等換了整局或整步的操作前呼叫）。
   * 不清選中——那些操作自己會重建局面；只撤掉實時預覽偏移，避免動畫與偏移疊加、
   * 以及松手時按陳舊偏移誤提交。
   */
  cancelFollow(): void {
    this.clearFollow();
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
    // 鍵盤移動會打斷跟隨：先撤掉實時預覽，否則動畫與跟隨偏移疊加（缺陷 18）
    this.clearFollow();
    this.animateMove(dir);
  }

  /** 對外：虛擬鍵盤/程式化移動入口。 */
  move(direction: Direction): void {
    this.clearFollow();
    this.animateMove(direction);
  }

  /**
   * 帶動畫的移動：預測 → 動畫插值 → 提交。
   * @param cells 推進格數（拖拽跟隨可一次提交多格；鍵盤/箭頭恆為 currentStep）
   * @param origin 拖拽接續的松手偏移（行,列，小數格）：動畫起點接到松手那刻的跟隨
   *   位置，否則整組會先跳回原位再完整滑一遍（對照原版 _apply_drag_origin）
   */
  private animateMove(
    direction: Direction,
    clearAfter = false,
    cells = this.ui.store.currentStep,
    origin: [number, number] | null = null,
  ): void {
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

    const finalPositions = store.game.try_move(direction, cells);
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
    // 快照記「實際推進格數」而非謎題 step：撤銷/重做動畫按 post = pre + delta*step
    // 重建位置（buildHistoryAnim），多格提交若記 step 會整步錯位
    const moveStep = cells;

    // 拖拽接續（缺陷 18，對照原版 animation.py::_apply_drag_origin）：起點接到松手
    // 那刻的跟隨位置。跟隨是實時預覽——松手時整組已經被畫到近乎落點；若仍從原點播
    // 起，松手瞬間整組會先跳回原位、再完整滑一遍。時長按剩餘比例縮短，保證速度不變
    // （不會變成最後一點點慢慢挪）。s 夾緊：跟過頭時起點停在落點，退化為一幀落位。
    let durationMs = this.moveDurationMs;
    if (origin) {
      const refIdx = start.findIndex((_, i) => store.game.selected.has(store.game.blocks[i]));
      if (refIdx >= 0) {
        const tr = end[refIdx][0] - start[refIdx][0];
        const tc = end[refIdx][1] - start[refIdx][1];
        const s = continuationRatio(origin[0], origin[1], tr, tc);
        if (s > 0) {
          for (let i = 0; i < start.length; i++) {
            if (!store.game.selected.has(store.game.blocks[i])) continue;
            start[i][0] += s * tr;
            start[i][1] += s * tc;
          }
          durationMs = Math.max(60, Math.round(this.moveDurationMs * (1 - s)));
        }
      }
    }

    if (!this.animationEnabled) {
      // 關閉動畫：瞬間提交；保留選中以便連續滑動
      store.game.commit_move(finalPositions);
      cmd.stepCount += 1;
      cmd.history.save_snapshot(store.game, {
        direction,
        step: moveStep,
        gap_type: cmd.selectedGap?.type,
        gap_line: cmd.selectedGap?.line,
        moved_positions: movedPositions,
      });
      this.notify(`移动 ${direction}`);
      this.ui.onChanged?.();
      this.ui.requestPaint?.();
      return;
    }

    renderer.animation = { start, end, progress: 0, durationMs };
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
          step: moveStep,
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
    // 右鍵/點空白取消選中：跟隨預覽一併撤（選中組沒了，偏移畫在空氣上）
    this.clearFollow();
    store.cmd.selectedGap = null;
    store.cmd.selectedBlock = null;
    store.game.selected.clear();
    this.ui.requestPaint?.();
  }
}
