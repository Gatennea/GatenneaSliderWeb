/**
 * 體驗版入口
 * 對照原版 GUI：頂部下拉選單 + 中央棋盤 + 右側面板(滑條/開關) + 底部狀態列。
 */
import { BoardRenderer } from './render/BoardRenderer.js';
import { BoardController } from './interaction/BoardController.js';
import { GameStore } from './store/GameStore.js';
import { COLORS, GEOMETRY } from './render/theme.js';
import { shuffle, reset, undo, redo } from './core/CommandBus.js';
import { autosave, autoload, downloadSave, importData } from './io/SaveManager.js';
import { Timer, formatTime } from './feature/Timer.js';
import { Records, stats, puzzleKey } from './feature/Records.js';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.style.background = COLORS.background;
app.style.height = '100vh';
app.style.overflow = 'hidden';
app.style.display = 'flex';
app.style.flexDirection = 'column';
app.style.fontFamily = 'system-ui, sans-serif';

// ---------- 頂部選單欄 ----------
const menuBar = document.createElement('div');
menuBar.style.height = `${GEOMETRY.menu_bar_height}px`;
menuBar.style.background = COLORS.menu_bg;
menuBar.style.borderBottom = `1px solid ${COLORS.border}`;
menuBar.style.display = 'flex';
menuBar.style.alignItems = 'center';
menuBar.style.paddingLeft = '10px';
menuBar.style.color = COLORS.menu_text;
menuBar.style.userSelect = 'none';
menuBar.id = 'menuBar';
app.appendChild(menuBar);

// ---------- 中央區域（棋盤 + 右側面板） ----------
const content = document.createElement('div');
content.style.display = 'flex';
content.style.flex = '1 1 auto';
content.style.minHeight = '0';
app.appendChild(content);

const canvas = document.createElement('canvas');
canvas.style.flex = '1 1 auto';
canvas.style.display = 'block';
canvas.style.width = 'auto';
canvas.style.height = '100%';
canvas.style.minWidth = '0';
content.appendChild(canvas);

const rightPanel = document.createElement('div');
rightPanel.style.width = '132px';
rightPanel.style.flex = '0 0 132px';
rightPanel.style.background = COLORS.menu_bg;
rightPanel.style.borderLeft = `1px solid ${COLORS.border}`;
rightPanel.style.padding = '10px 8px';
rightPanel.style.display = 'flex';
rightPanel.style.flexDirection = 'column';
rightPanel.style.gap = '6px';
rightPanel.style.boxSizing = 'border-box';
content.appendChild(rightPanel);

// ---------- 底部狀態列 ----------
const status = document.createElement('div');
status.style.height = `${GEOMETRY.status_bar_height}px`;
status.style.background = COLORS.status_bg;
status.style.borderTop = `1px solid ${COLORS.border}`;
status.style.color = COLORS.status_text;
status.style.display = 'flex';
status.style.alignItems = 'center';
status.style.gap = '24px';
status.style.paddingLeft = '10px';
status.style.fontSize = '13px';
app.appendChild(status);

// 狀態列欄位（對照原版左→中→右）
const stSolved = document.createElement('span');
const stSteps = document.createElement('span');
const stTimer = document.createElement('span');
const stPuzzle = document.createElement('span');
const stZoom = document.createElement('span');
status.append(stSolved, stSteps, stTimer, stPuzzle, stZoom);

// ---------- 浮動面板 ----------
// ---------- 浮動面板（可拖動） ----------
const vkPanel = document.createElement('div');
vkPanel.style.position = 'fixed';
vkPanel.style.left = '12px';
vkPanel.style.top = '40px';
vkPanel.style.background = COLORS.dialog_bg;
vkPanel.style.border = `1px solid ${COLORS.dialog_border}`;
vkPanel.style.borderRadius = '6px';
vkPanel.style.zIndex = '500';
vkPanel.style.display = 'none';
vkPanel.style.padding = '0';
vkPanel.style.overflow = 'hidden';
app.appendChild(vkPanel);

