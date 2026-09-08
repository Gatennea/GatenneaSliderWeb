/**
 * 體驗版入口（M2：三連互動）
 * 深色外框 + 選單/狀態欄，Canvas 棋盤，鍵盤/滑鼠/觸控操作。
 */

import { BoardRenderer } from './render/BoardRenderer.js';
import { BoardController } from './interaction/BoardController.js';
import { GameStore } from './store/GameStore.js';
import { COLORS, GEOMETRY } from './render/theme.js';
import { shuffle, reset, undo, redo } from './core/CommandBus.js';
import { autosave, autoload, downloadSave, importData } from './io/SaveManager.js';
import { Timer, formatTime } from './feature/Timer.js';
import { Records, stats, puzzleKey } from './feature/Records.js';
import type { RecordItem } from './feature/Records.js';

const app = document.querySelector<HTMLDivElement>('#app')!;

// 外框（對照原版深色背景 + 選單/狀態欄配色）
app.style.background = COLORS.background;
app.style.height = '100vh';
app.style.overflow = 'hidden';
app.style.display = 'flex';
app.style.flexDirection = 'column';
app.style.fontFamily = 'system-ui, sans-serif';

// 頂部選單欄（對照原版：文件/編輯/謎題/宏定義/設置/幫助）
const menuBar = document.createElement('div');
menuBar.style.height = `${GEOMETRY.menu_bar_height}px`;
menuBar.style.background = COLORS.menu_bg;
menuBar.style.borderBottom = `1px solid ${COLORS.border}`;
menuBar.style.display = 'flex';
menuBar.style.alignItems = 'center';
menuBar.style.paddingLeft = '10px';
menuBar.style.color = COLORS.menu_text;
menuBar.id = 'menuBar';
app.appendChild(menuBar);

interface MenuDef { label: string; items: (string | '---')[]; handler: (item: string) => void; }
const menus: MenuDef[] = [
  { label: '文件', items: ['打開 Ctrl+O', '保存 Ctrl+S', '另存為...'], handler: (item) => {
      if (item === '保存 Ctrl+S' || item === '另存為...') { downloadSave(store); showToast(item === '保存 Ctrl+S' ? '已保存' : '已下載存檔'); }
      else if (item === '打開 Ctrl+O') fileInput.click();
    }
  },
  { label: '編輯', items: ['撤銷 Ctrl+Z', '重做 Ctrl+X', '打亂 Alt+S', '重置 Ctrl+R'], handler: (item) => {
      if (item.startsWith('撤銷')) { const r = undo(store.cmd); showToast(r.message); autosave(store); schedulePaint(); }
      else if (item.startsWith('重做')) { const r = redo(store.cmd); showToast(r.message); autosave(store); schedulePaint(); }
      else if (item.startsWith('打亂')) {
        const r = shuffle(store.cmd, store.currentM * store.currentN * 10);
        showToast(r.message); renderer.animation = null; centerCamera(); autosave(store); timer.reset(); schedulePaint();
      }
      else if (item.startsWith('重置')) {
        const r = reset(store.cmd); showToast(r.message); renderer.animation = null; centerCamera(); autosave(store); timer.reset(); schedulePaint();
      }
    }
  },
  { label: '謎題', items: ['2~4*4', '2~5*5', '2~6*6', '2~7*7', '2~8*8', '2~9*9', '2~10*10', '---', '自定義...', '模式:練習', '模式:競速'], handler: (item) => {
      if (item === '自定義...') {
        const m = Number(window.prompt('列數 m（例如 4）', String(store.currentM)));
        const n = Number(window.prompt('行數 n（例如 5）', String(store.currentN)));
        const step = Number(window.prompt('步距 step（需 < max(m,n)）', String(store.currentStep)));
        if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step)) { showToast('輸入需為整數'); return; }
        if (step >= Math.max(m, n)) { showToast(`step 需 < max(m,n)=${Math.max(m, n)}`); return; }
        store.newPuzzle(m, n, step); renderer.animation = null; centerCamera(); autosave(store); timer.reset(); schedulePaint();
        showToast(`切換謎題 ${step}~${m}*${n}`);
      } else if (item === '模式:練習') { gameMode = 'practice'; timer.reset(); showToast('模式：練習'); schedulePaint(); }
      else if (item === '模式:競速') { gameMode = 'timed'; timer.reset(); showToast('模式：競速'); schedulePaint(); }
      else if (item !== '---') {
        const parts = item.split('~');
        const step = Number(parts[0]);
        const dims = parts[1].split('*');
        const m = Number(dims[0]), n = Number(dims[1]);
        store.newPuzzle(m, n, step); renderer.animation = null; centerCamera(); autosave(store); timer.reset(); schedulePaint();
        showToast(`切換謎題 ${step}~${m}*${n}`);
      }
    }
  },
  { label: '宏定義', items: ['錄製', '執行', '刪除'], handler: () => showToast('體驗版不含宏定義') },
  { label: '設置', items: ['虛擬鍵盤', '成績面板'], handler: (item) => {
      if (item === '虛擬鍵盤') {
        const vis = vkPanel.style.display === 'none';
        vkPanel.style.display = vis ? '' : 'none';
        showToast(vis ? '已開啟虛擬鍵盤' : '已關閉虛擬鍵盤');
      } else if (item === '成績面板') {
        const vis = recordsPanel.style.display === 'none';
        recordsPanel.style.display = vis ? '' : 'none';
        if (vis) renderRecordsPanel();
        showToast(vis ? '已開啟成績面板' : '已關閉成績面板');
      }
    }
  },
  { label: '幫助', items: ['關於'], handler: () => showToast('貓九的滑塊遊戲 網頁體驗版 v0.1') },
];

