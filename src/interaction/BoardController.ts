/**
 * 棋盤互動控制器（M2）
 * 對照 gui/events.py 的三連互動與 gui/renderer.py 的命中測試。
 *
 * - 點縫隙 → selectGap（再點同縫隙 = 取消）
 * - 點方塊（已選縫隙）→ selectBlock（DFS 選中組）
 * - 鍵盤/方向鍵/拖動 → move（先 try_move 再 commit；非法則閃紅提示）
 * - 空白拖拽 → 平移鏡頭（camera）
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
}

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
const DRAG_MOVE_THRESHOLD = 18;

export class BoardController {
  private ui: BoardControllerUI;
  private drag: DragState;
  /** 右側面板「滑動動畫」開關；關閉時移動瞬間完成 */
  animationEnabled = true;
  /** 右側面板「速度」滑條控制的移動動畫時長（ms） */
  moveDurationMs = 180;
  private pinchDist = 0;
  private pinchZoom = 1;
  private pinchActive = false;

  constructor(ui: BoardControllerUI) {
    this.ui = ui;
    this.drag = { active: false, startX: 0, startY: 0, camX: 0, camY: 0, moved: false, ax: 0, ay: 0, pan: true };
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

    c.addEventListener('mousedown', (e) => this.onPointerDown(e.offsetX, e.offsetY));
    c.addEventListener('mousemove', (e) => this.onPointerMove(e.offsetX, e.offsetY));
    window.addEventListener('mouseup', () => this.onPointerUp());

    // 觸控
    const dist = (a: Touch, b: Touch): number =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

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
      this.onPointerDown(t.clientX - rect.left, t.clientY - rect.top);
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
      this.notify('已取消選中');
    });
  }

  private onPointerDown(x: number, y: number): void {
    // 按在滑塊上時禁止平移地圖（對照原版）；按在縫隙/空白才能拖動平移
    const onBlock = this.ui.renderer.getBlockAtPos(x, y, this.ui.store) !== null;
    this.drag = {
      active: true,
      startX: x,
      startY: y,
      camX: this.ui.renderer.cameraX,
      camY: this.ui.renderer.cameraY,
      moved: false,
      ax: 0,
      ay: 0,
      pan: !onBlock,
    };
  }

  private onPointerMove(x: number, y: number): void {
    if (!this.drag.active) return;
    const dx = x - this.drag.startX;
    const dy = y - this.drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
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
    if (!this.drag.active) return;
    const { store } = this.ui;
    const r = this.ui.renderer;
    const moved = this.drag.moved;
    const dx = this.drag.ax;
    const dy = this.drag.ay;
    const [x, y] = [this.drag.startX, this.drag.startY];

    this.drag.active = false;

    if (!moved) {
      // 視為點擊
      this.handleClick(x, y);
      return;
    }

    // 拖動：若已選中縫隙，且起點在滑塊上，超過閾值 → 直接選中組並滑動（不必先點方塊）
    const overThreshold = Math.abs(dx) > DRAG_MOVE_THRESHOLD || Math.abs(dy) > DRAG_MOVE_THRESHOLD;
    const startBlock = r.getBlockAtPos(x, y, store);
    const direction: Direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'd' : 'a')
      : (dy > 0 ? 's' : 'w');

    if (store.cmd.selectedGap && startBlock && overThreshold) {
      if (!store.cmd.selectedBlock) {
        const reply = selectBlock(store.cmd, startBlock.row, startBlock.col);
        if (!reply.ok) return;
      }
      this.animateMove(direction);
    } else if (this.drag.pan) {
      // 平移鏡頭（已在 move 期間跟手，這裡確保最終位置一致）
      r.cameraX = this.drag.camX + dx;
      r.cameraY = this.drag.camY + dy;
      this.ui.requestPaint?.();
    }
  }

  private handleClick(x: number, y: number): void {
    const { store, renderer } = this.ui;
    const gap = renderer.getGapAtPos(x, y, store);
    const block = renderer.getBlockAtPos(x, y, store);

    if (gap !== null) {
      // 再點同一縫隙 = 取消
      const cur = store.cmd.selectedGap;
      if (cur && cur.type === gap.type && cur.line === gap.line) {
        store.cmd.selectedGap = null;
        store.cmd.selectedBlock = null;
        store.game.selected.clear();
        this.notify('已取消縫隙');
      } else {
        const reply = selectGap(store.cmd, gap.type, gap.line);
        this.notify(reply.ok ? `選中${gap.type === 'v' ? '縱' : '橫'}向縫隙` : reply.message);
      }
    } else if (block !== null && store.cmd.selectedGap !== null) {
      const reply = selectBlock(store.cmd, block.row, block.col);
      this.notify(reply.ok ? `選中滑塊組 共${store.game.selected.size}個` : reply.message);
    } else if (renderer.isBlankArea(x, y, store)) {
      this.deselect();
      this.notify('已取消選中');
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
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
  private animateMove(direction: Direction): void {
    const { store, renderer } = this.ui;
    const cmd = store.cmd;

    if (!cmd.selectedGap) {
      this.notify('請先選中縫隙');
      return;
    }
    if (!cmd.selectedBlock) {
      this.notify('請先選中滑塊');
      return;
    }
    if (!isValidDirectionForGap(cmd.selectedGap.type, direction)) {
      this.flashInvalid();
      this.notify(`移動方向非法（${cmd.selectedGap.type === 'h' ? 'h→a/d' : 'v→w/s'}）`);
      return;
    }

    const finalPositions = store.game.try_move(direction, store.currentStep);
    if (!finalPositions) {
      this.flashInvalid();
      this.notify('移動不合法（碰撞或斷連）');
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
      this.notify(`移動 ${direction}`);
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
        this.notify(`移動 ${direction}`);
        this.ui.onChanged?.();
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