const vkHeader = document.createElement('div');
vkHeader.style.display = 'flex';
vkHeader.style.alignItems = 'center';
vkHeader.style.justifyContent = 'space-between';
vkHeader.style.background = '#3c3c48';
vkHeader.style.padding = '4px 8px';
vkHeader.style.cursor = 'move';
vkHeader.style.userSelect = 'none';
const vkTitle = document.createElement('span');
vkTitle.textContent = '虚拟键盘';
vkTitle.style.color = '#fff';
vkTitle.style.fontSize = '13px';
const vkClose = document.createElement('span');
vkClose.textContent = '×';
vkClose.style.color = '#fff';
vkClose.style.cursor = 'pointer';
vkClose.style.padding = '0 4px';
vkHeader.append(vkTitle, vkClose);
vkPanel.appendChild(vkHeader);
const vkBody = document.createElement('div');
vkBody.style.padding = '8px';
vkBody.style.background = 'rgba(40,40,48,0.94)';
vkPanel.appendChild(vkBody);
vkClose.addEventListener('click', () => { vkPanel.style.display = 'none'; });

const recordsPanel = document.createElement('div');
recordsPanel.style.position = 'fixed';
recordsPanel.style.right = '12px';
recordsPanel.style.top = '40px';
recordsPanel.style.width = '260px';
recordsPanel.style.maxHeight = '60vh';
recordsPanel.style.background = COLORS.dialog_bg;
recordsPanel.style.border = `1px solid ${COLORS.dialog_border}`;
recordsPanel.style.borderRadius = '6px';
recordsPanel.style.zIndex = '500';
recordsPanel.style.display = 'none';
recordsPanel.style.padding = '0';
recordsPanel.style.overflow = 'hidden';
app.appendChild(recordsPanel);

const recordsHeader = document.createElement('div');
recordsHeader.style.display = 'flex';
recordsHeader.style.alignItems = 'center';
recordsHeader.style.justifyContent = 'space-between';
recordsHeader.style.background = '#3c3c48';
recordsHeader.style.padding = '4px 8px';
recordsHeader.style.cursor = 'move';
recordsHeader.style.userSelect = 'none';
const recordsTitle = document.createElement('span');
recordsTitle.textContent = '成绩';
recordsTitle.style.color = '#fff';
recordsTitle.style.fontSize = '13px';
const recordsClose = document.createElement('span');
recordsClose.textContent = '×';
recordsClose.style.color = '#fff';
recordsClose.style.cursor = 'pointer';
recordsClose.style.padding = '0 4px';
recordsHeader.append(recordsTitle, recordsClose);
recordsPanel.appendChild(recordsHeader);
const recordsBody = document.createElement('div');
recordsBody.style.padding = '10px';
recordsBody.style.maxHeight = 'calc(60vh - 28px)';
recordsBody.style.overflowY = 'auto';
recordsPanel.appendChild(recordsBody);
recordsClose.addEventListener('click', () => { recordsPanel.style.display = 'none'; });

function makeDraggable(panel: HTMLElement, header: HTMLElement): void {
  let dragging = false;
  let ox = 0;
  let oy = 0;
  header.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement) === header.querySelector('span:last-child')) return;
    dragging = true;
    ox = e.clientX - panel.offsetLeft;
    oy = e.clientY - panel.offsetTop;
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    panel.style.left = `${e.clientX - ox}px`;
    panel.style.top = `${e.clientY - oy}px`;
    panel.style.right = 'auto';
  });
  window.addEventListener('mouseup', () => { dragging = false; });
}
makeDraggable(vkPanel, vkHeader);
makeDraggable(recordsPanel, recordsHeader);



// ---------- Toast ----------
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

// ---------- 遊戲狀態 ----------
const store = new GameStore(4, 4, 2);
const renderer = new BoardRenderer(canvas.getContext('2d')!, 1);

let gameMode: 'practice' | 'timed' = 'practice';
const timer = new Timer();
const records = new Records();

function centerCamera(): void {
  const b = store.game.get_boundaries();
  const left = b.min_col * renderer.step;
  const right = b.max_col * renderer.step + renderer.cell;
  const top = b.min_row * renderer.step;
  const bottom = b.max_row * renderer.step + renderer.cell;
  const w = (right - left) * renderer.zoom;
  const h = (bottom - top) * renderer.zoom;
  renderer.cameraX = (canvas.width - w) / 2 - left * renderer.zoom;
  renderer.cameraY = (canvas.height - h) / 2 - top * renderer.zoom;
}

function layoutCanvas(): void {
  const w = Math.max(320, canvas.clientWidth);
  const h = Math.max(240, canvas.clientHeight);
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
  centerCamera();
}