let activeMenu: { idx: number; el: HTMLDivElement } | null = null;

function buildMenu(): void {
  menuBar.innerHTML = '';
  menus.forEach((menu, idx) => {
    const btn = document.createElement('div');
    btn.textContent = menu.label;
    btn.style.padding = '0 12px';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '13px';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllMenus();
      if (activeMenu?.idx === idx) { activeMenu = null; return; }
      const dropdown = createDropdown(idx, menu);
      activeMenu = { idx, el: dropdown };
      menuBar.appendChild(dropdown);
    });
    menuBar.appendChild(btn);
  });
}

function createDropdown(menuIdx: number, menuDef: MenuDef): HTMLDivElement {
  const dd = document.createElement('div');
  dd.style.position = 'absolute';
  dd.style.top = `${GEOMETRY.menu_bar_height}px`;
  dd.style.left = '0';
  dd.style.background = COLORS.menu_bg;
  dd.style.border = `1px solid ${COLORS.dialog_border}`;
  dd.style.minWidth = '180px';
  dd.style.zIndex = '1000';
  dd.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
  menuDef.items.forEach((item) => {
    if (item === '---') {
      const sep = document.createElement('div');
      sep.style.height = '1px';
      sep.style.background = COLORS.separator;
      sep.style.margin = '4px 0';
      dd.appendChild(sep);
      return;
    }
    const row = document.createElement('div');
    row.textContent = item;
    row.style.padding = '6px 12px';
    row.style.cursor = 'pointer';
    row.style.fontSize = '13px';
    row.style.color = item.startsWith('體驗版') ? '#888' : COLORS.menu_text;
    row.addEventListener('mouseenter', () => { row.style.background = COLORS.menu_hover; row.style.color = '#fff'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; row.style.color = item.startsWith('體驗版') ? '#888' : COLORS.menu_text; });
    row.addEventListener('click', () => { closeAllMenus(); menuDef.handler(item); });
    dd.appendChild(row);
  });
  return dd;
}

function closeAllMenus(): void {
  document.querySelectorAll('#menuBarDropdown').forEach((el) => el.remove());
  activeMenu = null;
}
document.addEventListener('click', closeAllMenus);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllMenus(); });
buildMenu();

