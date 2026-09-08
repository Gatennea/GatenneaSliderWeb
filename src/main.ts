/**
 * 體驗版入口（M2：三連互動）
 * 深色外框 + 選單/狀態欄，Canvas 棋盤，鍵盤/滑鼠/觸控操作。
 */

import { BoardRenderer } from './render/BoardRenderer.js';
import { BoardController } from './interaction/BoardController.js';
import { GameStore } from './store/GameStore.js';
import { COLORS, GEOMETRY } from './render/theme.js';
import { shuffle, reset, undo, redo } from './core/CommandBus.js';

const app = document.querySelector<HTMLDivElement>('#app')!;

// 外框（對照原版深色背景 + 選單/狀態欄配色）
app.style.background = COLORS.background;
app.style.minHeight = '100vh';
app.style.display = 'flex';
app.style.flexDirection = 'column';
app.style.fontFamily = 'system-ui, sans-serif';

const menu = document.createElement('div');
menu.style.height = `${GEOMETRY.menu_bar_height}px`;
menu.style.background = COLORS.menu_bg;
menu.style.borderBottom = `1px solid ${COLORS.border}`;
menu.style.display = 'flex';
menu.style.alignItems = 'center';
menu.style.paddingLeft = '10px';
menu.style.color = COLORS.menu_text;
menu.textContent = '文件   編輯   謎題   宏   設置';
app.appendChild(menu);

const canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 500;
canvas.style.width = '800px';
canvas.style.height = '500px';
// 防止 flex 容器因高度不足把 canvas 壓縮，導致 CSS 尺寸 != 位圖尺寸
//（那正是「拖動地圖比滑鼠快 / 選中看不準」的根源）
canvas.style.flex = '0 0 auto';
canvas.style.display = 'block';
canvas.style.margin = '16px';
canvas.style.touchAction = 'none';
app.appendChild(canvas);

// 快捷按鈕列（體驗版：打亂 / 重置 / 撤銷 / 重做；完整選單日後做）
const toolbar = document.createElement('div');
toolbar.style.display = 'flex';
toolbar.style.gap = '8px';
toolbar.style.padding = '0 16px 8px';
app.appendChild(toolbar);

const status = document.createElement('div');
status.style.height = `${GEOMETRY.status_bar_height}px`;
status.style.background = COLORS.status_bg;
status.style.borderTop = `1px solid ${COLORS.border}`;
status.style.color = COLORS.status_text;
status.style.display = 'flex';
status.style.alignItems = 'center';
status.style.gap = '30px';
status.style.paddingLeft = '10px';
app.appendChild(status);

// 浮動提示（選中縫隙/選中組/非法移動等，對照 macro_notify_msg）
const toast = document.createElement('div');
toast.style.position = 'fixed';
toast.style.right = '16px';
toast.style.bottom = `${GEOMETRY.status_bar_height + 12}px`;
toast.style.color = COLORS.timer_running;
toast.style.fontSize = '13px';
toast.style.pointerEvents = 'none';
app.appendChild(toast);
let toastTimer = 0;
function showToast(text: string): void {
  toast.textContent = text;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.textContent = ''), 1400);
}

const store = new GameStore(4, 4, 2);
const ctx = canvas.getContext('2d')!;
const renderer = new BoardRenderer(ctx, 1);

// 置中（對照原版 center_map）
function centerCamera(): void {
  const b = store.game.get_boundaries();
  const left = b.min_col * renderer.step; // 世界
  const right = b.max_col * renderer.step + renderer.cell;
  const top = b.min_row * renderer.step;
  const bottom = b.max_row * renderer.step + renderer.cell;
  const w = (right - left) * renderer.zoom;
  const h = (bottom - top) * renderer.zoom;
  renderer.cameraX = (canvas.width - w) / 2 - left * renderer.zoom;
  renderer.cameraY = (canvas.height - h) / 2 - top * renderer.zoom;
}
centerCamera();

// 狀態欄用緩存字串，避免每幀重建 DOM（掉幀主因）
const statusSolved = document.createElement('span');
const statusSteps = document.createElement('span');
const statusPuzzle = document.createElement('span');
status.append(statusSolved, statusSteps, statusPuzzle);
let lastStatusKey = '';

function updateStatus(): void {
  const solved = store.solved;
  const key = `${solved}|${store.cmd.stepCount}|${store.currentStep}~${store.currentM}*${store.currentN}`;
  if (key === lastStatusKey) return;
  lastStatusKey = key;
  statusSolved.textContent = solved ? '狀態：復原' : '狀態：未復原';
  statusSolved.style.color = solved ? COLORS.solved : COLORS.unsolved;
  statusSteps.textContent = `步數：${store.cmd.stepCount}`;
  statusPuzzle.textContent = `謎題：${store.currentStep}~${store.currentM}*${store.currentN}`;
}

// on-demand 重繪（dirty flag）：互動/動畫時才重繪，避免無意義滿載 60fps
let needsPaint = true;
let rafQueued = false;
function schedulePaint(): void {
  needsPaint = true;
  if (rafQueued) return;
  rafQueued = true;
  requestAnimationFrame(() => {
    rafQueued = false;
    if (needsPaint) {
      needsPaint = false;
      renderer.draw(store);
      updateStatus();
    }
  });
}

const controller = new BoardController({
  canvas,
  renderer,
  store,
  onStatus: showToast,
  requestPaint: schedulePaint,
});

function addButton(label: string, onClick: () => void): void {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.background = COLORS.button_bg;
  b.style.color = '#fff';
  b.style.border = 'none';
  b.style.borderRadius = '4px';
  b.style.padding = '6px 12px';
  b.style.cursor = 'pointer';
  b.addEventListener('click', onClick);
  toolbar.appendChild(b);
}

addButton('打亂', () => {
  const reply = shuffle(store.cmd, 100);
  showToast(reply.message);
  renderer.animation = null;
  centerCamera();
  schedulePaint();
});
addButton('重置', () => {
  const reply = reset(store.cmd);
  showToast(reply.message);
  renderer.animation = null;
  centerCamera();
  schedulePaint();
});
addButton('撤銷', () => {
  const reply = undo(store.cmd);
  showToast(reply.message);
  schedulePaint();
});
addButton('重做', () => {
  const reply = redo(store.cmd);
  showToast(reply.message);
  schedulePaint();
});

// 快捷鍵：Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    const reply = e.shiftKey ? redo(store.cmd) : undo(store.cmd);
    showToast(reply.message);
    schedulePaint();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    const reply = redo(store.cmd);
    showToast(reply.message);
    schedulePaint();
  }
});

schedulePaint();

// 簡單 console 自檢（供驗收）
console.log('[web] 初始 solved =', store.solved);
console.log('[web] 互動：點縫隙 → 點方塊 → W/S/A/D 或拖動');