function updateStatus(): void {
  stSolved.textContent = store.solved ? '状态：复原' : '状态：未复原';
  stSolved.style.color = store.solved ? COLORS.solved : COLORS.unsolved;
  stSteps.textContent = `步数：${store.cmd.stepCount}`;
  stPuzzle.textContent = `谜题：${store.currentStep}~${store.currentM}*${store.currentN}`;
  stZoom.textContent = `缩放：${Math.round(renderer.zoom * 100)}%`;
  const timerText = gameMode === 'timed'
    ? `计时：${formatTime(timer.state === 'ready' ? 0 : timer.elapsedMs)}`
    : `模式：练习`;
  stTimer.textContent = timerText;
  stTimer.style.color = timer.state === 'running' ? COLORS.timer_running : COLORS.status_text;
}

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
        const ms = timer.elapsedMs;
        records.add(store.currentM, store.currentN, store.currentStep, Math.round(ms), store.cmd.stepCount, false);
        showToast(`完成 ${formatTime(ms)}`);
      }
    }
    schedulePaint();
  },
})

// 鼠標滾輪縮放：向上滾放大、向下滾縮小
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const [wx, wy] = renderer.screenToWorld(sx, sy);
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  renderer.zoom = Math.max(0.5, Math.min(4, renderer.zoom * factor));
  // 以鼠標位置為中心：縮放後讓同一世界點仍留在鼠標下
  renderer.cameraX = sx - wx * renderer.zoom;
  renderer.cameraY = sy - wy * renderer.zoom;
  schedulePaint();
}, { passive: false });
;

// 供成績面板與 DNF
function recordDnf(): void {
  if (gameMode !== 'timed' || timer.state !== 'running') return;
  timer.dnf();
  records.add(store.currentM, store.currentN, store.currentStep, Math.round(timer.elapsedMs), store.cmd.stepCount, true);
  showToast('DNF');
  schedulePaint();
}

// 右側開關狀態
let selectionAnimationEnabled = true;

// ---------- 右側面板開關 ----------
type SwitchState = { key: string; label: string; get: () => boolean; set: (v: boolean) => void; el?: HTMLDivElement };
const switchStates: SwitchState[] = [
  { key: 'animation_enabled', label: '滑动动画', get: () => controller.animationEnabled, set: (v) => { controller.animationEnabled = v; } },
  { key: 'selection_animation_enabled', label: '选中动画', get: () => selectionAnimationEnabled, set: (v) => { selectionAnimationEnabled = v; } },
  { key: 'coloring_enabled', label: '着色', get: () => false, set: () => {} },
  { key: 'chain_hint_enabled', label: '连锁', get: () => false, set: () => {} },
  { key: 'game_mode', label: '模式', get: () => gameMode === 'timed', set: (v) => { gameMode = v ? 'timed' : 'practice'; timer.reset(); showToast(v ? '模式：竞速' : '模式：练习'); schedulePaint(); } },
  { key: 'macro_reverse_mode', label: '逆序宏', get: () => false, set: () => {} },
];

function renderSwitch(s: SwitchState): void {
  if (!s.el) return;
  const on = s.get();
  s.el.style.background = on ? COLORS.button_bg : COLORS.input_bg;
  s.el.style.color = on ? '#fff' : '#969696';
  const text = s.key === 'game_mode' ? `模式:${on ? '竞速' : '练习'}` : `${s.label}:${on ? '开' : '关'}`;
  s.el.textContent = text;
}

switchStates.forEach((s) => {
  const el = document.createElement('div');
  el.style.height = '24px';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.cursor = 'pointer';
  el.style.fontSize = '12px';
  el.style.borderRadius = '4px';
  s.el = el;
  renderSwitch(s);
  el.addEventListener('click', () => { s.set(!s.get()); renderSwitch(s); });
  rightPanel.appendChild(el);
});

// ---------- 右側面板垂直滑條：縮放 / 速度 ----------
// 原版：缩放條在左、速度條在右，兩條並排於面板上方
const sliderArea = document.createElement('div');
sliderArea.style.flex = '1 1 auto';
sliderArea.style.minHeight = '0';
sliderArea.style.display = 'flex';
sliderArea.style.flexDirection = 'row';
sliderArea.style.order = '-1';
sliderArea.style.gap = '8px';
rightPanel.appendChild(sliderArea);