const canvas = document.createElement('canvas');
// 畫布填滿可用區域（體驗版無右側面板，不預留 132px 右欄）
canvas.style.flex = '1 1 auto';
canvas.style.width = '100%';
canvas.style.display = 'block';
canvas.style.touchAction = 'none';
canvas.style.margin = '0';
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
// M6：浮動面板（虛擬鍵盤 / 成績）
const vkPanel = document.createElement('div');
vkPanel.style.position = 'fixed';
vkPanel.style.left = '12px';
vkPanel.style.bottom = `${GEOMETRY.status_bar_height + 12}px`;
vkPanel.style.background = COLORS.dialog_bg;
vkPanel.style.border = `1px solid ${COLORS.dialog_border}`;
vkPanel.style.borderRadius = '6px';
vkPanel.style.padding = '10px';
vkPanel.style.display = 'none';
vkPanel.style.zIndex = '500';
app.appendChild(vkPanel);

const recordsPanel = document.createElement('div');
recordsPanel.style.position = 'fixed';
recordsPanel.style.right = '12px';
recordsPanel.style.top = `${GEOMETRY.menu_bar_height + 8}px`;
recordsPanel.style.width = '260px';
recordsPanel.style.maxHeight = '60vh';
recordsPanel.style.overflowY = 'auto';
recordsPanel.style.background = COLORS.dialog_bg;
recordsPanel.style.border = `1px solid ${COLORS.dialog_border}`;
recordsPanel.style.borderRadius = '6px';
recordsPanel.style.padding = '10px';
recordsPanel.style.fontSize = '13px';
recordsPanel.style.color = COLORS.dialog_text;
recordsPanel.style.display = 'none';
recordsPanel.style.zIndex = '500';
app.appendChild(recordsPanel);

// M5：練習/計時模式 + 計時器
let gameMode: 'practice' | 'timed' = 'practice';
const timer = new Timer();

// M6：成績
const records = new Records();
/** 完成或 DNF 時寫入成績（僅競速模式）。 */
function recordResult(dnf: boolean): void {
  const key = puzzleKey(store.currentM, store.currentN, store.currentStep);
  records.add(store.currentM, store.currentN, store.currentStep, Math.round(timer.elapsedMs), store.cmd.stepCount, dnf);
  if (recordsPanel) renderRecordsPanel();
}

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

// 依可用區域調整畫布位圖尺寸（保持 CSS == 位圖，座標才 1:1）
function layoutCanvas(): void {
  const width = Math.max(320, app.clientWidth);
  const height = Math.max(
    240,
    app.clientHeight - GEOMETRY.menu_bar_height - GEOMETRY.status_bar_height,
  );
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  centerCamera();
}
layoutCanvas();
window.addEventListener('resize', () => {
  layoutCanvas();
  schedulePaint();
});

// 狀態欄用緩存字串，避免每幀重建 DOM（掉幀主因）
const statusSolved = document.createElement('span');
const statusSteps = document.createElement('span');
const statusPuzzle = document.createElement('span');
const statusTimer = document.createElement('span');
status.append(statusSolved, statusSteps, statusPuzzle, statusTimer);
let lastStatusKey = '';

function updateStatus(): void {
  const solved = store.solved;
  const timerText =
    gameMode === 'timed'
      ? `計時：${formatTime(timer.state === 'ready' ? 0 : timer.elapsedMs)}`
      : `模式：練習`;
  const key = `${solved}|${store.cmd.stepCount}|${store.currentStep}~${store.currentM}*${store.currentN}|${timer.state}|${gameMode}`;
  if (key === lastStatusKey) return;
  lastStatusKey = key;
  statusSolved.textContent = solved ? '狀態：復原' : '狀態：未復原';
  statusSolved.style.color = solved ? COLORS.solved : COLORS.unsolved;
  statusSteps.textContent = `步數：${store.cmd.stepCount}`;
  statusPuzzle.textContent = `謎題：${store.currentStep}~${store.currentM}*${store.currentN}`;
  statusTimer.textContent = timerText;
  statusTimer.style.color = timer.state === 'running' ? COLORS.timer_running : COLORS.status_text;
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
  onChanged: () => {
    autosave(store);
    if (gameMode === 'timed') {
      if (timer.state === 'ready') timer.start();
      if (store.solved && timer.state === 'running') {
        timer.solve();
        recordResult(false);
      }
    }
    schedulePaint();
  },
});