function makeSlider(label: string, onChange: (ratio: number) => void): { track: HTMLDivElement; knob: HTMLDivElement } {
  const wrap = document.createElement('div');
  wrap.style.flex = '1 1 auto';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  const lab = document.createElement('div');
  lab.style.color = COLORS.status_text;
  lab.style.fontSize = '12px';
  lab.textContent = label;
  const track = document.createElement('div');
  track.style.flex = '1 1 auto';
  track.style.width = '6px';
  track.style.background = COLORS.border;
  track.style.borderRadius = '3px';
  track.style.position = 'relative';
  track.style.cursor = 'pointer';
  const knob = document.createElement('div');
  knob.style.position = 'absolute';
  knob.style.left = '-5px';
  knob.style.width = '16px';
  knob.style.height = '12px';
  knob.style.background = COLORS.button_bg;
  knob.style.borderRadius = '3px';
  track.appendChild(knob);
  wrap.append(lab, track);
  sliderArea.appendChild(wrap);

  function updateFromY(clientY: number): void {
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    onChange(ratio);
    knob.style.top = `${(1 - ratio) * rect.height - 6}px`;
  }
  track.addEventListener('mousedown', (e) => {
    updateFromY(e.clientY);
    const onMove = (ev: MouseEvent) => updateFromY(ev.clientY);
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
  return { track, knob };
}

const zoomSlider = makeSlider('缩放', (ratio) => {
  renderer.zoom = Math.max(0.5, Math.min(4, 0.5 + ratio * 3.5));
  centerCamera();
  schedulePaint();
});
const speedSlider = makeSlider('速度', (ratio) => {
  controller.moveDurationMs = Math.max(60, Math.min(800, 800 - ratio * 740));
  schedulePaint();
});

// ---------- 虛擬鍵盤浮動面板 ----------
let stickyOn = false;

function buildVK(): void {
  vkBody.innerHTML = '';
  const btn = (t: string, cb: () => void) => {
    const b = document.createElement('button');
    b.textContent = t;
    b.style.background = COLORS.button_bg;
    b.style.color = '#fff';
    b.style.border = 'none';
    b.style.borderRadius = '4px';
    b.style.padding = '5px 0';
    b.style.cursor = 'pointer';
    b.style.fontSize = '13px';
    b.style.fontFamily = 'inherit';
    b.style.fontWeight = 'normal';
    b.addEventListener('click', cb);
    return b;
  };

  // 方向鍵區（原版十字排列）
  const pad = document.createElement('div');
  pad.style.display = 'grid';
  pad.style.gridTemplateColumns = 'repeat(3, 44px)';
  pad.style.gap = '4px';
  const padEmpty = document.createElement('span');
  padEmpty.textContent = '';
  pad.appendChild(padEmpty);
  pad.appendChild(btn('↑', () => controller.move('w')));
  pad.appendChild(padEmpty.cloneNode(false));
  pad.appendChild(btn('←', () => controller.move('a')));
  pad.appendChild(btn('↓', () => controller.move('s')));
  pad.appendChild(btn('→', () => controller.move('d')));

  // 動作列（粘滞 / 撤銷 / 重做）
  const actionRow = document.createElement('div');
  actionRow.style.display = 'flex';
  actionRow.style.gap = '4px';
  actionRow.style.marginTop = '6px';
  const stickyBtn = btn('粘滞:单步', () => {
    stickyOn = !stickyOn;
    stickyBtn.textContent = stickyOn ? '粘滞:连续' : '粘滞:单步';
    showToast(stickyOn ? '粘滞：连续' : '粘滞：单步');
  });
  const undoBtn = btn('撤销', () => {
    if (stickyOn) {
      const iv = window.setInterval(() => {
        if (!store.cmd.history.canUndo) { window.clearInterval(iv); return; }
        handleUndo();
      }, 200);
    } else handleUndo();
  });
  const redoBtn = btn('重做', () => {
    if (stickyOn) {
      const iv = window.setInterval(() => {
        if (!store.cmd.history.canRedo) { window.clearInterval(iv); return; }
        handleRedo();
      }, 200);
    } else handleRedo();
  });
  actionRow.append(stickyBtn, undoBtn, redoBtn);

  // 跳到某步（輸入步數 + 跳到）
  const jumpRow = document.createElement('div');
  jumpRow.style.display = 'flex';
  jumpRow.style.gap = '4px';
  jumpRow.style.marginTop = '6px';
  const jumpInput = document.createElement('input');
  jumpInput.type = 'number';
  jumpInput.min = '0';
  jumpInput.value = String(store.cmd.stepCount);
  jumpInput.style.width = '52px';
  jumpInput.style.background = COLORS.input_bg;
  jumpInput.style.color = COLORS.input_text;
  jumpInput.style.border = '1px solid ' + COLORS.border;
  jumpInput.style.borderRadius = '4px';
  jumpInput.style.padding = '4px';
  const jumpBtn = btn('跳到', () => {
    const idx = Number(jumpInput.value);
    if (!Number.isInteger(idx)) { showToast('請輸入步數'); return; }
    if (store.cmd.history.jumpTo(store.game, idx)) {
      store.cmd.stepCount = idx;
      autosave(store);
      schedulePaint();
      showToast('已跳到第 ' + idx + ' 步');
    } else showToast('步數超出範圍');
  });
  jumpRow.append(jumpInput, jumpBtn);

  vkBody.append(pad, actionRow, jumpRow);
}

function toggleVK(): void {
  const vis = vkPanel.style.display === 'none';
  vkPanel.style.display = vis ? '' : 'none';
  if (vis) buildVK();
  showToast(vis ? '已開啟虛擬鍵盤' : '已關閉虛擬鍵盤');
}

// ---------- 成績面板 ----------
function renderRecordsPanel(): void {
  const key = puzzleKey(store.currentM, store.currentN, store.currentStep);
  const list = records.get(key);
  const s = stats(list);
  recordsBody.innerHTML = '';
  const t = document.createElement('div');
  t.textContent = `成績：${key}`;
  t.style.marginBottom = '6px';
  t.style.color = COLORS.dialog_title;
  recordsBody.appendChild(t);
  const sum = document.createElement('div');
  const fmt = (v: number | 'DNF' | null) => v === null ? '-' : v === 'DNF' ? 'DNF' : formatTime(v);
  sum.textContent = `次數 ${s.count} ｜ 最佳 ${fmt(s.best)} ｜ 最差 ${fmt(s.worst)} ｜ DNF ${s.dnf_count} ｜ Ao5 ${fmt(s.ao5)} ｜ Ao12 ${fmt(s.ao12)}`;
  recordsBody.appendChild(sum);
  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#888';
    empty.style.marginTop = '6px';
    empty.textContent = '尚無成績記錄';
    recordsBody.appendChild(empty);
    return;
  }
  list.slice().reverse().forEach((r) => {
    const row = document.createElement('div');
    row.style.padding = '2px 0';
    row.style.borderBottom = `1px solid ${COLORS.separator}`;
    row.textContent = `${r.dnf ? 'DNF' : formatTime(r.time_ms)}（${r.moves}步）`;
    if (r.dnf) row.style.color = '#cc6666';
    recordsBody.appendChild(row);
  });
}

function toggleRecords(): void {
  const vis = recordsPanel.style.display === 'none';
  recordsPanel.style.display = vis ? '' : 'none';
  if (vis) renderRecordsPanel();
  showToast(vis ? '已開啟成績面板' : '已關閉成績面板');
}

// ---------- 共用動作 ----------
const DIR_DELTA_ANIM: Record<string, [number, number]> = { w:[-1,0], s:[1,0], a:[0,-1], d:[0,1] };

/** 依 move_info 建立只動「該步滑塊組」的完整過場陣列；找不到對應塊回 null */
function buildHistoryAnim(moveInfo: { direction: string; step: number; moved_positions: [number, number][] }, isUndo: boolean): { start: [number, number][]; end: [number, number][] } | null {
  const game = store.game;
  const delta = DIR_DELTA_ANIM[moveInfo.direction];
  if (!delta) return null;
  const step = moveInfo.step || store.currentStep;
  const start = game.blocks.map((b) => [b.row, b.col] as [number, number]);
  const end = start.map((p) => [p[0], p[1]] as [number, number]);
  const posToIdx = new Map<string, number>();
  game.blocks.forEach((b, i) => posToIdx.set(`${b.row}:${b.col}`, i));
  for (const pre of moveInfo.moved_positions) {
    const post: [number, number] = [pre[0] + delta[0] * step, pre[1] + delta[1] * step];
    const idx = isUndo
      ? posToIdx.get(`${post[0]}:${post[1]}`)
      : posToIdx.get(`${pre[0]}:${pre[1]}`);
    if (idx === undefined) return null;
    end[idx] = isUndo ? [pre[0], pre[1]] : [post[0], post[1]];
  }
  return { start, end };
}

function flashMoveSelection(moveInfo: { direction: string; step: number; moved_positions: [number, number][] } | null | undefined, isUndo: boolean): void {
  if (!selectionAnimationEnabled || !moveInfo) return;
  const delta = DIR_DELTA_ANIM[moveInfo.direction];
  if (!delta) return;
  const step = moveInfo.step || store.currentStep;
  const targets = new Set<string>();
  for (const pre of moveInfo.moved_positions) {
    const pos = isUndo
      ? pre
      : ([pre[0] + delta[0] * step, pre[1] + delta[1] * step] as [number, number]);
    targets.add(`${pos[0]}:${pos[1]}`);
  }
  if (targets.size === 0) return;
  renderer.highlightCells = targets;
  window.setTimeout(() => { renderer.highlightCells = null; schedulePaint(); }, 420);
}

/** 執行動畫後再真正 undo/redo（只對該步滑塊組動畫，對照原版） */
function runHistoryAnimation(kind: 'undo' | 'redo'): void {
  const hist = store.cmd.history;
  const moveInfo = kind === 'undo' ? hist.currentMoveInfo() : hist.nextMoveInfo();

  const commit = () => {
    const r = kind === 'undo' ? undo(store.cmd) : redo(store.cmd);
    if (!r.ok) { showToast(r.message); return; }
    flashMoveSelection(moveInfo, kind === 'undo');
    autosave(store);
    schedulePaint();
    showToast(r.message);
  };

  if (!controller.animationEnabled || !moveInfo) { commit(); return; }
  const anim = buildHistoryAnim(moveInfo, kind === 'undo');
  if (!anim) { commit(); return; }

  renderer.animation = { start: anim.start, end: anim.end, progress: 0, durationMs: controller.moveDurationMs };
  const t0 = performance.now();
  const frame = (now: number): void => {
    const a = renderer.animation;
    if (!a) return;
    const p = Math.min(1, (now - t0) / a.durationMs);
    a.progress = p;
    schedulePaint();
    if (p < 1) {
      requestAnimationFrame(frame);
    } else {
      renderer.animation = null;
      commit();
    }
  };
  requestAnimationFrame(frame);
}

function handleUndo(): void {
  if (!store.cmd.history.canUndo) { showToast('沒有可撤銷的步驟'); return; }
  runHistoryAnimation('undo');
}

function handleRedo(): void {
  if (!store.cmd.history.canRedo) { showToast('沒有可重做的步驟'); return; }
  runHistoryAnimation('redo');
}

function handleShuffle(): void {
  const r = shuffle(store.cmd, store.currentM * store.currentN * 10);
  showToast(r.message);
  renderer.animation = null;
  centerCamera();
  autosave(store);
  timer.reset();
  schedulePaint();
}

function handleReset(): void {
  const r = reset(store.cmd);
  showToast(r.message);
  renderer.animation = null;
  centerCamera();
  autosave(store);
  timer.reset();
  schedulePaint();
}

function handleCustomPuzzle(): void {
  // 用自訂頁面表單取代瀏覽器內建 prompt
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.55)';
  overlay.style.zIndex = '2000';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.addEventListener('click', () => overlay.remove());

  const box = document.createElement('div');
  box.style.background = COLORS.dialog_bg;
  box.style.border = `1px solid ${COLORS.dialog_border}`;
  box.style.borderRadius = '8px';
  box.style.padding = '18px';
  box.style.width = '260px';
  box.style.color = COLORS.dialog_text;
  box.style.fontSize = '13px';
  box.addEventListener('click', (e) => e.stopPropagation());

  const title = document.createElement('div');
  title.textContent = '自訂謎題';
  title.style.marginBottom = '12px';
  title.style.fontWeight = 'bold';
  box.appendChild(title);

  const fields: [string, string][] = [
    ['列數 m', String(store.currentM)],
    ['行數 n', String(store.currentN)],
    ['步距 step', String(store.currentStep)],
  ];
  const inputs: HTMLInputElement[] = [];
  fields.forEach(([label, value]) => {
    const lab = document.createElement('label');
    lab.style.display = 'block';
    lab.style.marginBottom = '8px';
    const span = document.createElement('span');
    span.textContent = label;
    span.style.display = 'block';
    const input = document.createElement('input');
    input.value = value;
    input.type = 'number';
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.background = COLORS.input_bg;
    input.style.color = COLORS.input_text;
    input.style.border = `1px solid ${COLORS.dialog_border}`;
    input.style.borderRadius = '4px';
    input.style.padding = '6px';
    inputs.push(input);
    lab.append(span, input);
    box.appendChild(lab);
  });

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';
  btnRow.style.justifyContent = 'flex-end';
  btnRow.style.marginTop = '12px';
  const ok = document.createElement('button');
  ok.textContent = '確定';
  ok.style.background = COLORS.button_bg;
  ok.style.color = '#fff';
  ok.style.border = 'none';
  ok.style.borderRadius = '4px';
  ok.style.padding = '6px 14px';
  ok.style.cursor = 'pointer';
  const cancel = document.createElement('button');
  cancel.textContent = '取消';
  cancel.style.background = COLORS.input_bg;
  cancel.style.color = '#fff';
  cancel.style.border = `1px solid ${COLORS.border}`;
  cancel.style.borderRadius = '4px';
  cancel.style.padding = '6px 14px';
  cancel.style.cursor = 'pointer';
  cancel.addEventListener('click', () => overlay.remove());
  ok.addEventListener('click', () => {
    const m = Number(inputs[0].value);
    const n = Number(inputs[1].value);
    const step = Number(inputs[2].value);
    if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step)) { showToast('輸入需為整數'); return; }
    if (step >= Math.max(m, n)) { showToast(`step 需 < max(m,n)=${Math.max(m, n)}`); return; }
    store.newPuzzle(m, n, step);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    timer.reset();
    schedulePaint();
    showToast(`切換謎題 ${step}~${m}*${n}`);
    overlay.remove();
  });
  btnRow.append(cancel, ok);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  app.appendChild(overlay);
}