function addButton(label: string, onClick: () => void): HTMLButtonElement {
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
  return b;
}

addButton('打亂', () => {
  const reply = shuffle(store.cmd, 100);
  showToast(reply.message);
  renderer.animation = null;
  centerCamera();
  autosave(store);
  schedulePaint();
});
addButton('重置', () => {
  const reply = reset(store.cmd);
  showToast(reply.message);
  renderer.animation = null;
  centerCamera();
  autosave(store);
  schedulePaint();
});
addButton('撤銷', () => {
  const reply = undo(store.cmd);
  showToast(reply.message);
  autosave(store);
  schedulePaint();
});
addButton('重做', () => {
  const reply = redo(store.cmd);
  showToast(reply.message);
  autosave(store);
  schedulePaint();
});
addButton('存檔', () => {
  downloadSave(store);
  showToast('已下載存檔');
});
addButton('導入', () => {
  fileInput.click();
});
addButton('切換謎題', () => {
  const m = Number(window.prompt('列數 m（例如 4）', String(store.currentM)));
  const n = Number(window.prompt('行數 n（例如 5）', String(store.currentN)));
  const step = Number(window.prompt('步距 step（需 < max(m,n)）', String(store.currentStep)));
  if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step)) {
    showToast('輸入需為整數');
    return;
  }
  if (step >= Math.max(m, n)) {
    showToast(`step 需 < max(m,n)=${Math.max(m, n)}`);
    return;
  }
  store.newPuzzle(m, n, step);
  renderer.animation = null;
  centerCamera();
  autosave(store);
  timer.reset();
  schedulePaint();
  showToast(`切換謎題 ${step}~${m}*${n}`);
});
addButton('模式', () => {
  gameMode = gameMode === 'practice' ? 'timed' : 'practice';
  timer.reset();
  syncDnfButton();
  showToast(gameMode === 'timed' ? '模式：競速' : '模式：練習');
  schedulePaint();
});
const dnfButton = addButton('DNF', () => {
  if (gameMode === 'timed' && timer.state === 'running') {
    timer.dnf();
    recordResult(true);
    showToast('DNF');
    schedulePaint();
  }
});
dnfButton.style.display = 'none';
function syncDnfButton(): void {
  dnfButton.style.display = gameMode === 'timed' ? '' : 'none';
}

// M6：虛擬鍵盤（螢幕方向 + 常用動作，行動裝置可用）
const vkRow = document.createElement('div');
vkRow.style.display = 'flex';
vkRow.style.gap = '6px';
vkRow.style.padding = '0 16px 8px';
vkRow.style.flexWrap = 'wrap';
app.insertBefore(vkRow, status);

function vkButton(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.background = COLORS.input_bg;
  b.style.color = '#fff';
  b.style.border = '1px solid ' + COLORS.border;
  b.style.borderRadius = '4px';
  b.style.minWidth = '40px';
  b.style.padding = '8px 14px';
  b.style.cursor = 'pointer';
  b.addEventListener('click', onClick);
  vkRow.appendChild(b);
  return b;
}
vkButton('W', () => controller.move('w'));
vkButton('A', () => controller.move('a'));
vkButton('S', () => controller.move('s'));
vkButton('D', () => controller.move('d'));
vkButton('撤銷', () => { const r = undo(store.cmd); showToast(r.message); autosave(store); schedulePaint(); });
vkButton('打亂', () => { const r = shuffle(store.cmd, 100); showToast(r.message); renderer.animation = null; centerCamera(); autosave(store); timer.reset(); schedulePaint(); });
vkButton('重置', () => { const r = reset(store.cmd); showToast(r.message); renderer.animation = null; centerCamera(); autosave(store); schedulePaint(); });