function handlePresetPuzzle(label: string): void {
  const m = Number(label.split('*')[0].split('~')[1]);
  const n = Number(label.split('*')[1]);
  const step = Number(label.split('~')[0]);
  store.newPuzzle(m, n, step);
  renderer.animation = null;
  centerCamera();
  autosave(store);
  timer.reset();
  schedulePaint();
  showToast(`切換謎題 ${step}~${m}*${n}`);
}

function setGameMode(mode: 'practice' | 'timed'): void {
  gameMode = mode;
  timer.reset();
  showToast(mode === 'timed' ? '模式：竞速' : '模式：练习');
  schedulePaint();
}

// ---------- 下拉選單 ----------
interface MenuDef { label: string; items: (string | '---')[]; handler: (item: string) => void; }
const menus: MenuDef[] = [
  { label: '文件', items: ['打开 Ctrl+O', '保存 Ctrl+S', '另存为...'], handler: (item) => {
      if (item.includes('保存') || item.includes('另存')) { downloadSave(store); showToast('已下載存檔'); }
      else if (item.includes('打开')) fileInput.click();
    }
  },
  { label: '编辑', items: ['撤销 Ctrl+Z', '重做 Ctrl+X', '打乱 Alt+S', '重置 Ctrl+R'], handler: (item) => {
      if (item.startsWith('撤销')) handleUndo();
      else if (item.startsWith('重做')) handleRedo();
      else if (item.startsWith('打乱')) handleShuffle();
      else if (item.startsWith('重置')) handleReset();
    }
  },
  { label: '谜题', items: ['2~4*4','2~5*5','2~6*6','2~7*7','2~8*8','2~9*9','2~10*10','---','3~6*6','3~7*7','3~8*8','3~9*9','3~10*10','---','自定义...','模式:练习','模式:竞速'], handler: (item) => {
      if (item === '自定义...') handleCustomPuzzle();
      else if (item === '模式:练习') setGameMode('practice');
      else if (item === '模式:竞速') setGameMode('timed');
      else if (item !== '---') handlePresetPuzzle(item);
    }
  },
  { label: '宏定义', items: ['录制', '执行', '删除'], handler: () => showToast('體驗版不含宏定義') },
  { label: '设置', items: ['虚拟键盘', '成绩面板'], handler: (item) => {
      if (item.includes('虚拟键盘')) toggleVK();
      else if (item.includes('成绩')) toggleRecords();
    }
  },
  { label: '帮助', items: ['关于'], handler: () => showToast('貓九的滑塊遊戲 網頁體驗版 v0.1') },
];

let activeMenu: number | null = null;

function closeAllMenus(): void {
  menuBar.querySelectorAll('[data-dropdown]').forEach((el) => el.remove());
  activeMenu = null;
}

function buildMenu(): void {
  menuBar.querySelectorAll('[data-dropdown]').forEach((el) => el.remove());
  menuBar.querySelectorAll('[data-menu-item]').forEach((el) => el.remove());
  menus.forEach((menu, idx) => {
    const item = document.createElement('div');
    item.dataset['menuItem'] = '1';
    item.textContent = menu.label;
    item.style.padding = '0 14px';
    item.style.cursor = 'pointer';
    item.style.fontSize = '13px';
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeMenu === idx) { closeAllMenus(); return; }
      closeAllMenus();
      const dd = document.createElement('div');
      dd.dataset['dropdown'] = '1';
      dd.style.position = 'absolute';
      dd.style.top = `${GEOMETRY.menu_bar_height}px`;
      dd.style.left = `${idx * 60 + 4}px`;
      dd.style.background = COLORS.menu_bg;
      dd.style.border = `1px solid ${COLORS.dialog_border}`;
      dd.style.minWidth = '170px';
      dd.style.zIndex = '1000';
      dd.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
      menu.items.forEach((mi) => {
        if (mi === '---') {
          const sep = document.createElement('div');
          sep.style.height = '1px';
          sep.style.background = COLORS.separator;
          sep.style.margin = '4px 0';
          dd.appendChild(sep);
          return;
        }
        const row = document.createElement('div');
        row.textContent = mi;
        row.style.padding = '6px 12px';
        row.style.cursor = 'pointer';
        row.style.fontSize = '13px';
        row.addEventListener('mouseenter', () => { row.style.background = COLORS.menu_hover; });
        row.addEventListener('mouseleave', () => { row.style.background = ''; });
        row.addEventListener('click', () => { closeAllMenus(); menu.handler(mi); });
        dd.appendChild(row);
      });
      menuBar.appendChild(dd);
      activeMenu = idx;
    });
    menuBar.appendChild(item);
  });
}