let recordsPanelVisible = false;
const emptyRecordsNote = document.createElement('div');
emptyRecordsNote.style.color = '#888';
emptyRecordsNote.style.marginTop = '6px';
emptyRecordsNote.textContent = '尚無成績記錄';

function renderRecordsPanel(): void {
  const key = puzzleKey(store.currentM, store.currentN, store.currentStep);
  const list = records.get(key);
  const s = stats(list);
  const best = s.best === null ? '-' : formatTime(s.best);
  const worst = s.worst === null ? '-' : formatTime(s.worst);
  const ao5 = s.ao5 === null ? '-' : (s.ao5 === 'DNF' ? 'DNF' : formatTime(s.ao5));
  const ao12 = s.ao12 === null ? '-' : (s.ao12 === 'DNF' ? 'DNF' : formatTime(s.ao12));

  recordsPanel.innerHTML = '';
  const title = document.createElement('div');
  title.textContent = `成績：${key}`;
  title.style.color = COLORS.dialog_title;
  title.style.marginBottom = '6px';
  recordsPanel.appendChild(title);

  const sum = document.createElement('div');
  sum.textContent = `次數 ${s.count} ｜ 最佳 ${best} ｜ 最差 ${worst} ｜ DNF ${s.dnf_count}`;
  sum.style.marginBottom = '4px';
  recordsPanel.appendChild(sum);
  const ao = document.createElement('div');
  ao.textContent = `Ao5 ${ao5} ｜ Ao12 ${ao12}`;
  ao.style.marginBottom = '8px';
  recordsPanel.appendChild(ao);

  if (list.length === 0) {
    recordsPanel.appendChild(emptyRecordsNote);
    return;
  }
  const table = document.createElement('div');
  list
    .slice()
    .reverse()
    .forEach((r: RecordItem) => {
      const row = document.createElement('div');
      row.style.padding = '2px 0';
      row.style.borderBottom = `1px solid ${COLORS.separator}`;
      const t = r.dnf ? 'DNF' : formatTime(r.time_ms);
      row.textContent = `${t}（${r.moves}步）`;
      if (r.dnf) row.style.color = '#cc6666';
      table.appendChild(row);
    });
  recordsPanel.appendChild(table);
}

addButton('成績', () => {
  recordsPanelVisible = !recordsPanelVisible;
  recordsPanel.style.display = recordsPanelVisible ? '' : 'none';
  if (recordsPanelVisible) renderRecordsPanel();
});

// 導入檔案 input（隱藏）
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json,.txt';
fileInput.style.display = 'none';
app.appendChild(fileInput);
fileInput.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const r = importData(store, String(reader.result ?? ''));
    showToast(r.message);
    if (r.ok) {
      renderer.animation = null;
      centerCamera();
      autosave(store);
      schedulePaint();
    }
  };
  reader.readAsText(f);
  fileInput.value = '';
});

// 啟動時嘗試從 localStorage 恢復
if (autoload(store)) {
  renderer.animation = null;
  centerCamera();
  showToast('已恢復上次進度');
}

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

// 計時器顯示即時刷新（僅 running 時，直接更新文字，不全量重繪）
setInterval(() => {
  if (timer.isRunning) {
    statusTimer.textContent = `計時：${formatTime(timer.elapsedMs)}`;
    statusTimer.style.color = COLORS.timer_running;
  }
}, 100);

syncDnfButton();
schedulePaint();

// 簡單 console 自檢（供驗收）
console.log('[web] 初始 solved =', store.solved);
console.log('[web] 互動：點縫隙 → 點方塊 → W/S/A/D 或拖動');