// ---------- 檔案導入 ----------
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json,.txt,.map';
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

// ---------- 快捷鍵 ----------
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') { closeAllMenus(); return; }
  if (ctrl && key === 'z') { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); return; }
  if (ctrl && key === 'y') { e.preventDefault(); handleRedo(); return; }
  if (ctrl && key === 'x') { e.preventDefault(); handleRedo(); return; }
  if (ctrl && key === 's') { e.preventDefault(); downloadSave(store); showToast('已下載存檔'); return; }
  if (ctrl && key === 'o') { e.preventDefault(); fileInput.click(); return; }
  if (ctrl && key === 'r') { e.preventDefault(); handleReset(); return; }
  if (e.altKey && key === 's') { e.preventDefault(); handleShuffle(); return; }
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (gameMode === 'timed') {
      if (timer.state === 'ready') { timer.start(); showToast('計時開始'); schedulePaint(); }
      else if (timer.state === 'running') { recordDnf(); }
    }
    return;
  }
  if (e.key === 'F1') { e.preventDefault(); toggleVK(); return; }
  if (e.key === 'F3') { e.preventDefault(); toggleRecords(); return; }
});

document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('#menuBar')) closeAllMenus();
});

// ---------- 初始化 ----------
buildMenu();
buildVK();
layoutCanvas();
window.addEventListener('resize', () => { layoutCanvas(); schedulePaint(); });
if (autoload(store)) {
  centerCamera();
  showToast('已恢復上次進度');
}
schedulePaint();

setInterval(() => {
  if (timer.isRunning) {
    stTimer.textContent = `计时：${formatTime(timer.elapsedMs)}`;
    stTimer.style.color = COLORS.timer_running;
  }
}, 100);

console.log('[web] 初始 solved =', store.solved);
console.log('[web] 互動：點縫隙 → 點方塊 → W/S/A/D 或拖動');
