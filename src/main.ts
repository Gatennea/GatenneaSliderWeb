/**
 * 體驗版入口
 * 對照原版 GUI：頂部下拉選單 + 中央棋盤 + 右側面板(滑條/開關) + 底部狀態列。
 */
import { BoardRenderer, type SolvedPopupResult } from './render/BoardRenderer.js';
import { BoardController } from './interaction/BoardController.js';
import { GameStore } from './store/GameStore.js';
import { COLORS, GEOMETRY, easeOut, FONT_FAMILY } from './render/theme.js';
import { shuffle, reset, undo, redo, selectGap, selectBlock } from './core/CommandBus.js';
import { solve, describeAction, bestMove, stateFromBlocks } from './solver/index.js';
import type { SolverAction } from './solver/index.js';
import { autosave, autoload, downloadSave, saveAs, importData, listSaves, saveSlot, loadSlot, deleteSlot, updateSlot } from './io/SaveManager.js';
import { Timer, formatTime } from './feature/Timer.js';
import { Records, stats, series, tpsOf, blocksToMap, type RecordItem } from './feature/Records.js';
import { TutorialController } from './feature/tutorial.js';
import { CreativeController } from './feature/create.js';
import { APP_VERSION, entryFor, shouldShowChangelog } from './feature/changelog.js';
import {
  VK, StickyPlayer, resolveJumpTarget, vkDefaultPosition, vkClampPosition, vkPanelSize,
  vkDirectionRows, type VkViewport, type VkChrome,
} from './feature/virtualKeyboard.js';
import type { Block } from './core/Block.js';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.style.background = COLORS.background;
app.style.height = '100vh';
// 100dvh（動態視口）：手機瀏覽器工具列收合時 100vh 並不跟著變，底部狀態列會被頂出畫面。
// 不支援的瀏覽器會忽略這一條，保留上一行的 100vh。
app.style.height = '100dvh';
// 安全區：避開瀏海（上）與手勢條（下）。padding 加在 app 上，棋盤與狀態列一起內縮，
// 底部欄才不會被手勢條壓住（手機專項第 14/15 項）。
app.style.paddingTop = 'env(safe-area-inset-top, 0px)';
app.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
app.style.overflow = 'hidden';
app.style.display = 'flex';
app.style.flexDirection = 'column';
// 字型對照原版：整套介面都是 SimHei（黑體），不是瀏覽器預設字型
app.style.fontFamily = FONT_FAMILY;
// 下拉選單改用 app 當定位基準：若掛在選單欄底下，窄屏時會被選單欄裁掉
app.style.position = 'relative';

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
menuBar.style.flexShrink = '0';
// 選單項目不允許被壓扁：窄屏靠 applyChromeDensity 縮字距，真的還放不下就橫向捲動
// （下拉選單已改掛在 app 上，所以這裡可以安全地把超出部分裁掉）
menuBar.style.whiteSpace = 'nowrap';
menuBar.style.overflowX = 'auto';
menuBar.style.overflowY = 'hidden';
menuBar.style.setProperty('scrollbar-width', 'none');
menuBar.id = 'menuBar';
app.appendChild(menuBar);
// 捲軸只在真的放不下時才會出現，藏起來免得佔掉選單列那 32px
const chromeStyle = document.createElement('style');
chromeStyle.textContent = '#menuBar::-webkit-scrollbar { display: none; }';
document.head.appendChild(chromeStyle);

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
// 手機防誤觸（第 12 項）：讓棋盤獨佔觸控手勢，瀏覽器不要把拖曳解釋成捲動/縮放/長按選單；
// 也關掉長按會冒出的文字選取與點擊高亮（否則拖一下棋盤就「選到字」）。
canvas.style.touchAction = 'none';
canvas.style.userSelect = 'none';
canvas.style.setProperty('-webkit-user-select', 'none');
canvas.style.setProperty('-webkit-touch-callout', 'none');
canvas.style.setProperty('-webkit-tap-highlight-color', 'transparent');
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
// 右緣留出右側面板寬 + 10，讓「縮放」停的位置與原版一致
// （原版 zoom_x = screen_width - 文字寬 - right_panel_width - 10）
status.style.paddingRight = `${GEOMETRY.right_panel_width + 10}px`;
status.style.fontSize = '14px'; // 原版 status_font = SimHei 14
status.style.flexShrink = '0';
status.style.position = 'relative';
app.appendChild(status);

// 狀態列欄位（對照原版左→中→右）
const stSolved = document.createElement('span');
const stSteps = document.createElement('span');
const stTimer = document.createElement('span');
const stPuzzle = document.createElement('span');
const stZoom = document.createElement('span');
status.append(stSolved, stSteps, stTimer, stPuzzle, stZoom);
// 五個欄位都不換行、不被壓扁；窄屏由 applyChromeDensity 縮間距，實在不夠就橫向捲動
[stSolved, stSteps, stTimer, stPuzzle, stZoom].forEach((el) => {
  el.style.whiteSpace = 'nowrap';
  el.style.flexShrink = '0';
});
// 對照原版：謎題整條畫面居中、縮放靠右（原版正是把謎題畫在 screen_width/2）
stPuzzle.style.position = 'absolute';
stPuzzle.style.left = '50%';
stPuzzle.style.transform = 'translateX(-50%)';
stZoom.style.marginLeft = 'auto';
// 計時區可點（對照原版點狀態欄計時區 = 按空格）：就緒→開始、計時中→放棄(DNF)
stTimer.addEventListener('click', onTimerBarClick);

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
// 寬度對齊原版 `_vk_panel_size()`（動作列決定：8*2 + 62*2 + 54 + 6*2 = 206）
vkPanel.style.boxSizing = 'border-box';
vkPanel.style.width = `${vkPanelSize(vkDirectionRows()).w}px`;
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
vkClose.dataset['panelClose'] = '1'; // 拖動時要排掉它：點 × 不是要拖面板
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
recordsPanel.style.width = '300px';
recordsPanel.style.maxHeight = '70vh';
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
recordsTitle.textContent = '成绩记录';
recordsTitle.style.color = '#fff';
recordsTitle.style.fontSize = '13px';
const recordsClose = document.createElement('span');
recordsClose.textContent = '×';
recordsClose.dataset['panelClose'] = '1';
recordsClose.style.color = '#fff';
recordsClose.style.cursor = 'pointer';
recordsClose.style.padding = '0 4px';
recordsHeader.append(recordsTitle, recordsClose);
recordsPanel.appendChild(recordsHeader);
const recordsBody = document.createElement('div');
recordsBody.style.padding = '10px';
recordsBody.style.maxHeight = 'calc(70vh - 28px)';
recordsBody.style.overflowY = 'auto';
recordsPanel.appendChild(recordsBody);
recordsClose.addEventListener('click', () => { recordsPanel.style.display = 'none'; });

/**
 * 面板拖動（對照原版 `_vk_clamp_position`）。
 *
 * 兩點與舊實作不同：① 用 **pointer** 事件而非 mouse——舊版在觸屏上根本拖不動；
 * ② 拖到哪都夾在可視範圍內，不壓住選單列與狀態列（原版會 clamp，網頁版舊碼不會）。
 */
function makeDraggable(panel: HTMLElement, header: HTMLElement, onMoved?: () => void): void {
  let dragging = false;
  let ox = 0;
  let oy = 0;
  header.addEventListener('pointerdown', (e) => {
    // 點在關閉鈕上不算拖動（原版也是先判 close_rect 才判 title_rect）
    if ((e.target as HTMLElement).closest('[data-panel-close]')) return;
    // 先固化 left 再取消 right，否則 offsetLeft 會在切換定位方式時跳位
    panel.style.left = `${panel.offsetLeft}px`;
    panel.style.right = 'auto';
    ox = e.clientX - panel.offsetLeft;
    oy = e.clientY - panel.offsetTop;
    dragging = true;
    // 觸屏：不 capture 的話手指滑出標題欄就收不到後續事件
    header.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  });
  header.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = vkClampPosition(
      { x: e.clientX - ox, y: e.clientY - oy },
      vkViewport(),
      { w: panel.offsetWidth, h: panel.offsetHeight },
      vkChrome(),
    );
    panel.style.left = `${p.x}px`;
    panel.style.top = `${p.y}px`;
    onMoved?.();
  });
  const stop = (): void => { dragging = false; };
  header.addEventListener('pointerup', stop);
  header.addEventListener('pointercancel', stop);
}
makeDraggable(vkPanel, vkHeader, () => { vkMoved = true; saveUiPrefs(); });
makeDraggable(recordsPanel, recordsHeader);



// ---------- Toast ----------
const toast = document.createElement('div');
toast.style.position = 'fixed';
// 對照原版：通知落在「狀態列上方、右側面板左側」的右下角，而非蓋在右側面板下緣
toast.style.right = `${GEOMETRY.right_panel_width + 12}px`;
toast.style.bottom = `${GEOMETRY.status_bar_height + 12}px`;
toast.style.color = COLORS.timer_running;
toast.style.fontSize = '13px';
toast.style.pointerEvents = 'none';
app.appendChild(toast);
let toastTimer = 0;
// ---------- 完整版功能入口 ----------
/** Windows 完整版下載直鏈（附件名固定，永久指向最新版） */
const FULL_VERSION_URL =
  'https://github.com/Gatennea/GatenneaSlider/releases/latest/download/GatenneaSlider-Windows.zip';
/** 官網首頁（#compare 是「網頁版 vs 完整版」功能對比表） */
const HOME_URL = 'https://gatennea.github.io/GatenneaSliderWeb/';
const BRAND_COLOR = '#4696c8';

/**
 * 完整版專屬功能的說明框。
 *
 * 體驗版刻意沿用完整版的選單結構，做不到的項目一律標成灰色 + 「完整版」角標，
 * 點下去不會靜默無反應，而是告訴使用者這功能是什麼、去哪裡拿。
 * 原則同 game.py 的 SOLVER_FORM_SUPPORT：不支援就明確說，不要偷偷換成別的東西。
 */
function showFullVersionDialog(feature: string): void {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.55)';
  overlay.style.zIndex = '3000';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.addEventListener('click', () => overlay.remove());

  const box = document.createElement('div');
  box.style.background = COLORS.dialog_bg;
  box.style.border = `1px solid ${COLORS.dialog_border}`;
  box.style.borderRadius = '8px';
  box.style.padding = '20px';
  box.style.width = 'min(380px, 90vw)';
  box.style.color = COLORS.dialog_text;
  box.style.fontSize = '13px';
  box.style.lineHeight = '1.7';
  box.addEventListener('click', (e) => e.stopPropagation());

  const title = document.createElement('div');
  title.textContent = feature.replace(/\.\.\.$/, '');
  title.style.fontSize = '15px';
  title.style.color = '#fff';
  title.style.marginBottom = '6px';
  box.appendChild(title);

  const tagRow = document.createElement('div');
  tagRow.textContent = '完整版功能';
  tagRow.style.display = 'inline-block';
  tagRow.style.fontSize = '11px';
  tagRow.style.background = BRAND_COLOR;
  tagRow.style.color = '#fff';
  tagRow.style.borderRadius = '3px';
  tagRow.style.padding = '1px 7px';
  tagRow.style.marginBottom = '10px';
  box.appendChild(tagRow);

  const body = document.createElement('div');
  body.textContent =
    '这个功能只有 Windows / Python 完整版才有。' +
    '网頁体验版保留的是核心玩法：随机打乱与还原、计时与成绩统计、着色与连锁视觉輔助、' +
    '本机存档、三种控制模式。';
  box.appendChild(body);

  const hint = document.createElement('div');
  hint.textContent = '完整版一样免費开源，不用自己装 Python，解压后双击即可执行。';
  hint.style.color = '#9a9a9a';
  hint.style.marginTop = '6px';
  box.appendChild(hint);

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '10px';
  btnRow.style.marginTop = '16px';

  const mkBtn = (text: string, primary: boolean, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.flex = '1 1 auto';
    b.style.padding = '8px 10px';
    b.style.fontSize = '13px';
    b.style.fontFamily = 'inherit';
    b.style.borderRadius = '6px';
    b.style.cursor = 'pointer';
    b.style.background = primary ? BRAND_COLOR : 'transparent';
    b.style.color = primary ? '#fff' : COLORS.dialog_text;
    b.style.border = primary ? `1px solid ${BRAND_COLOR}` : `1px solid ${COLORS.dialog_border}`;
    b.addEventListener('click', onClick);
    return b;
  };
  btnRow.appendChild(mkBtn('下载完整版', true, () => {
    window.open(FULL_VERSION_URL, '_blank', 'noopener');
    overlay.remove();
  }));
  btnRow.appendChild(mkBtn('看功能对比', false, () => {
    window.open(`${HOME_URL}#compare`, '_blank', 'noopener');
    overlay.remove();
  }));
  box.appendChild(btnRow);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showToast(text: string): void {
  toast.textContent = text;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.textContent = ''), 1400);
}

// ---------- 遊戲狀態 ----------
// 是否觸屏設備（粗指針/無 hover）。用來決定是否默認開啟虛擬鼠標，以及設置裡
// 「虛擬鼠標」開關是否顯示（電腦端根本不需要，且沒有 touch 事件去驅動它）。
const isTouchDevice =
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: none)').matches;
// 初始謎題：6×6 等級2（原 4×4 等級2）
const store = new GameStore(6, 6, 2);
const renderer = new BoardRenderer(canvas.getContext('2d')!, 1);
// 點擊漣漪存活期間需要連續重繪；schedulePaint 是函式聲明（已提升），此處可直接引用
renderer.repaint = schedulePaint;
// 觸屏設備默認開虛擬鼠標（電腦端走原版 mouse 邏輯，不啟用）
if (isTouchDevice) renderer.showVirtualMouse = true;

let gameMode: 'practice' | 'timed' | 'creative' = 'practice';
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
  stPuzzle.textContent = `谜题：${store.puzzleKey}`;
  stZoom.textContent = `缩放：${Math.round(renderer.zoom * 100)}%`;
  const timerText = gameMode === 'practice'
    ? '练习模式'
    : gameMode === 'creative'
      ? '创造模式'
      : timer.state === 'idle'
      ? '竞速模式（待打乱）'
      : timer.state === 'ready'
        ? '竞速模式（就绪，空格开始）'
        : timer.state === 'running'
          ? `竞速模式 ${formatTime(timer.elapsedMs)}`
          : timer.state === 'solved'
            ? `竞速模式 成绩 ${formatTime(timer.elapsedMs)}`
            : '竞速模式 DNF';
  stTimer.textContent = timerText;
  stTimer.style.color = timer.state === 'running' ? COLORS.timer_running : COLORS.status_text;
  // 計時區可點（對照原版 _timer_bar_rect：競速下 就緒→開始、計時中→放棄/DNF）。
  // 手機沒有實體空格鍵，點擊是那裡唯一的 DNF 入口，故加手型光標與提示。
  const timerClickable = gameMode === 'timed' && (timer.state === 'ready' || timer.state === 'running');
  stTimer.style.cursor = timerClickable ? 'pointer' : 'default';
  stTimer.title = timerClickable
    ? (timer.state === 'ready' ? '计时区：点击开始计时' : '计时区：点击放弃（DNF）')
    : '';
  syncQuickBar();
}

/**
 * 常駐撤銷/重做的可用性。
 *
 * 教程解法回放中也鎖住（原版 `_vk_trigger_action` 開頭就 `_tut_board_locked()`）：
 * 正在播示範時按撤銷會把回放與歷史攪在一起。
 */
function syncQuickBar(): void {
  const locked = tutorial.isReplaying();
  const canUndo = store.cmd.history.canUndo && !locked;
  const canRedo = store.cmd.history.canRedo && !locked;
  undoQuick.disabled = !canUndo;
  redoQuick.disabled = !canRedo;
  undoQuick.style.opacity = canUndo ? '1' : '0.45';
  redoQuick.style.opacity = canRedo ? '1' : '0.45';
}

let needsPaint = true;
let rafQueued = false;
let demoPlaying = false;
function schedulePaint(): void {
  needsPaint = true;
  if (rafQueued) return;
  rafQueued = true;
  // Demo 模式降低帧率：背景动画 30fps 足够，减少渲染压力
  const rafDelay = demoFile ? 33 : 0;
  setTimeout(() => {
    rafQueued = false;
    if (needsPaint) {
      needsPaint = false;
      if (demoPlaying) followDemoCamera();
      renderer.draw(store);
      updateStatus();
      tickTutorial();
      tutorial.tick();
    }
  }, rafDelay);
}

const controller = new BoardController({
  canvas,
  renderer,
  store,
  onStatus: showToast,
  requestPaint: schedulePaint,
  onZoomChange: () => syncZoomSlider(),
  beforeMove: () => {
    // 教程解法回放中鎖住棋盤（對照原版 move.py::move_selected_blocks 開頭的
    // _tut_board_locked）：回放在按快照重擺棋盤，玩家此時移動會被下一幀覆蓋，
    // 只會看到畫面亂跳。拖拽跟隨的提交也走 animateMove，故一併被攔。
    if (tutorial.isReplaying()) return '教程解法回放中：稍等回放结束再操作';
    if (gameMode === 'timed') {
      if (timer.state === 'idle') return '竞速模式：请先使用打乱功能';
      if (timer.state === 'ready') return '竞速模式：按空白键开始计时后才能滑动';
    }
    return null;
  },
  // 復原懸浮窗的「按 Enter 保存」（對照原版提示）
  onPopupSave: () => {
    downloadSave(store);
    showToast('已下载存档');
  },
  onChanged: () => {
    // 引導/章節/解法回放期間不寫入自動存檔，避免把玩家原本的對局覆蓋成引導局面
    if (!tutorialActive() && !tutorial.chapterActive()) autosave(store);
    tutorialOnMoved();
    tutorial.onMoved();
    // 競速模式：還原瞬間停錶 + 記成績（含 PB 判定，供復原彈窗顯示）
    let result: SolvedPopupResult | null = null;
    if (gameMode === 'timed') {
      if (store.solved && timer.state === 'running') {
        timer.solve();
        const ms = timer.elapsedMs;
        const { item, pb } = records.addTimed(
          store.currentM, store.currentN, store.currentStep, Math.round(ms),
          store.cmd.stepCount, false, store.numbered, raceInitialBlocks(),
        );
        refreshRecordsPanel(); // 面板默認展開著：不入庫刷新會被當成「沒計入」
        showToast(`完成 ${formatTime(ms)}`);
        result = { time_ms: item.time_ms, moves: item.moves, tps: tpsOf(item), pb };
      }
    }
    maybeShowSolvedPopup(result);
    schedulePaint();
  },
})

/**
 * 復原彈窗觸發（對照原版 _maybe_show_solved_popup）：
 * 邊緣檢測（未復原→復原）+ 撤銷/重做/教程回放抑制。換局/打亂/重設的基線同步
 * 在 GameStore.applyPuzzle 與此處的 shuffle/reset 尾部分別完成。
 */
function maybeShowSolvedPopup(
  result: SolvedPopupResult | null = null,
  opts: { viaRedo?: boolean; viaUndo?: boolean } = {},
): void {
  if (store.solvedPopupTracker.note(store.solved, { ...opts, locked: tutorial.isReplaying() })) {
    renderer.spawnSolvedPopup(result);
  }
}

// ---------- 章節教程 / 創造模式 控制器（在 controller 之後、任何 schedulePaint 呼叫之前實例化，避免 TDZ）----------
const tutorial = new TutorialController({
  store, renderer, controller, app,
  schedulePaint, showToast, centerCamera,
  frameBounds: (minRow, minCol, maxRow, maxCol) => {
    const left = minCol * renderer.step;
    const right = maxCol * renderer.step + renderer.cell;
    const top = minRow * renderer.step;
    const bottom = maxRow * renderer.step + renderer.cell;
    const w = (right - left) * renderer.zoom;
    const h = (bottom - top) * renderer.zoom;
    renderer.cameraX = (canvas.width - w) / 2 - left * renderer.zoom;
    renderer.cameraY = (canvas.height - h) / 2 - top * renderer.zoom;
    schedulePaint();
  },
  ensurePractice: () => {
    if (gameMode !== 'practice') setGameMode('practice');
    else timer.cancel();
  },
});

const creative = new CreativeController({
  store, renderer, controller, app,
  schedulePaint, showToast, centerCamera,
  applyAsPuzzle: (m, n, step, blocks, solution) => {
    store.solutionMask = solution;
    store.applyPuzzle(m, n, step, blocks);
    renderer.solutionMask = solution;
    centerCamera();
    schedulePaint();
  },
  enterCreative: () => {
    if (timer.state === 'running') { showToast('计时中无法进入创造模式'); return; }
    gameMode = 'creative';
    timer.cancel();
    store.cmd.selectedGap = null;
    store.cmd.selectedBlock = null;
    store.game.selected.clear();
  },
  exitCreative: () => {
    gameMode = 'practice';
    timer.cancel();
  },
});


// ---------- 新手引導 ----------
/**
 * 體驗版是唯一的零門檻試玩入口，但一進來是一盤已經拼好的方塊，沒人告訴你該做什麼。
 * 這段引導用「一步就能推回去」的小局面，帶著走完一次完整的「點縫 → 點塊 → 推」。
 * 座標講法與遊戲內其它說明一致：一律「從 1 數第幾行第幾列」。
 */
const TUTORIAL_DONE_KEY = 'gatennea-slider-web:tutorial-done';

interface TutorialStep {
  text: string;
  /** 要描白框的格子（世界座標 row:col） */
  cells?: [number, number][];
  /** 這一步要等到什麼才算完成；'move' 由移動完成事件收尾 */
  wait: 'gap' | 'block' | 'move';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  { text: '① 点第 3 行与第 4 行之间那条横缝 —— 缝是一把刀，它决定切开哪一側', wait: 'gap' },
  { text: '② 再点第 4 行（最下面一排）的任意一块 —— 跟它连成一片的会整片一起走', cells: [[3, 1], [3, 2], [3, 3], [3, 4]], wait: 'block' },
  { text: '③ 按 ← 键，或直接在方块上往左拖 —— 把这一排推回原位', wait: 'move' },
];

let tutorialStep = -1;
/** 進入引導前的局面與模式，結束時原樣還原，避免引導過程覆蓋玩家原本的對局。 */
let tutorialReturn: { save: any; mode: 'practice' | 'timed' | 'creative' } | null = null;

function tutorialActive(): boolean {
  return tutorialStep >= 0;
}

/** 是否已經看過引導（隱私模式讀不到 localStorage 時當作沒看過）。 */
function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function startTutorial(): void {
  if (gameMode === 'timed' && timer.state === 'running') {
    showToast('计时中无法开始引导');
    return;
  }
  // 記住進入引導前的局面（含模式），結束時原樣還原，不動用自動存檔
  tutorialReturn = { save: store.serialize(), mode: gameMode };
  store.loadTutorialPosition();
  // 引導走練習模式（順便把計時器歸位）；本來就是練習模式時不額外彈提示
  if (gameMode !== 'practice') setGameMode('practice');
  else timer.cancel();
  tutorialStep = 0;
  tutorialBar.style.display = 'flex';
  syncQuickBarBottom(); // 引導條佔住底部，常駐撤銷/重做條抬上去讓位
  renderTutorialBar();
  applyTutorialHighlight();
  centerCamera();
  updateStatus();
  schedulePaint();
}

function endTutorial(): void {
  tutorialStep = -1;
  renderer.highlightCells = null;
  tutorialBar.style.display = 'none';
  syncQuickBarBottom();
  try {
    localStorage.setItem(TUTORIAL_DONE_KEY, '1');
  } catch {
    // 隱私模式寫不進 localStorage：只影響「下次自動引導」，不影響遊戲
  }
  // 原樣還原進入引導前的局面（玩家原本的對局不會被引導覆蓋）
  if (tutorialReturn) {
    store.deserialize(tutorialReturn.save);
    const prevMode = tutorialReturn.mode;
    tutorialReturn = null;
    if (prevMode === 'timed') setGameMode('timed');
    else if (gameMode !== 'practice') setGameMode('practice');
    centerCamera();
    updateStatus();
  }
  schedulePaint();
}

function applyTutorialHighlight(): void {
  const step = TUTORIAL_STEPS[tutorialStep];
  renderer.highlightCells = step?.cells ? new Set(step.cells.map(([r, c]) => `${r}:${c}`)) : null;
}

function renderTutorialBar(): void {
  tutorialText.textContent = TUTORIAL_STEPS[tutorialStep]?.text ?? '';
}

/** 每次重繪順便檢查進度：互動後一定會重繪，所以在這裡檢查就夠即時。 */
function tickTutorial(): void {
  if (!tutorialActive()) return;
  const step = TUTORIAL_STEPS[tutorialStep];
  if (!step) return;
  if (step.wait === 'gap') {
    const g = store.cmd.selectedGap;
    if (g && g.type === 'h' && g.line === 2) advanceTutorial();
  } else if (step.wait === 'block') {
    if (store.game.selected.size > 0) advanceTutorial();
  }
}

function advanceTutorial(): void {
  tutorialStep += 1;
  if (tutorialStep >= TUTORIAL_STEPS.length) {
    // 最後一步等的是「移動」，交給 tutorialOnMoved 收尾
    tutorialStep = TUTORIAL_STEPS.length - 1;
    return;
  }
  applyTutorialHighlight();
  renderTutorialBar();
  schedulePaint();
}

/** 移動完成（BoardController.onChanged）：引導的最後一步靠它收尾。 */
function tutorialOnMoved(): void {
  if (!tutorialActive()) return;
  if (tutorialStep !== TUTORIAL_STEPS.length - 1) return;
  if (store.solved) {
    showToast('就是这样！剩下的交给你了');
    endTutorial();
  } else {
    // 推錯方向或不完整：留在這一步，讓玩家再試一次
    renderTutorialBar();
  }
}

const tutorialBar = document.createElement('div');
tutorialBar.style.position = 'fixed';
tutorialBar.style.left = '50%';
tutorialBar.style.bottom = `${GEOMETRY.status_bar_height + 12}px`;
tutorialBar.style.transform = 'translateX(-50%)';
tutorialBar.style.display = 'none';
tutorialBar.style.alignItems = 'center';
tutorialBar.style.gap = '12px';
tutorialBar.style.maxWidth = 'calc(100vw - 24px)';
tutorialBar.style.background = COLORS.dialog_bg;
tutorialBar.style.border = `1px solid ${COLORS.dialog_border}`;
tutorialBar.style.borderRadius = '8px';
tutorialBar.style.padding = '8px 12px';
tutorialBar.style.color = COLORS.dialog_text;
tutorialBar.style.fontSize = '13px';
tutorialBar.style.lineHeight = '1.5';
tutorialBar.style.zIndex = '800';
tutorialBar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.45)';
const tutorialText = document.createElement('span');
const tutorialSkip = document.createElement('span');
tutorialSkip.textContent = '跳过引导';
tutorialSkip.style.cursor = 'pointer';
tutorialSkip.style.color = BRAND_COLOR;
tutorialSkip.style.whiteSpace = 'nowrap';
tutorialSkip.addEventListener('click', () => endTutorial());
tutorialBar.append(tutorialText, tutorialSkip);
app.appendChild(tutorialBar);

let syncZoomSlider: () => void = () => {};

// 鼠標滾輪縮放：向上滾放大、向下滾縮小
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const [wx, wy] = renderer.screenToWorld(sx, sy);
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  renderer.zoom = Math.max(0.1, Math.min(4, renderer.zoom * factor));
  // 以鼠標位置為中心：縮放後讓同一世界點仍留在鼠標下
  renderer.cameraX = sx - wx * renderer.zoom;
  renderer.cameraY = sy - wy * renderer.zoom;
  syncZoomSlider();
  schedulePaint();
}, { passive: false });
;

/**
 * 本局的開局局面（打亂後起了個頭的那個狀態）——歷史第 0 條快照就是它，
 * 因為 CommandBus.shuffle / reset 都會重開歷史。成績記下來，日後才能在面板裡回看。
 * 拿不到就回 undefined（舊記錄沒有 initial 欄位，面板已有對應的提示）。
 */
function raceInitialBlocks(): [number, number][] | undefined {
  const all = store.cmd.history.snapshotAll();
  return all.length ? all[0].blocks : undefined;
}

// 供成績面板與 DNF
function recordDnf(): void {
  if (gameMode !== 'timed' || timer.state !== 'running') return;
  timer.dnf();
  records.add(
    store.currentM, store.currentN, store.currentStep, Math.round(timer.elapsedMs),
    store.cmd.stepCount, true, store.numbered, raceInitialBlocks(),
  );
  // 對照原版 macro_notify_msg：DNF（用時） | 最好 x | Ao5 y——順便讓玩家確認「這筆計進去了」
  const st = stats(records.get(store.puzzleKey));
  const fmtStat = (v: number | 'DNF' | null): string => (v === null ? '-' : v === 'DNF' ? 'DNF' : formatTime(v));
  showToast(`DNF（${formatTime(Math.round(timer.elapsedMs))}） | 最好 ${fmtStat(st.best)} | Ao5 ${fmtStat(st.ao5)}`);
  refreshRecordsPanel();
  schedulePaint();
}

/**
 * 計時區點擊（對照原版狀態欄 _timer_bar_rect 點擊 = 按空格）：競速下
 * 就緒→開始、計時中→放棄(DNF)。手機沒有實體空格鍵，點擊是那裡唯一的 DNF 入口。
 */
function onTimerBarClick(): void {
  if (gameMode !== 'timed') return;
  if (timer.state === 'idle') showToast('请先使用打乱功能');
  else if (timer.state === 'ready') { timer.start(); showToast('计时开始'); schedulePaint(); }
  else if (timer.state === 'running') recordDnf();
}

// 右側開關狀態
let selectionAnimationEnabled = true;
// 對照原版 show_records_panel = True（默認顯示）：桌面端（>=640px）默認展開成績面板，
// 手機/窄屏默認收起避免擋住棋盤（與右欄堆叠同閾值 innerWidth<640）。已存偏好優先。
let recordsVisible = typeof window !== 'undefined' && window.innerWidth >= 640;
// 控制模式
let singleTouch = true;
let twoTouch = true;
let keyboardMouse = true;

// ---------- 右側面板開關 ----------
type SwitchState = { key: string; label: string; get: () => boolean; set: (v: boolean) => void; el?: HTMLDivElement; touchOnly?: boolean };
const switchStates: SwitchState[] = [
  { key: 'animation_enabled', label: '滑动动画', get: () => controller.animationEnabled, set: (v) => { controller.animationEnabled = v; } },
  { key: 'selection_animation_enabled', label: '选中动画', get: () => selectionAnimationEnabled, set: (v) => { selectionAnimationEnabled = v; } },
  { key: 'coloring_enabled', label: '着色', get: () => renderer.coloringEnabled, set: (v) => { renderer.coloringEnabled = v; schedulePaint(); } },
  { key: 'chain_hint_enabled', label: '连锁', get: () => renderer.chainHintEnabled, set: (v) => { renderer.chainHintEnabled = v; schedulePaint(); } },
  { key: 'arrows_enabled', label: '箭头', get: () => renderer.arrowEnabled, set: (v) => { renderer.arrowEnabled = v; schedulePaint(); } },
  // 棋盤標記（原版 board_marks_enabled）：目標框 + 洞/缺口/凸起記號。
  // 與原版 F2 調試面板是兩個獨立開關——面板本體未移植（體驗版不需要），
  // 但標記屬於視覺強化，單獨可用。
  { key: 'board_marks_enabled', label: '标记', get: () => renderer.boardMarksEnabled, set: (v) => { renderer.boardMarksEnabled = v; schedulePaint(); } },
  // 虛擬鼠標（手機端）：把觸屏手指位置當作 hover 源 + 畫跟隨圓點，讓連鎖等
  // 依賴鼠標位置的功能在觸屏可用。電腦端（hover 設備）不需要也不顯示。
  { key: 'show_virtual_mouse', label: '虚拟鼠标', touchOnly: true, get: () => renderer.showVirtualMouse, set: (v) => { renderer.showVirtualMouse = v; if (!v) { renderer.virtualPointer = null; renderer.hoverCell = null; } schedulePaint(); } },
  { key: 'game_mode', label: '模式', get: () => gameMode === 'timed', set: (v) => { if (timer.state === 'running') { showToast('计时中无法切换模式'); return; } gameMode = v ? 'timed' : 'practice'; timer.cancel(); showToast(v ? '计时模式：打乱后需按空格开始' : '练习模式：可自由滑动，不计时'); schedulePaint(); } },
  // 對照原版右欄：滑動動畫/選中動畫/著色/連鎖/標記/模式/成績。
  // 網頁版多一個「箭頭」（復刻原版箭頭按鍵）；「成績」對應成績面板開關。
  { key: 'records_visible', label: '成绩', get: () => recordsVisible, set: (v) => { recordsVisible = v; recordsPanel.style.display = v ? '' : 'none'; if (v) renderRecordsPanel(); syncSwitches(); saveUiPrefs(); } },
];

function renderSwitch(s: SwitchState): void {
  if (!s.el) return;
  const on = s.get();
  s.el.style.background = on ? COLORS.button_bg : COLORS.input_bg;
  s.el.style.color = on ? '#fff' : '#969696';
  const text = s.key === 'game_mode' ? `模式:${on ? '竞速' : '练习'}` : `${s.label}:${on ? '开' : '关'}`;
  s.el.textContent = text;
}

/** 開關被外部（選單等）改動後，統一刷新右欄顯示 */
function syncSwitches(): void {
  switchStates.forEach(renderSwitch);
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
  // 豎屏時面板改成底部橫條：開關要固定寬度才排得整齊（flex 預設會被擠扁）
  el.style.flex = '0 0 auto';
  el.style.minWidth = '62px';
  el.style.padding = '0 6px';
  s.el = el;
  renderSwitch(s);
  el.addEventListener('click', () => { s.set(!s.get()); renderSwitch(s); });
  // 觸屏專屬開關（如虛擬鼠標）在電腦端不顯示——電腦沒有 touch 事件去驅動它
  if (s.touchOnly && !isTouchDevice) return;
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

/** 兩條滑條的容器（豎屏改底部橫條時要一起收窄，故記下來） */
const sliderWraps: HTMLElement[] = [];

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
  sliderWraps.push(wrap);

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
  renderer.zoom = Math.max(0.1, Math.min(4, 0.1 + ratio * 3.9));
  centerCamera();
  syncZoomSlider();
  schedulePaint();
});
const speedSlider = makeSlider('速度', (ratio) => {
  controller.moveDurationMs = Math.max(60, Math.min(800, 800 - ratio * 740));
  schedulePaint();
});

syncZoomSlider = () => {
  const ratio = Math.max(0, Math.min(1, (renderer.zoom - 0.1) / 3.9));
  const rect = zoomSlider.track.getBoundingClientRect();
  if (rect.height > 0) {
    zoomSlider.knob.style.top = `${(1 - ratio) * rect.height - 6}px`;
  }
};

// 速度滑條旋鈕同步（與縮放條同一套機制；onChange 為 800 - ratio*740，反解得 ratio）
let syncSpeedSlider: () => void = () => {};
syncSpeedSlider = () => {
  const ratio = Math.max(0, Math.min(1, (800 - controller.moveDurationMs) / 740));
  const rect = speedSlider.track.getBoundingClientRect();
  if (rect.height > 0) {
    speedSlider.knob.style.top = `${(1 - ratio) * rect.height - 6}px`;
  }
};

// 啟動時把旋鈕同步到當前值（修復 bug：初始縮放 100%，旋鈕卻停在頂端=400%）。
// knob 建立時沒有初始 top（默認停在 track 頂端），此前僅在滾輪/拖動/捏合時同步。
// 立即同步一次；若此刻面板尚未完成布局（height=0 被守衛跳過），下一幀再補一次。
syncZoomSlider();
syncSpeedSlider();
requestAnimationFrame(() => { syncZoomSlider(); syncSpeedSlider(); });

// ---------- 虛擬鍵盤浮動面板 ----------
/**
 * 粘滯連播（原版 `_toggle_continuous`）。開關語義：再按一次同一顆鍵就停。
 *
 * 舊實作是 `setInterval` 一路跑到不能再撤銷為止，中途**沒有任何停法**
 * （連把粘滯關掉也停不下來）。現改成狀態機（feature/virtualKeyboard.ts）。
 */
const stickyPlayer = new StickyPlayer(
  (kind) => { if (kind === 'undo') handleUndo(); else handleRedo(); },
  (kind) => (kind === 'undo' ? store.cmd.history.canUndo : store.cmd.history.canRedo),
);

/** 拖過面板就別再用默認位置，免得每次開關都跳回原處 */
let vkMoved = false;
/** 面板尺寸隨方向鍵行數定，網頁版恆為矩形形態 */
const vkViewport = (): VkViewport => ({ width: window.innerWidth, height: window.innerHeight });
/**
 * 面板不得壓住上一層選單列與下一層狀態列。
 * 上界用選單欄**實際底邊**（safe-area 上內邊距會讓它 != menu_bar_height）。
 */
const vkChrome = (): VkChrome => ({
  top: menuBar.offsetTop + menuBar.offsetHeight,
  bottom: GEOMETRY.status_bar_height,
});

function buildVK(): void {
  vkBody.innerHTML = '';
  const btn = (t: string, cb: () => void, w?: number, h?: number) => {
    const b = document.createElement('button');
    b.textContent = t;
    b.style.background = COLORS.button_bg;
    b.style.color = '#fff';
    b.style.border = 'none';
    b.style.borderRadius = '4px';
    b.style.padding = '0';
    b.style.cursor = 'pointer';
    b.style.fontSize = '13px';
    b.style.fontFamily = 'inherit';
    b.style.fontWeight = 'normal';
    b.style.flex = '0 0 auto';
    if (w !== undefined) b.style.width = `${w}px`;
    if (h !== undefined) b.style.height = `${h}px`;
    b.addEventListener('click', cb);
    return b;
  };

  // 方向鍵區（原版十字排列：上 / 左下右；44×44、間距 6）
  const pad = document.createElement('div');
  pad.style.display = 'grid';
  pad.style.gridTemplateColumns = `repeat(3, ${VK.btn}px)`;
  pad.style.gap = `${VK.btn_gap}px`;
  pad.style.justifyContent = 'center';
  const padEmpty = document.createElement('span');
  padEmpty.textContent = '';
  pad.appendChild(padEmpty);
  pad.appendChild(btn('↑', () => controller.move('w'), VK.btn, VK.btn));
  pad.appendChild(padEmpty.cloneNode(false));
  pad.appendChild(btn('←', () => controller.move('a'), VK.btn, VK.btn));
  pad.appendChild(btn('↓', () => controller.move('s'), VK.btn, VK.btn));
  pad.appendChild(btn('→', () => controller.move('d'), VK.btn, VK.btn));

  // 動作列（粘滞 / 撤銷 / 重做）：尺寸對齊原版 54 / 62 / 62 × 32
  const actionRow = document.createElement('div');
  actionRow.style.display = 'flex';
  actionRow.style.gap = `${VK.btn_gap}px`;
  actionRow.style.marginTop = '6px';
  actionRow.style.justifyContent = 'center';
  const stickyBtn = btn('粘滞关', () => {
    const on = stickyPlayer.toggleSticky();
    syncStickyBtn();
    showToast(on ? '粘滞：连续' : '粘滞：单步');
  }, VK.sticky_w, VK.action_btn_h);
  /** 原版：粘滯開啟時按鈕套一圈黃框（255,205,60），一眼看出「現在是連播」 */
  function syncStickyBtn(): void {
    const on = stickyPlayer.sticky;
    stickyBtn.textContent = on ? '粘滞开' : '粘滞关';
    stickyBtn.style.border = on ? '2px solid rgb(255,205,60)' : 'none';
  }
  syncStickyBtn();
  const undoBtn = btn('撤销', () => { stickyPlayer.press('undo'); }, VK.action_btn_w, VK.action_btn_h);
  const redoBtn = btn('重做', () => { stickyPlayer.press('redo'); }, VK.action_btn_w, VK.action_btn_h);
  actionRow.append(stickyBtn, undoBtn, redoBtn);

  // 跳到某步（輸入步數 + 跳到）：原版超範圍不是報錯，而是夾到最後一步並說跳到哪
  const jumpRow = document.createElement('div');
  jumpRow.style.display = 'flex';
  jumpRow.style.gap = `${VK.btn_gap}px`;
  jumpRow.style.marginTop = '6px';
  jumpRow.style.justifyContent = 'center';
  const jumpInput = document.createElement('input');
  jumpInput.type = 'number';
  jumpInput.min = '0';
  jumpInput.value = String(store.cmd.stepCount);
  jumpInput.style.width = `${VK.jump_input_w}px`;
  jumpInput.style.height = `${VK.jump_h}px`;
  jumpInput.style.background = COLORS.input_bg;
  jumpInput.style.color = COLORS.input_text;
  jumpInput.style.border = '1px solid ' + COLORS.border;
  jumpInput.style.borderRadius = '4px';
  jumpInput.style.padding = '0 4px';
  jumpInput.style.boxSizing = 'border-box';
  const jumpBtn = btn('跳到', () => {
    const res = resolveJumpTarget(jumpInput.value, store.cmd.history.length);
    if (!res.ok) { if (res.message) showToast(res.message); return; }
    if (store.cmd.history.jumpTo(store.game, res.target)) {
      store.cmd.stepCount = res.target;
      autosave(store);
      schedulePaint();
      showToast(res.message);
    } else showToast('步数超出范围');
  }, VK.jump_btn_w, VK.jump_h);
  jumpRow.append(jumpInput, jumpBtn);

  vkBody.append(pad, actionRow, jumpRow);
}

function toggleVK(force?: boolean): void {
  const willShow = force ?? vkPanel.style.display === 'none';
  vkPanel.style.display = willShow ? '' : 'none';
  if (willShow) {
    buildVK();
    if (!vkMoved) {
      // 原版默認在右上角（screen_width - 200, menu_bar_height + 60）
      const p = vkDefaultPosition(vkViewport(), vkChrome());
      vkPanel.style.left = `${p.x}px`;
      vkPanel.style.top = `${p.y}px`;
    }
  } else {
    stickyPlayer.stop(); // 關面板就別讓連播繼續跑
  }
  saveUiPrefs();
  if (force === undefined) showToast(willShow ? '已开启虚拟键盘' : '已关闭虚拟键盘');
}

// ---------- 常駐撤銷／重做條（缺陷清單第 13 項） ----------
/**
 * 撤銷/重做「必須調出虛擬鍵盤才點得到」是手機端最大的不方便：面板默認收著，
 * 而這兩個動作又是玩錯一步就想按的。故另做一條常駐的，與虛擬鍵盤互不干涉。
 *
 * 放在底部狀態列上方左側——右下角要留給 toast，正上方要留給新手引導條，
 * 引導條出現時這條會自動上移讓位（見 syncQuickBarBottom）。
 */
const quickBar = document.createElement('div');
quickBar.style.position = 'fixed';
quickBar.style.left = '12px';
quickBar.style.bottom = `${GEOMETRY.status_bar_height + 12}px`;
quickBar.style.display = 'flex';
quickBar.style.gap = '8px';
quickBar.style.zIndex = '900';

function quickButton(text: string, cb: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.style.minWidth = '62px';
  // 38px 高：手機上單手拇指夠得著，又不像 44px 那樣吃掉太多棋盤
  b.style.height = '38px';
  b.style.padding = '0 10px';
  b.style.background = COLORS.button_bg;
  b.style.color = '#fff';
  b.style.border = 'none';
  b.style.borderRadius = '6px';
  b.style.cursor = 'pointer';
  b.style.fontSize = '14px';
  b.style.fontFamily = 'inherit';
  b.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
  b.addEventListener('click', cb);
  return b;
}
const undoQuick = quickButton('↶ 撤销', () => handleUndo());
const redoQuick = quickButton('↷ 重做', () => handleRedo());
quickBar.append(undoQuick, redoQuick);
app.appendChild(quickBar);

// ---------- 橫屏提示（手機專項第 10 項） ----------
/**
 * 豎屏下的棋盤是又窄又高，滑塊被擠成小方塊、手指還容易誤觸，所以明示建議橫屏。
 * 只對「觸屏 + 豎屏 + 窄」的裝置提示（桌機視窗拉窄不代表手機，別去煩桌機使用者）；
 * 按「知道了」就不再出現（記進 localStorage），但換成更窄的裝置仍會再提示一次。
 */
const ROTATE_HINT_KEY = 'gatennea.rotateHint';
const rotateBar = document.createElement('div');
rotateBar.style.position = 'fixed';
rotateBar.style.left = '50%';
rotateBar.style.transform = 'translateX(-50%)';
rotateBar.style.top = '0';
rotateBar.style.display = 'none';
rotateBar.style.alignItems = 'center';
rotateBar.style.gap = '10px';
rotateBar.style.maxWidth = 'calc(100vw - 24px)';
rotateBar.style.background = 'rgba(40,40,48,0.96)';
rotateBar.style.border = `1px solid ${COLORS.dialog_border}`;
rotateBar.style.borderRadius = '0 0 8px 8px';
rotateBar.style.padding = '6px 12px';
rotateBar.style.color = COLORS.dialog_text;
rotateBar.style.fontSize = '12px';
rotateBar.style.zIndex = '950';
rotateBar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.45)';
const rotateText = document.createElement('span');
rotateText.textContent = '建议横屏游玩：竖屏下棋盘会被压窄';
const rotateOk = document.createElement('span');
rotateOk.textContent = '知道了';
rotateOk.style.cursor = 'pointer';
rotateOk.style.color = BRAND_COLOR;
rotateOk.style.whiteSpace = 'nowrap';
rotateOk.addEventListener('click', () => {
  try { localStorage.setItem(ROTATE_HINT_KEY, '1'); } catch { /* 隱私模式：只是下次再提示 */ }
  rotateBar.style.display = 'none';
});
rotateBar.append(rotateText, rotateOk);
app.appendChild(rotateBar);

function syncRotateHint(): void {
  if (rotateBar.dataset['dismissed'] === '1') return;
  let dismissed = false;
  try { dismissed = localStorage.getItem(ROTATE_HINT_KEY) === '1'; } catch { dismissed = false; }
  const touch = typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
  const portrait = window.innerHeight > window.innerWidth;
  rotateBar.style.display = (touch && portrait && window.innerWidth < 640 && !dismissed)
    ? 'flex' : 'none';
  rotateBar.dataset['dismissed'] = dismissed ? '1' : '0';
}

/** 新手引導條與這條都在底部，引導出現時把這條抬上去，免得疊在一起 */
function syncQuickBarBottom(): void {
  const raised = tutorialBar.style.display !== 'none';
  quickBar.style.bottom = `${GEOMETRY.status_bar_height + (raised ? 62 : 12)}px`;
}

// ---------- 版本公告（更新預告，第 9 項） ----------
const CHANGELOG_SEEN_KEY = 'gatennea.changelogSeen';

/**
 * 新版本第一次打開時彈一次這版改了什麼；看過就記起來，不再打擾。
 * @param force true = 從選單主動點開（不論看過與否都顯示）
 */
function showChangelog(force = false): void {
  const entry = entryFor(APP_VERSION);
  if (!entry) {
    if (force) showToast('这一版没有写更新要点');
    return;
  }
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
  box.style.padding = '16px';
  box.style.width = 'min(400px, 90vw)';
  box.style.maxHeight = '80vh';
  box.style.overflowY = 'auto';
  box.style.color = COLORS.dialog_text;
  box.style.fontSize = '13px';
  box.addEventListener('click', (e) => e.stopPropagation());

  const title = document.createElement('div');
  title.textContent = `本次更新（${entry.date}）`;
  title.style.fontWeight = 'bold';
  title.style.color = COLORS.dialog_title;
  title.style.marginBottom = '10px';
  box.appendChild(title);

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';
  list.style.lineHeight = '1.5';
  for (const it of entry.items) {
    const row = document.createElement('div');
    row.textContent = `· ${it}`;
    list.appendChild(row);
  }
  box.appendChild(list);

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.marginTop = '14px';
  const full = document.createElement('button');
  full.textContent = '查看完整更新日志';
  full.style.background = COLORS.button_bg;
  full.style.color = '#fff';
  full.style.border = 'none';
  full.style.borderRadius = '4px';
  full.style.padding = '6px 12px';
  full.style.cursor = 'pointer';
  full.style.fontSize = '12px';
  full.style.fontFamily = 'inherit';
  full.addEventListener('click', () => { window.open('update_info.html', '_blank', 'noopener'); });
  const ok = document.createElement('button');
  ok.textContent = '知道了';
  ok.style.background = COLORS.input_bg;
  ok.style.color = '#fff';
  ok.style.border = `1px solid ${COLORS.border}`;
  ok.style.borderRadius = '4px';
  ok.style.padding = '6px 12px';
  ok.style.cursor = 'pointer';
  ok.style.fontSize = '12px';
  ok.style.fontFamily = 'inherit';
  ok.style.marginLeft = 'auto';
  ok.addEventListener('click', () => overlay.remove());
  row.append(full, ok);
  box.appendChild(row);

  overlay.appendChild(box);
  app.appendChild(overlay);
  markChangelogSeen();
}

function markChangelogSeen(): void {
  try { localStorage.setItem(CHANGELOG_SEEN_KEY, APP_VERSION); } catch {
    // 隱私模式寫不進：只影響「下次還會再彈一次」
  }
}

/**
 * 本次啟動是否壓掉更新公告：演示模式與「第一次來先看教程」都設它，
 * 免得教程選關和公告兩個框疊在一起（公告仍算沒看過，下次再彈）。
 */
let suppressChangelogOnce = false;

/** 啟動時檢查：這一版沒看過就彈一次 */
function maybeShowChangelogOnBoot(): void {
  if (suppressChangelogOnce) return;
  let seen: string | null = null;
  try { seen = localStorage.getItem(CHANGELOG_SEEN_KEY); } catch { seen = null; }
  if (shouldShowChangelog(seen)) showChangelog();
}

// ---------- 介面偏好（虛擬鍵盤開關與位置） ----------
const UI_PREFS_KEY = 'gatennea.ui.v1';

function saveUiPrefs(): void {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
      vk: vkPanel.style.display !== 'none',
      vkPos: { x: vkPanel.offsetLeft, y: vkPanel.offsetTop },
      // 成績面板顯隱也記：玩家關掉就別下次又彈出來
      records: recordsVisible,
      // 控制方式開關也一起記：玩家關掉某種操作方式，通常是不想再見到它
      ctrl: {
        single: singleTouch, two: twoTouch, kb: keyboardMouse, arrows: renderer.arrowEnabled,
      },
    }));
  } catch {
    // 隱私模式寫不進 localStorage：只影響「下次還開著」，不影響遊戲
  }
}

/**
 * 讀回上次的開關與位置。
 *
 * 沒存過時：觸屏設備默認**開**（對照原版 `show_virtual_keyboard = True`，
 * 且手機沒有實體方向鍵，不開就沒法走）；桌面默認關，免得一上來就擋住棋盤。
 */
function loadUiPrefs(): void {
  let saved: {
    vk?: boolean;
    vkPos?: { x: number; y: number };
    records?: boolean;
    ctrl?: { single?: boolean; two?: boolean; kb?: boolean; arrows?: boolean };
  } | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(UI_PREFS_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  const c = saved?.ctrl;
  // 成績面板顯隱：已存過就尊重上次（否則用桌面/手機的默認判斷）
  if (typeof saved?.records === 'boolean') recordsVisible = saved.records;
  if (c) {
    if (typeof c.single === 'boolean') singleTouch = c.single;
    if (typeof c.two === 'boolean') twoTouch = c.two;
    if (typeof c.kb === 'boolean') keyboardMouse = c.kb;
    controller.singleTouchEnabled = singleTouch;
    controller.twoTouchEnabled = twoTouch;
    controller.keyboardMouseEnabled = keyboardMouse;
    if (typeof c.arrows === 'boolean') renderer.arrowEnabled = c.arrows;
    syncSwitches();
  }
  if (saved?.vkPos) {
    vkPanel.style.left = `${saved.vkPos.x}px`;
    vkPanel.style.top = `${saved.vkPos.y}px`;
    vkMoved = true; // 有存過位置就別再用默認角，尊重玩家上次擺的地方
  }
  const touch = typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
  const show = saved?.vk ?? touch;
  if (show) toggleVK(true);
}

// ---------- 成績面板 ----------
/** 面板展開哪一條 / 哪一條正在等待「再點一次確認刪除」 */
let recordsDetailId: string | null = null;
let recordsPendingDeleteId: string | null = null;
/** 換了謎題分組就收起展開與待確認狀態，免得殘留指向別組的 id */
let recordsRenderedKey: string | null = null;

function renderRecordsPanel(): void {
  const key = store.puzzleKey;
  if (recordsRenderedKey !== key) {
    recordsDetailId = null;
    recordsPendingDeleteId = null;
    recordsRenderedKey = key;
  }
  const list = records.get(key);
  const s = stats(list);
  const rows = series(list);
  recordsBody.innerHTML = '';

  const fmt = (v: number | 'DNF' | null) => v === null ? '-' : v === 'DNF' ? 'DNF' : formatTime(v);

  // 各列「最好/最差」：原版 _rp_value_style——最好標綠、最差標紅（DNF 按最差計）。
  const validTimes = rows.filter((r) => !r.item.dnf).map((r) => r.item.time_ms);
  const bestT = validTimes.length ? Math.min(...validTimes) : null;
  const worstT = validTimes.length ? Math.max(...validTimes) : null;
  const a5nums = rows.map((r) => r.ao5).filter((v): v is number => typeof v === 'number');
  const bestA5 = a5nums.length ? Math.min(...a5nums) : null;
  const worstA5 = a5nums.length ? Math.max(...a5nums) : null;
  const a12nums = rows.map((r) => r.ao12).filter((v): v is number => typeof v === 'number');
  const bestA12 = a12nums.length ? Math.min(...a12nums) : null;
  const worstA12 = a12nums.length ? Math.max(...a12nums) : null;
  const bestAo5Overall = bestA5; // 摘要「平均最好」= 整組 Ao5 最小值（同原版）

  function cellColor(val: number | 'DNF' | null, best: number | null, worst: number | null, dnf: boolean): string {
    if (val === 'DNF' || dnf) return '#cc6666';
    if (typeof val === 'number') {
      if (best !== null && val === best) return '#78d878';
      if (worst !== null && val === worst) return '#ff6b6b';
    }
    return '#d2d2d2';
  }

  const title = document.createElement('div');
  title.textContent = key;
  title.style.fontSize = '13px';
  title.style.color = COLORS.dialog_title;
  title.style.marginBottom = '4px';
  recordsBody.appendChild(title);

  // 摘要（對照原版 records_panel.py）：第一行「共 N 次」，第二行 單次最好(綠)/平均最好(綠)/總平均
  const sum = document.createElement('div');
  sum.style.lineHeight = '1.7';
  sum.style.marginBottom = '6px';
  sum.innerHTML =
    `<span style="color:#aac8ff">共 ${s.count} 次</span><br>`
    + `<span style="color:#78d878">单次最好 ${fmt(s.best)}</span>　`
    + `<span style="color:#78d878">平均最好 ${fmt(bestAo5Overall)}</span>　`
    + `<span style="color:#d2d2d2">总平均 ${fmt(s.mean)}</span>`;
  recordsBody.appendChild(sum);

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#888';
    empty.textContent = '暂无成绩';
    recordsBody.appendChild(empty);
    return;
  }

  // 表頭（原版「序号 / 单次 / Ao5 / Ao12」，右側留刪除列）
  const head = document.createElement('div');
  head.style.display = 'flex';
  head.style.alignItems = 'center';
  head.style.fontSize = '11px';
  head.style.color = '#888';
  head.style.paddingBottom = '2px';
  head.style.borderBottom = `1px solid ${COLORS.separator}`;
  head.innerHTML =
    '<span style="width:28px">#</span>'
    + '<span style="width:74px">单次</span>'
    + '<span style="width:74px">Ao5</span>'
    + '<span style="width:74px">Ao12</span>'
    + '<span style="flex:1"></span>'
    + '<span style="width:24px"></span>';
  recordsBody.appendChild(head);

  rows
    .map((row, i) => ({ row, i }))
    .reverse()
    .forEach(({ row, i }) => {
      const line = document.createElement('div');
      line.style.borderBottom = `1px solid ${COLORS.separator}`;
      recordsBody.appendChild(line);

      const main = document.createElement('div');
      main.style.display = 'flex';
      main.style.alignItems = 'center';
      main.style.padding = '3px 0';
      main.style.cursor = 'pointer';
      // 顯式建元素而不是 innerHTML + querySelectorAll：著色要持有引用，
      // 且拼字符串再解析的寫法在 DOM stub 環境裡根本觸及不到（冒煙測不到這行）。
      const cell = (text: string, width?: string, color?: string): HTMLSpanElement => {
        const s = document.createElement('span');
        s.textContent = text;
        if (width) s.style.width = width;
        if (color) s.style.color = color;
        return s;
      };
      main.append(
        cell(String(i + 1), '28px', '#888'),
        cell(row.item.dnf ? 'DNF' : formatTime(row.item.time_ms), '74px',
          cellColor(row.item.dnf ? 'DNF' : row.item.time_ms, bestT, worstT, row.item.dnf)),
        cell(fmt(row.ao5), '74px', cellColor(row.ao5, bestA5, worstA5, row.item.dnf)),
        cell(fmt(row.ao12), '74px', cellColor(row.ao12, bestA12, worstA12, row.item.dnf)),
      );
      const spacer = cell('');
      spacer.style.flex = '1'; // 右側留白，把刪除列頂到最右（對照原版）
      main.appendChild(spacer);
      if (recordsDetailId === row.item.id) main.style.background = 'rgba(62,82,118,0.55)';
      recordsBody.appendChild(main);

      // 展開詳情：對照原版「點擊行顯示初始局面 / 生成時間 / 步數 / TPS」+ 初始局面矩陣操作菜單
      if (recordsDetailId === row.item.id) {
        const detail = document.createElement('div');
        detail.style.padding = '6px 0 8px 8px';
        detail.style.fontSize = '11px';
        detail.style.lineHeight = '1.7';
        const t = new Date(row.item.ts);
        const pad = (v: number) => String(v).padStart(2, '0');
        const when = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} `
          + `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
        const meta = document.createElement('div');
        meta.textContent =
          `时间 ${formatTime(row.item.time_ms)} ｜ ${row.item.moves} 步 ｜ TPS ${tpsOf(row.item).toFixed(2)}`;
        detail.appendChild(meta);
        const whenRow = document.createElement('div');
        whenRow.textContent = `成绩生成时间 ${when}`;
        whenRow.style.color = '#9a9a9a';
        detail.appendChild(whenRow);
        // 操作按鈕：對照原版「點擊初始局面矩陣」彈出的 複製/另存為存檔/載入練習；
        // 網頁版做得到的是 複製初始局面 / 載入練習（另存為存檔屬檔案系統差異，暫不移植）。
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '10px';
        btnRow.style.marginTop = '4px';
        const copyBtn = document.createElement('span');
        copyBtn.textContent = '复制初始局面';
        copyBtn.style.cursor = 'pointer';
        copyBtn.style.color = '#7fb3ff';
        copyBtn.addEventListener('click', (e) => { e.stopPropagation(); copyInitial(row.item); });
        const loadBtn = document.createElement('span');
        loadBtn.textContent = '载入练习';
        loadBtn.style.cursor = 'pointer';
        loadBtn.style.color = '#7fb3ff';
        loadBtn.addEventListener('click', (e) => { e.stopPropagation(); loadPractice(row.item); });
        btnRow.append(copyBtn, loadBtn);
        detail.appendChild(btnRow);
        if (row.item.initial && row.item.initial.length) {
          const map = document.createElement('div');
          map.style.fontFamily = 'Consolas, Menlo, monospace';
          map.style.fontSize = '9px';
          map.style.lineHeight = '1.05';
          map.style.marginTop = '4px';
          map.textContent = blocksToMap(row.item.initial).join('\n');
          map.style.whiteSpace = 'pre';
          detail.appendChild(map);
        } else {
          const noInit = document.createElement('div');
          noInit.style.color = '#777';
          noInit.textContent = '（这筆没有记到开局局面，旧版记录才会这样）';
          detail.appendChild(noInit);
        }
        recordsBody.appendChild(detail);
      }

      // 行內刪除按鈕（× → 確認?，對照原版行尾的 × / 確認?）
      const del = document.createElement('span');
      del.style.cursor = 'pointer';
      del.style.width = '24px';
      del.style.textAlign = 'center';
      del.style.fontSize = '14px';
      const pending = recordsPendingDeleteId === row.item.id;
      del.textContent = pending ? '确认?' : '×';
      del.style.color = pending ? '#ff6b6b' : '#888';
      del.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (recordsPendingDeleteId !== row.item.id) {
          recordsPendingDeleteId = row.item.id;
          renderRecordsPanel();
          return;
        }
        records.delete(key, row.item.id);
        if (recordsDetailId === row.item.id) recordsDetailId = null;
        recordsPendingDeleteId = null;
        renderRecordsPanel();
      });
      main.appendChild(del);

      main.addEventListener('click', () => {
        recordsDetailId = recordsDetailId === row.item.id ? null : row.item.id;
        recordsPendingDeleteId = null;
        renderRecordsPanel();
      });
    });
}

function toggleRecords(): void {
  const vis = !recordsVisible;
  recordsVisible = vis;
  recordsPanel.style.display = vis ? '' : 'none';
  if (vis) renderRecordsPanel();
  syncSwitches();
  saveUiPrefs();
  showToast(vis ? '已开启成绩面板' : '已关闭成绩面板');
}

/**
 * 寫入成績後刷新面板。
 * 桌面端默認展開成績面板，而入庫後不重畫的話，新的一條（含 DNF）要等手動開關
 * 面板才看得見——原版每幀從頭重畫故無此問題，網頁版是 DOM 面板，必須顯式刷新。
 */
function refreshRecordsPanel(): void {
  if (recordsVisible) renderRecordsPanel();
}

/** 詳情操作：複製該筆開局局面為文本（對照原版「複製到剪貼板」）。 */
function copyInitial(item: RecordItem): void {
  const text = blocksToMap(item.initial ?? []).join('\n');
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => showToast('已复制初始局面'),
      () => showToast('复制失败（剪贴板不可用）'),
    );
  } else {
    showToast('当前环境不支持复制');
  }
}

/** 詳情操作：把該筆開局局面載入為練習謎題（對照原版「載入練習模式」）。 */
function loadPractice(item: RecordItem): void {
  if (timer.state === 'running') { showToast('计时中无法载入'); return; }
  if (!item.initial || !item.initial.length) { showToast('这筆没有记到开局局面'); return; }
  store.applyPuzzle(item.m, item.n, item.step, item.initial);
  setGameMode('practice');
  renderer.animation = null;
  centerCamera();
  autosave(store);
  schedulePaint();
  showToast('已载入练习模式，可开始复原');
  renderRecordsPanel();
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

function blocksAtPositions(positions: [number, number][]): Set<Block> {
  const map = new Map<string, Block>();
  store.game.blocks.forEach((b) => map.set(`${b.row}:${b.col}`, b));
  const set = new Set<Block>();
  for (const pos of positions) {
    const b = map.get(`${pos[0]}:${pos[1]}`);
    if (b) set.add(b);
  }
  return set;
}

function flashMoveSelection(moveInfo: { direction: string; step: number; moved_positions: [number, number][]; gap_type?: 'h' | 'v'; gap_line?: number } | null | undefined, isUndo: boolean, afterCommit: boolean): void {
  if (!selectionAnimationEnabled || !moveInfo) return;
  const delta = DIR_DELTA_ANIM[moveInfo.direction];
  if (!delta) return;
  const step = moveInfo.step || store.currentStep;
  const targets: [number, number][] = [];
  for (const pre of moveInfo.moved_positions) {
    const post: [number, number] = [pre[0] + delta[0] * step, pre[1] + delta[1] * step];
    const pos = afterCommit ? (isUndo ? pre : post) : (isUndo ? post : pre);
    targets.push(pos);
  }
  const sel = blocksAtPositions(targets);
  if (sel.size === 0) return;
  store.game.selected = sel;
  // 選中動畫也要顯示該步選中的縫隙（紅線），對照原版 _flash_move_selection
  if (moveInfo.gap_type !== undefined && moveInfo.gap_line !== undefined) {
    store.cmd.selectedGap = { type: moveInfo.gap_type, line: moveInfo.gap_line };
  }
  window.setTimeout(() => {
    store.game.selected.clear();
    store.cmd.selectedGap = null;
    schedulePaint();
  }, 420);
}

// 撤銷/重做動畫佇列（對照原版 _animation_queue + _process_next_in_queue）
const historyAnimQueue: ('undo' | 'redo')[] = [];
let historyAnimBusy = false;

function requestHistoryStep(kind: 'undo' | 'redo'): void {
  const hist = store.cmd.history;
  if (kind === 'undo' && !hist.canUndo) { showToast('没有可撤销的步骤'); return; }
  if (kind === 'redo' && !hist.canRedo) { showToast('没有可重做的步骤'); return; }
  // 拖拽跟隨與過場動畫互斥：先撤掉實時預覽，避免松手時按陳舊偏移誤提交（缺陷 18）
  controller.cancelFollow();
  historyAnimQueue.push(kind);
  processHistoryQueue();
}

function processHistoryQueue(): void {
  if (historyAnimBusy || historyAnimQueue.length === 0) return;
  historyAnimBusy = true;
  const kind = historyAnimQueue.shift()!;
  runHistoryAnimation(kind, () => {
    historyAnimBusy = false;
    processHistoryQueue();
  });
}

function runHistoryAnimation(kind: 'undo' | 'redo', onDone: () => void): void {
  const hist = store.cmd.history;
  const moveInfo = kind === 'undo' ? hist.currentMoveInfo() : hist.nextMoveInfo();

  const commit = () => {
    const r = kind === 'undo' ? undo(store.cmd) : redo(store.cmd);
    if (!r.ok) { showToast(r.message); onDone(); return; }
    flashMoveSelection(moveInfo, kind === 'undo', true);
    autosave(store);
    // 對照原版：撤銷/重做實現的「過關」不彈復原懸浮窗
    maybeShowSolvedPopup(null, kind === 'redo' ? { viaRedo: true } : { viaUndo: true });
    schedulePaint();
    showToast(r.message);
    onDone();
  };

  if (!controller.animationEnabled) { commit(); return; }

  let anim = moveInfo ? buildHistoryAnim(moveInfo, kind === 'undo') : null;
  if (!anim) {
    const target = kind === 'undo' ? hist.undoTarget() : hist.redoTarget();
    if (target) {
      const start = store.game.blocks.map((b) => [b.row, b.col] as [number, number]);
      anim = { start, end: target.blocks };
    }
  }
  if (!anim) { commit(); return; }

  // 播放前：把該步滑塊組設為「選中」，動畫期間跟著移動（看起來像實時操作）
  if (moveInfo) {
    const delta = DIR_DELTA_ANIM[moveInfo.direction];
    const step = moveInfo.step || store.currentStep;
    const startPositions = kind === 'undo'
      ? moveInfo.moved_positions.map((pre) => [pre[0] + delta[0] * step, pre[1] + delta[1] * step] as [number, number])
      : moveInfo.moved_positions;
    store.game.selected = blocksAtPositions(startPositions);
    if (moveInfo.gap_type !== undefined && moveInfo.gap_line !== undefined) {
      store.cmd.selectedGap = { type: moveInfo.gap_type, line: moveInfo.gap_line };
    }
  }

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
  requestHistoryStep('undo');
  tutorial.onUndo();
}

function handleRedo(): void {
  requestHistoryStep('redo');
  tutorial.onRedo();
}

function handleShuffle(): void {
  if (gameMode === 'timed' && timer.state === 'running') { showToast('计时中无法打乱'); return; }
  controller.cancelFollow(); // 換了整局：拖拽跟隨的實時預畫沒有意義（缺陷 18）
  const r = shuffle(store.cmd, store.currentM * store.currentN * 10);
  showToast(r.message);
  stickyPlayer.stop(); // 換了整局，連播中的撤銷/重做沒有意義（原版換局也重置歷史）
  renderer.animation = null;
  store.solvedPopupTracker.reset(store.solved); // 打亂換了整局，同步過關基線
  centerCamera();
  autosave(store);
  if (gameMode === 'timed') timer.enterReady(); else timer.cancel();
  schedulePaint();
}

function handleReset(): void {
  if (gameMode === 'timed' && timer.state === 'running') { showToast('计时中无法重置'); return; }
  controller.cancelFollow(); // 回到初始態：跟隨預覽與目標局無關（缺陷 18）
  const r = reset(store.cmd);
  showToast(r.message);
  stickyPlayer.stop();
  renderer.animation = null;
  store.solvedPopupTracker.reset(store.solved); // 重設回到初始態，不算「過關」
  centerCamera();
  autosave(store);
  timer.cancel();
  schedulePaint();
}

function handleCustomPuzzle(): void {
  if (gameMode === 'timed' && timer.state === 'running') { showToast('计时中无法切换谜题'); return; }
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
  title.textContent = '自订谜题';
  title.style.marginBottom = '12px';
  title.style.fontWeight = 'bold';
  box.appendChild(title);

  const fields: [string, string][] = [
    ['列数 m', String(store.currentM)],
    ['行数 n', String(store.currentN)],
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
  ok.textContent = '确定';
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
    if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step)) { showToast('输入需为整数'); return; }
    if (step >= Math.max(m, n)) { showToast(`step 需 < max(m,n)=${Math.max(m, n)}`); return; }
    store.newPuzzle(m, n, step);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    timer.cancel();
    schedulePaint();
    showToast(`切换谜题 ${step}~${m}*${n}`);
    overlay.remove();
  });
  btnRow.append(cancel, ok);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  app.appendChild(overlay);
}

/**
 * 套用一個謎題檔位。改成直接傳 (m, n, step)，不再從選單標籤字串反解
 * ——對照原版後標籤改成了「4×4 等级2」這種人話，反解既脆也沒必要。
 */
function handlePresetPuzzle(m: number, n: number, step: number, numbered = store.numbered): void {
  if (gameMode === 'timed' && timer.state === 'running') { showToast('计时中无法切换谜题'); return; }
  store.newPuzzle(m, n, step, numbered);
  renderer.animation = null;
  centerCamera();
  autosave(store);
  timer.cancel();
  schedulePaint();
  showToast(`切换谜题 ${step}~${m}×${n}${numbered ? '（数字形态）' : ''}`);
}

/** 目前玩的檔位是不是這一個（選單上畫 ✓）。 */
function isCurrentPreset(p?: [number, number, number]): boolean {
  return !!p && p[0] === store.currentM && p[1] === store.currentN && p[2] === store.currentStep;
}

/** 底部狀態行與命令面板用的檔位名（「4×4 等级2」）。 */
function currentPuzzleLabel(): string {
  return `${store.currentM}×${store.currentN} 等级${store.currentStep}`;
}

function setGameMode(mode: 'practice' | 'timed' | 'creative'): void {
  if (mode !== 'practice' && timer.state === 'running') { showToast('计时中无法切换模式'); return; }
  // 離開創造模式時收起其面板
  if (mode !== 'creative') creative.exit();
  gameMode = mode;
  timer.cancel();
  if (mode === 'timed') showToast('计时模式：打乱后需按空格开始');
  else if (mode === 'creative') showToast('创造模式：生成谜题后自由还原');
  else showToast('练习模式：可自由滑动，不计时');
  schedulePaint();
}

// ---------- 下拉選單 ----------
/**
 * 選單項（對照原版 GUI.puzzle_presets 的幾種特殊條目）：
 *  - '---'      分隔線
 *  - 字串       體驗版可用的一般命令
 *  - pro:true   完整版專屬（灰色 + 角標）；href = 開外部網頁
 *  - group      分組標題：不可點、不隨懸停高亮（原版 `__group__`，menu_selected 色）
 *  - current    底部「当前：4×4 等级2」狀態行（原版 `__current__`）
 *  - preset     謎題檔位 [m, n, step]，與目前檔位相符時畫 ✓（原版 menu_selected + '✓'）
 *  - sub        二級子菜單 key：畫成「名字 ▸」，懸停/點擊展開（原版 `__sub__`）
 */
interface MenuItemDef {
  text?: string;
  pro?: boolean;
  href?: string;
  group?: string;
  current?: boolean;
  preset?: [number, number, number];
  numbered?: boolean;
  sub?: string;
}
type MenuEntry = '---' | string | MenuItemDef;
interface MenuDef { label: string; items: MenuEntry[]; handler?: (item: string, entry?: MenuItemDef) => void }

/** 標成完整版專屬：體驗版保留選單位階，但明確告知做不到，引導去下載。 */
const pro = (text: string): MenuEntry => ({ text, pro: true });
/** 開外部連結（官網各頁、源碼庫）。 */
const link = (text: string, href: string): MenuEntry => ({ text, href });

/** 數字形態選單項的兩種文字（開關式，寫法對照「模式:练习 / 模式:竞速」）。 */
const NUMBERED_ITEM_OFF = '数字形态:关';
const NUMBERED_ITEM_ON = '数字形态:开';

// ---------- 求解器（聚攏 + 填洞補缺）----------
/**
 * 求解器是「盡力而為」：
 *  - 小／中型謎題與輕度打亂大多能解（4×4 約七~八成、5×5 約五成）；
 *  - 6×6 以上的重度打亂常常解不出來；
 *  - 而且本遊戲**存在合法但永遠還原不了的死局**，解不出來不代表程式有錯。
 * 因此失敗時一律如實告知，不假裝有解。
 */
function currentBlocks(): [number, number][] {
  return store.game.blocks.map((b) => [b.row, b.col] as [number, number]);
}

/** 提示一步：只幫玩家選好縫與塊（箭頭會自己出現），不代勞移動。 */
function hintOneStep(): void {
  if (store.game.is_solved()) {
    showToast('已经还原了，不用提示');
    return;
  }
  const g = store.game;
  const mv = bestMove(stateFromBlocks(currentBlocks()), g.m, g.n, store.cmd.step);
  if (!mv) {
    showToast('这个局面一步都动不了（完全冻结）');
    return;
  }
  selectGap(store.cmd, mv.action.gapType, mv.action.line);
  selectBlock(store.cmd, mv.action.seed[0], mv.action.seed[1]);
  schedulePaint();
  showToast(`提示：${describeAction(mv.action)}（点箭头即可推）`);
}

/** 自動求解：解出來就逐步演示；解不出來如實說。 */
let solving = false;
async function autoSolve(): Promise<void> {
  if (solving) return;
  if (store.game.is_solved()) {
    showToast('已经还原了');
    return;
  }
  const g = store.game;
  solving = true;
  showToast('正在求解…');
  // 讓 toast 先畫出來再開始算（求解是同步的，會卡住主執行緒）
  await new Promise((r) => setTimeout(r, 30));
  let res;
  try {
    res = solve(currentBlocks(), g.m, g.n, store.cmd.step, { restarts: 3, timeBudgetMs: 3000 });
  } finally {
    solving = false;
  }
  if (res.actions.length === 0) {
    showToast('没能解出来（求解器尽力而为；也可能是真踩到死局）');
    return;
  }
  if (res.solved) {
    showToast(`找到 ${res.steps} 步解法，开始演示`);
  } else {
    // 對齊原版 fill_partial 協議：沒能全解也把走得動的部分播出來——解成啥樣是啥樣。
    // solve() 只會回傳「回放後比初始局面好」的部分成果，所以這串步數走完必定有淨進展；
    // 播到斷點後玩家可以自己接手，也可以再點一次「自動求解」從新局面續算。
    showToast(`没能完全解出，先把走得动的 ${res.steps} 步演示给你看`);
  }
  await playSolverActions(res.actions);
  if (!store.game.is_solved()) {
    showToast('只能推进到这兒——求解器盡力而为，也可能踩到死局；可再点一次「自动求解」续算');
  }
}

/** 依序回放走法：每步都走選縫隙 → 點塊 → 推，與玩家手動操作完全一致。 */
async function playSolverActions(actions: SolverAction[]): Promise<void> {
  const gapMs = controller.moveDurationMs + 90;
  for (const a of actions) {
    selectGap(store.cmd, a.gapType, a.line);
    selectBlock(store.cmd, a.seed[0], a.seed[1]);
    controller.move(a.dir);
    await new Promise((r) => setTimeout(r, gapMs));
    if (store.game.is_solved()) break;
  }
  schedulePaint();
  if (store.game.is_solved()) showToast('已还原');
}

const menus: MenuDef[] = [
  { label: '文件', items: ['打开 Ctrl+O', '保存 Ctrl+S', '另存为...', '---', '存档列表...'], handler: (item) => {
      if (item.includes('另存')) { saveAs(store); showToast('另存为...'); }
      else if (item.includes('保存')) { downloadSave(store); showToast('已下载存档'); }
      else if (item.includes('打开')) fileInput.click();
      else if (item.includes('存档列表')) openSaveList();
    }
  },
  { label: '编辑', items: ['撤销 Ctrl+Z', '重做 Ctrl+X', '打乱 Alt+S', '重置 Ctrl+R', '---', pro('自动求解 Ctrl+Alt+S')], handler: (item) => {
      if (item.startsWith('撤销')) handleUndo();
      else if (item.startsWith('重做')) handleRedo();
      else if (item.startsWith('打乱')) handleShuffle();
      else if (item.startsWith('重置')) handleReset();
    }
  },
  // 數字形態是方形底板加編號，規則與方形完全相同，體驗版也能做；
  // 三角 / 米字要另一套座標與畫法，仍留在完整版。
  // 求解器（自動求解）網頁版只有聚攏一條路線、沒有宏接口，動作序列經常亂選，
  // 故仍標成完整版專屬（見 编辑 菜單的 pro('自動求解')，詳見 src/solver/index.ts 頂部判斷）。
  // 提示一步是網頁版原創、完整版並無此功能，故不進此菜單，避免與完整版結構差異。
  // 二級子菜單（對照原版 puzzle_sub_presets）：矩形按等級分組，異形按形態分組。
  // 網頁版只有矩形與數字形態可玩，三角／米字仍留完整版，故標成 pro 但保留位階。
  // 高级选项... 對照原版 puzzle_presets（自定義... 之後），網頁版未實作 → 標 pro。
  // 模式切換原版移到主窗右下角常用區，網頁版無該控件故留在菜單；数字形态 亦為網頁便利入口。
  { label: '谜题', items: [
      { text: '快速开始：6×6 等级2', preset: [6, 6, 2] },
      { text: '矩形谜题', sub: 'rect' },
      { text: '异形谜题', sub: 'exotic' },
      '---',
      '自定义...',
      pro('高级选项...'),
      '---',
      '模式:练习', '模式:竞速', '模式:创造',
      '---',
      NUMBERED_ITEM_OFF,
      '---',
      { current: true },
    ], handler: (item, entry) => {
      if (entry?.preset) {
        handlePresetPuzzle(entry.preset[0], entry.preset[1], entry.preset[2], entry.numbered ?? store.numbered);
        return;
      }
      if (item === '自定义...') handleCustomPuzzle();
      else if (item === '模式:练习') setGameMode('practice');
      else if (item === '模式:竞速') setGameMode('timed');
      else if (item === '模式:创造') creative.enter();
      else if (item.startsWith('数字形态')) toggleNumbered();
    }
  },
  { label: '宏定义', items: [pro('管理宏...'), pro('录制宏 Ctrl+M'), pro('逆序播放'), '---', pro('（宏名）')] },
  { label: '设置', items: ['虚拟键盘', '成绩面板', '控制模式...', '---', pro('求解器...'), pro('快捷键设置...')], handler: (item) => {
      if (item.includes('虚拟键盘')) toggleVK();
      else if (item.includes('成绩')) toggleRecords();
      else if (item.includes('控制模式')) openSettingsModal();
    }
  },
  // 「搜索」對照原版 menu_items：位於「设置」與「帮助」之間，是「找不到功能時先來這裡」
  // 的直達入口。原版只有一條「命令面板 Ctrl+K」，網頁版照做：叫出可按關鍵字過濾全部
  // 選單命令的面板（手機上沒有 Ctrl+K，入口就靠這個選單項）。
  { label: '搜索', items: ['命令面板 Ctrl+K'], handler: () => openCommandPalette() },
  // 「更新日志」開本地那份（file:// 與官網目錄下都有），不必繞到官網；
  // 「本次更新」直接彈公告。注意別用 link()——那會走 window.open。
  { label: '帮助', items: ['关于', '新手引导', '本次更新', '---', link('玩法详解', `${HOME_URL}guide.html`), link('更新日志', 'update_info.html')], handler: (item) => {
      if (item === '本次更新') showChangelog(true);
      else if (item.includes('关于')) showToast('貓九的滑块遊戲 网頁体验版 v0.1');
      else if (item.includes('新手引导')) startTutorial();
    }
  },
  { label: '教程', items: ['新手教程', '教程关卡...', '---', link('玩法详解（网頁）', `${HOME_URL}guide.html`)], handler: (item) => {
    if (item.includes('新手教程') || item.includes('教程关卡')) tutorial.openLevelSelect();
  } },
  { label: '官网', items: [link('首頁', HOME_URL), link('下载完整版', FULL_VERSION_URL), '---', link('GitHub 源码', 'https://github.com/Gatennea/GatenneaSlider')] },
];

/**
 * 謎題的二級子菜單（對照原版 GUI.puzzle_sub_presets）。
 * 難度定位沿原版註解：矩形等级1 最低、等级2 最經典（教程教學目標）、等级3+ 複雜。
 * 異形裡只有「數字形態」網頁版做得到（矩形底板＋編號），三角／米字仍是完整版。
 */
const PUZZLE_SUB: Record<string, MenuEntry[]> = {
  rect: [
    { group: '等级1 · 入门' },
    { text: '4×4 等级1', preset: [4, 4, 1] },
    { text: '5×5 等级1', preset: [5, 5, 1] },
    { text: '6×6 等级1', preset: [6, 6, 1] },
    { group: '等级2 · 经典 ★ 推荐' },
    { text: '4×4 等级2', preset: [4, 4, 2] },
    { text: '5×5 等级2', preset: [5, 5, 2] },
    { text: '6×6 等级2', preset: [6, 6, 2] },
    { text: '8×8 等级2', preset: [8, 8, 2] },
    { text: '10×10 等级2', preset: [10, 10, 2] },
    { group: '等级3 · 复杂' },
    { text: '6×6 等级3', preset: [6, 6, 3] },
    { text: '8×8 等级3', preset: [8, 8, 3] },
    { text: '10×10 等级3', preset: [10, 10, 3] },
  ],
  exotic: [
    { group: '三角形谜题（完整版）' },
    pro('边长4 等级1'), pro('边长6 等级2'), pro('边长8 等级2'),
    { group: '米字格谜题（完整版）' },
    pro('4×4 等级1'), pro('4×4 等级2'), pro('6×6 等级2'), pro('8×8 等级2'),
    { group: '数字谜题（矩形＋编号）' },
    { text: '4×4 等级2', preset: [4, 4, 2], numbered: true },
    { text: '6×6 等级2', preset: [6, 6, 2], numbered: true },
    { text: '8×8 等级2', preset: [8, 8, 2], numbered: true },
  ],
};

let activeMenu: number | null = null;
/** 二級子菜單的延遲關閉計時器（滑鼠從子菜單移開後才收，避免掠過就消失）。 */
let subLeaveTimer = 0;
/** 目前展開的二級子菜單 key（'' = 沒有），用來讓父列在展開期間保持高亮。 */
let openSubKey = '';

/** 選單列最右側的「下載完整版」入口；buildMenu 每次重建後會把它重新釘到最右。 */
let ctaEl: HTMLAnchorElement | null = null;
function ensureCta(): HTMLAnchorElement {
  if (!ctaEl) {
    const cta = document.createElement('a');
    cta.textContent = '免費下载完整版';
    cta.href = FULL_VERSION_URL;
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.style.marginLeft = 'auto';
    cta.style.marginRight = '10px';
    cta.style.padding = '3px 12px';
    cta.style.fontSize = '12px';
    cta.style.borderRadius = '12px';
    cta.style.background = BRAND_COLOR;
    cta.style.color = '#fff';
    cta.style.textDecoration = 'none';
    cta.style.whiteSpace = 'nowrap';
    // 求解器與新手教程已移植到網頁版，不再列進「只有完整版有」
    cta.title = '三角／米字形态、宏定义都在完整版里，一样免費开源';
    ctaEl = cta;
  }
  // 每次都重掛一次：appendChild 會把既有節點移到最後，
  // 這樣選單項重建後 cta 仍是最後一個，margin-left:auto 才能正確把它推到右端。
  menuBar.appendChild(ctaEl);
  return ctaEl;
}

/** 讓選單文字跟著目前狀態走（切換後要重畫選單才看得到）。 */
function refreshNumberedMenuItem(): void {
  const items = menus[2].items;
  const at = items.findIndex((it) => typeof it === 'string' && it.startsWith('数字形态'));
  if (at >= 0) items[at] = store.numbered ? NUMBERED_ITEM_ON : NUMBERED_ITEM_OFF;
}

function toggleNumbered(): void {
  if (gameMode === 'timed' && timer.state === 'running') {
    showToast('计时中无法切换形态');
    return;
  }
  store.setNumbered(!store.numbered);
  showToast(store.numbered ? '数字形态：开（滑块带编号，照数字排回去）' : '数字形态：关');
  refreshNumberedMenuItem();
  buildMenu();
  updateStatus();
  schedulePaint();
}

/**
 * 統一刷頂欄高亮：hover 那一項 + 展開中那一項（原版 menu_hovered / show_*_menu 同理），
 * 其餘一律清掉。分散在各處 set/clear 會留下「展開過但已關閉的項還亮著」的殘影。
 */
function paintMenuBarHighlight(hoverIdx: number): void {
  menuBar.querySelectorAll<HTMLElement>('[data-menu-item]').forEach((el, i) => {
    el.style.background = i === hoverIdx || i === activeMenu ? COLORS.menu_hover : '';
  });
}

function closeAllMenus(): void {
  closeSubMenus();
  app.querySelectorAll('[data-dropdown]').forEach((el) => el.remove());
  activeMenu = null;
  paintMenuBarHighlight(-1);
}

/** 關掉二級子菜單（換列懸停、收起整個選單、滑鼠移開時都會呼叫）。 */
function closeSubMenus(): void {
  clearTimeout(subLeaveTimer);
  app.querySelectorAll('[data-subdropdown]').forEach((el) => el.remove());
  openSubKey = '';
}

/** 造一個下拉容器：一級與二級共用同一套外觀（對照原版 draw_puzzle_sub_menu）。 */
function makeDropdown(sub: boolean): HTMLDivElement {
  const dd = document.createElement('div');
  dd.dataset[sub ? 'subdropdown' : 'dropdown'] = '1';
  dd.style.position = 'absolute';
  dd.style.background = COLORS.menu_bg;
  dd.style.border = `1px solid ${COLORS.dialog_border}`;
  // 下拉掛在 #app 下，#app 沒設 color → 文字會繼承瀏覽器預設黑色；
  // 顯式鎖成 menu_text（淡灰），與選單列一致，避免「一會黑一會白」。
  dd.style.color = COLORS.menu_text;
  dd.style.minWidth = sub ? '150px' : '220px';
  dd.style.zIndex = '1000';
  dd.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
  // 窄屏保護：寬度不超過畫面，高度不超過棋盤區，超出就自己捲
  dd.style.maxWidth = 'calc(100vw - 8px)';
  dd.style.maxHeight = `calc(100dvh - ${GEOMETRY.menu_bar_height + GEOMETRY.status_bar_height + 8}px)`;
  dd.style.overflowY = 'auto';
  return dd;
}

/**
 * 把一組選單項畫進下拉容器（一級與二級共用同一套渲染）。
 * 條目語義見 MenuEntry 的註解：分隔線 / 分組標題 / 當前狀態行 / 一般命令 /
 * 完整版專屬 / 外鏈 / 謎題檔位（畫 ✓）/ 二級子菜單（畫 ▸）。
 */
function renderEntries(dd: HTMLElement, menu: MenuDef, items: MenuEntry[]): void {
  const isSub = dd.hasAttribute('data-subdropdown');
  items.forEach((mi) => {
    if (mi === '---') {
      const sep = document.createElement('div');
      sep.style.height = '1px';
      sep.style.background = COLORS.separator;
      sep.style.margin = '4px 0';
      dd.appendChild(sep);
      return;
    }
    const opt = typeof mi === 'string' ? null : mi;

    // 分組標題（原版 __group__）：不可點、不隨懸停高亮
    if (opt && opt.group !== undefined) {
      const g = document.createElement('div');
      g.textContent = opt.group;
      g.style.padding = '6px 12px';
      g.style.fontSize = '12px';
      g.style.color = COLORS.menu_selected;
      dd.appendChild(g);
      return;
    }

    // 底部狀態行（原版 __current__）：告訴玩家現在玩的哪一檔
    if (opt?.current) {
      const c = document.createElement('div');
      c.textContent = `当前：${currentPuzzleLabel()}`;
      c.style.padding = '6px 12px';
      c.style.fontSize = '12px';
      c.style.color = COLORS.menu_text;
      c.style.textAlign = 'center';
      dd.appendChild(c);
      return;
    }

    const text = typeof mi === 'string' ? mi : (opt?.text ?? '');
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.padding = '6px 12px';
    row.style.cursor = 'pointer';
    row.style.fontSize = '13px';
    const label = document.createElement('span');
    label.textContent = text;
    label.style.flex = '1 1 auto';
    row.appendChild(label);

    // 當前檔位：menu_selected 色 + 右側 ✓（對照原版 _preset_is_current）
    if (isCurrentPreset(opt?.preset)) {
      label.style.color = COLORS.menu_selected;
      const tick = document.createElement('span');
      tick.textContent = '✓';
      tick.style.color = COLORS.menu_selected;
      row.appendChild(tick);
    }

    // 懸停時額外要做的事（目前只有「展開二級子菜單」一種）
    let onEnter: (() => void) | null = null;

    if (opt?.pro) {
      // 完整版專屬：置灰 + 藍色角標，點下開引導下載的說明框
      label.style.color = '#989898';
      const tag = document.createElement('span');
      tag.textContent = '完整版';
      tag.style.fontSize = '10px';
      tag.style.color = '#fff';
      tag.style.background = BRAND_COLOR;
      tag.style.borderRadius = '3px';
      tag.style.padding = '1px 5px';
      row.appendChild(tag);
      row.addEventListener('click', () => { closeAllMenus(); showFullVersionDialog(text); });
    }
    else if (opt?.href) {
      const href = opt.href;
      row.addEventListener('click', () => { closeAllMenus(); window.open(href, '_blank', 'noopener'); });
    }
    else if (opt?.sub) {
      // 二級子菜單：名字 + ▸，懸停或點擊展開（手機沒有 hover，故兩者都接）
      const subKey = opt.sub;
      const arrow = document.createElement('span');
      arrow.textContent = '▸';
      row.appendChild(arrow);
      const openSub = (): void => {
        closeSubMenus();
        const sub = makeDropdown(true);
        renderEntries(sub, menu, PUZZLE_SUB[subKey] ?? []);
        app.appendChild(sub);
        openSubKey = subKey;
        // 貼在父下拉右側、與該列對齊；右邊界不夠就翻到左側
        const rowRect = row.getBoundingClientRect();
        const appRect = app.getBoundingClientRect();
        sub.style.top = `${rowRect.top - appRect.top}px`;
        let left = dd.offsetLeft + dd.offsetWidth;
        if (left + sub.offsetWidth > window.innerWidth - 4) {
          left = Math.max(4, dd.offsetLeft - sub.offsetWidth);
        }
        sub.style.left = `${left}px`;
        // 滑鼠移開子菜單後再收（掠過箭頭與面板之間的縫隙不會立刻消失）
        sub.addEventListener('mouseenter', () => clearTimeout(subLeaveTimer));
        sub.addEventListener('mouseleave', () => {
          clearTimeout(subLeaveTimer);
          subLeaveTimer = window.setTimeout(closeSubMenus, 200);
        });
      };
      onEnter = openSub;
      row.addEventListener('click', (e) => { e.stopPropagation(); openSub(); });
    }
    else {
      row.addEventListener('click', () => { closeAllMenus(); menu.handler?.(text, opt ?? undefined); });
    }

    row.addEventListener('mouseenter', () => {
      if (!isSub) closeSubMenus();
      row.style.background = COLORS.menu_hover;
      onEnter?.(); // 子菜單列：先關掉別的再開自己的（順序不能反）
    });
    row.addEventListener('mouseleave', () => {
      // 子菜單展開中，父列保持高亮（原版 sub_open 也一樣高亮）
      if (!(opt?.sub && openSubKey === opt.sub)) row.style.background = '';
    });
    dd.appendChild(row);
  });
}

function buildMenu(): void {
  refreshNumberedMenuItem();
  app.querySelectorAll('[data-dropdown]').forEach((el) => el.remove());
  menuBar.querySelectorAll('[data-menu-item]').forEach((el) => el.remove());
  menus.forEach((menu, idx) => {
    const item = document.createElement('div');
    item.dataset['menuItem'] = '1';
    item.textContent = menu.label;
    item.style.cursor = 'pointer';
    item.style.flex = '0 0 auto';
    item.style.whiteSpace = 'nowrap';
    // 原版：menu_hovered 或該選單展開中，頂欄那一項都要高亮（menu_hover 底）
    item.addEventListener('mouseenter', () => paintMenuBarHighlight(idx));
    item.addEventListener('mouseleave', () => paintMenuBarHighlight(-1));
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeMenu === idx) { closeAllMenus(); return; }
      closeAllMenus();
      const dd = makeDropdown(false);
      // 用選單欄**實際底邊**而非常數：app 有 safe-area 上內邊距時兩者不再相等，
      // 寫死會讓下拉往上飄、壓住選單欄
      dd.style.top = `${menuBar.offsetTop + menuBar.offsetHeight}px`;
      renderEntries(dd, menu, menu.items);
      app.appendChild(dd);
      // 對齊被點的選單項目，再夾住右邊界：否則窄屏點最右幾個選單，下拉會開在畫面外
      const anchorLeft = item.getBoundingClientRect().left - app.getBoundingClientRect().left;
      const maxLeft = Math.max(4, window.innerWidth - dd.offsetWidth - 4);
      dd.style.left = `${Math.min(anchorLeft, maxLeft)}px`;
      activeMenu = idx;
      paintMenuBarHighlight(idx);
    });
    menuBar.appendChild(item);
  });
  paintMenuBarHighlight(-1);
  // 關鍵：重建選單項後要把「下載完整版」入口重新釘在最右側。
  // 選單項是用 appendChild 重新加回的，會被移到 cta 之後，
  // 若不再把它挪到最後，cta 的 margin-left:auto 就會把整列選單推到右對齊。
  ensureCta();
  applyChromeDensity();
}

/**
 * 窄屏時把選單與狀態列擠緊一點，讓八個選單跟五個狀態欄位都還看得見。
 * 判據只用視窗寬度：手機直向約 360~430，平板與桌機都遠大於此。
 */
function applyChromeDensity(): void {
  const narrow = window.innerWidth < 520;
  // 對照原版字號：menu_font = SimHei 16、status_font = SimHei 14；窄屏再各降一檔。
  const menuFont = narrow ? '13px' : '16px';
  const statusFont = narrow ? '12px' : '14px';
  const menuPad = narrow ? '0 6px' : '0 14px';
  menuBar.querySelectorAll<HTMLElement>('[data-menu-item]').forEach((el) => {
    el.style.fontSize = menuFont;
    el.style.padding = menuPad;
  });
  status.style.fontSize = statusFont;
  status.style.gap = narrow ? '10px' : '24px';
  status.style.overflowX = 'auto';

  // 豎屏/窄屏（手機專項第 11 項「豎屏比例有問題」）：右側那條 132px 固定欄在
  // 豎屏會吃掉三分之一寬度，棋盤被擠扁。改成**底部橫條**——棋盤拿回全部寬度，
  // 開關與滑條橫向排列、放不下就橫向捲。
  const stacked = window.innerWidth < 640;
  content.style.flexDirection = stacked ? 'column' : 'row';
  rightPanel.style.width = stacked ? 'auto' : `${GEOMETRY.right_panel_width}px`;
  rightPanel.style.flex = stacked ? '0 0 auto' : `0 0 ${GEOMETRY.right_panel_width}px`;
  rightPanel.style.height = stacked ? '52px' : 'auto';
  rightPanel.style.flexDirection = stacked ? 'row' : 'column';
  rightPanel.style.alignItems = stacked ? 'center' : 'stretch';
  rightPanel.style.padding = stacked ? '4px 8px' : '10px 8px';
  rightPanel.style.gap = stacked ? '6px' : '6px';
  rightPanel.style.overflowX = stacked ? 'auto' : 'visible';
  rightPanel.style.overflowY = 'hidden';
  rightPanel.style.borderLeft = stacked ? 'none' : `1px solid ${COLORS.border}`;
  rightPanel.style.borderTop = stacked ? `1px solid ${COLORS.border}` : 'none';
  // 狀態列原本為右欄留了 132px；面板移到底下後不必再留
  status.style.paddingRight = stacked ? '10px' : `${GEOMETRY.right_panel_width + 10}px`;
  // 通知也一樣：面板不在右側時，右下角不用再為它留位
  toast.style.right = `${stacked ? 12 : GEOMETRY.right_panel_width + 12}px`;
  // 滑條區：豎屏橫條裡不要撐開（兩條各佔固定寬即可）
  sliderArea.style.flex = stacked ? '0 0 auto' : '1 1 auto';
  sliderArea.style.order = stacked ? '0' : '-1';
  sliderArea.style.height = stacked ? '100%' : 'auto';
  for (const wrap of sliderWraps) {
    wrap.style.width = stacked ? '40px' : 'auto';
    wrap.style.flex = stacked ? '0 0 40px' : '1 1 auto';
  }
  // 成績面板定位（對照原版 records_panel.py：screen_width - 右欄寬 - 320 - 10，
  // 放在右欄**左側**不擋右欄）。網頁版原本寫死 right:12px 會與右欄（132px）重疊遮擋，
  // 這裡改到右欄左側；堆叠（手機底部條）時改到底部條上方。
  if (recordsPanel.style.display !== 'none') {
    if (stacked) {
      recordsPanel.style.left = 'auto';
      recordsPanel.style.top = 'auto';
      recordsPanel.style.bottom = `${GEOMETRY.status_bar_height + 64}px`;
      recordsPanel.style.right = '12px';
    } else {
      recordsPanel.style.left = 'auto';
      recordsPanel.style.top = `${GEOMETRY.menu_bar_height + 8}px`;
      recordsPanel.style.bottom = 'auto';
      recordsPanel.style.right = `${GEOMETRY.right_panel_width + 12}px`;
    }
  }
  layoutCanvas();
}

// ---------- 命令面板（「搜索」選單；對照原版 命令面板 Ctrl+K）----------
/** 面板裡的一條命令：文字 + 所屬選單（執行時交回該選單的 handler）。 */
interface PaletteCmd { text: string; menu: MenuDef; entry?: MenuItemDef }

/**
 * 攤平一組選單項成命令清單。跳過：分隔線、分組標題、當前狀態行、完整版專屬、
 * 外鏈、以及子菜單本身（它的子項另外收）。
 */
function collectPaletteCommands(menu: MenuDef, items: MenuEntry[], out: PaletteCmd[]): void {
  for (const mi of items) {
    if (mi === '---') continue;
    const opt = typeof mi === 'string' ? null : mi;
    if (opt && (opt.group !== undefined || opt.current || opt.pro || opt.href || opt.sub)) continue;
    const text = typeof mi === 'string' ? mi : (opt?.text ?? '');
    if (!text) continue;
    out.push({ text, menu, entry: opt ?? undefined });
  }
}

/**
 * 叫出命令面板：輸入關鍵字過濾所有選單命令，回车直達。
 * 清單完全由 menus / PUZZLE_SUB 生成——日後加選單項不必再維護第二份清單。
 * 手機沒有 Ctrl+K，靠「搜索」選單項進來，所以是那邊唯一的入口。
 */
function openCommandPalette(): void {
  const cmds: PaletteCmd[] = [];
  for (const menu of menus) {
    collectPaletteCommands(menu, menu.items, cmds);
    // 帶二級子菜單的選單（谜题）：子項也算命令，執行時交回同一個 handler
    if (menu.items.some((mi) => typeof mi !== 'string' && mi.sub)) {
      for (const items of Object.values(PUZZLE_SUB)) collectPaletteCommands(menu, items, cmds);
    }
  }

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.55)';
  overlay.style.zIndex = '2000';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'flex-start';
  overlay.style.paddingTop = '12vh';
  overlay.addEventListener('click', () => overlay.remove());

  const box = document.createElement('div');
  box.style.background = COLORS.dialog_bg;
  box.style.border = `1px solid ${COLORS.dialog_border}`;
  box.style.borderRadius = '8px';
  box.style.width = 'min(420px, 92vw)';
  box.style.maxHeight = '70vh';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.overflow = 'hidden';
  box.style.color = COLORS.dialog_text;
  box.style.fontSize = '13px';
  box.addEventListener('click', (e) => e.stopPropagation());

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '输入指令关键字（例：打乱、教程、存档、6×6）';
  input.style.background = COLORS.input_bg;
  input.style.border = 'none';
  input.style.borderBottom = `1px solid ${COLORS.dialog_border}`;
  input.style.color = COLORS.input_text;
  input.style.padding = '12px';
  input.style.fontSize = '14px';
  input.style.outline = 'none';
  box.appendChild(input);

  const list = document.createElement('div');
  list.style.overflowY = 'auto';
  list.style.flex = '1 1 auto';
  box.appendChild(list);

  let shown: PaletteCmd[] = [];
  let sel = 0;

  const run = (c: PaletteCmd): void => { overlay.remove(); c.menu.handler?.(c.text, c.entry); };

  const paint = (): void => {
    list.textContent = '';
    if (shown.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = '没有符合的指令';
      empty.style.padding = '12px';
      empty.style.color = COLORS.menu_text;
      list.appendChild(empty);
      return;
    }
    shown.forEach((c, i) => {
      const row = document.createElement('div');
      row.style.padding = '8px 12px';
      row.style.cursor = 'pointer';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.gap = '10px';
      if (i === sel) row.style.background = COLORS.menu_hover;
      const t = document.createElement('span');
      t.textContent = c.text;
      const from = document.createElement('span');
      from.textContent = c.menu.label;
      from.style.color = COLORS.menu_text;
      from.style.fontSize = '11px';
      row.appendChild(t);
      row.appendChild(from);
      row.addEventListener('mouseenter', () => { sel = i; paint(); });
      row.addEventListener('click', () => run(c));
      list.appendChild(row);
    });
  };

  const filter = (): void => {
    const q = input.value.trim().toLowerCase();
    shown = q
      ? cmds.filter((c) => c.text.toLowerCase().includes(q) || c.menu.label.includes(q))
      : cmds.slice();
    sel = 0;
    paint();
  };

  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) run(shown[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); overlay.remove(); }
  });

  overlay.appendChild(box);
  app.appendChild(overlay);
  filter();
  input.focus();
}

// ---------- 控制模式設定 ----------
function openSettingsModal(): void {
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
  box.style.border = '1px solid ' + COLORS.dialog_border;
  box.style.borderRadius = '8px';
  box.style.padding = '16px';
  box.style.width = 'min(320px, 90vw)';
  box.style.color = COLORS.dialog_text;
  box.style.fontSize = '13px';
  box.addEventListener('click', (e) => e.stopPropagation());

  const title = document.createElement('div');
  title.textContent = '控制模式';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '12px';
  box.appendChild(title);

  // 原版「控制」頁是**五種操作方式各自獨立**的開關（renderer.py:_draw_settings_control），
  // 可任意組合、甚至全關（全關時只能平移/縮放）。網頁版原先只有前三個，
  // 虛擬鍵盤只能靠 F1、箭頭按鍵只跟右側面板開關走，都沒進這張表。
  const hint = document.createElement('div');
  hint.textContent = '五种操作方式可任意组合（甚至全关）；全关时只能平移/缩放';
  hint.style.color = '#c8c878';
  hint.style.fontSize = '11px';
  hint.style.marginBottom = '10px';
  hint.style.lineHeight = '1.5';
  box.appendChild(hint);

  type ControlKey = 'singleTouch' | 'twoTouch' | 'keyboardMouse' | 'virtualKeyboard' | 'arrows';
  const modes: { key: ControlKey; label: string; desc: string }[] = [
    { key: 'singleTouch', label: '单次触控', desc: '直接拖拽滑块即滑动；完成后清空选中，下次拖拽是全新操作' },
    { key: 'twoTouch', label: '兩次触控', desc: '点缝隙 → 点方块 → 再拖拽 / 键盘（原版操作习慣）' },
    { key: 'keyboardMouse', label: '鼠标键盘', desc: '方向键 / W/A/S/D 移动滑块（撤销/重做等快捷键不受影響）' },
    { key: 'virtualKeyboard', label: '虛拟键盘', desc: '屏幕上的方向键盘（F1 亦可开关）；手机没有实体键盘，关了仍可用手勢' },
    { key: 'arrows', label: '箭頭按键', desc: '选中缝隙后在切片兩端显示可点的方向箭頭' },
  ];

  const renderRow = (m: { key: ControlKey; label: string; desc: string }) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '8px';
    row.style.border = '1px solid ' + COLORS.separator;
    row.style.borderRadius = '4px';
    row.style.marginBottom = '8px';
    const info = document.createElement('div');
    const label = document.createElement('div');
    label.textContent = m.label;
    label.style.fontWeight = 'bold';
    const desc = document.createElement('div');
    desc.textContent = m.desc;
    desc.style.color = '#999';
    desc.style.fontSize = '11px';
    info.append(label, desc);
    const btn = document.createElement('button');
    btn.style.background = COLORS.button_bg;
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.padding = '6px 14px';
    btn.style.cursor = 'pointer';
    const state = (): boolean => {
      if (m.key === 'singleTouch') return singleTouch;
      if (m.key === 'twoTouch') return twoTouch;
      if (m.key === 'keyboardMouse') return keyboardMouse;
      if (m.key === 'virtualKeyboard') return vkPanel.style.display !== 'none';
      return renderer.arrowEnabled;
    };
    const refresh = () => { btn.textContent = state() ? '开' : '关'; btn.style.background = state() ? COLORS.button_bg : COLORS.input_bg; };
    refresh();
    btn.addEventListener('click', () => {
      const v = !state();
      if (m.key === 'singleTouch') singleTouch = v;
      else if (m.key === 'twoTouch') twoTouch = v;
      else if (m.key === 'keyboardMouse') keyboardMouse = v;
      else if (m.key === 'virtualKeyboard') toggleVK(v); // 與 F1 同一個開關，狀態互通
      else { renderer.arrowEnabled = v; syncSwitches(); }
      controller.singleTouchEnabled = singleTouch;
      controller.twoTouchEnabled = twoTouch;
      controller.keyboardMouseEnabled = keyboardMouse;
      saveUiPrefs();
      refresh();
    });
    row.append(info, btn);
    return row;
  };

  modes.forEach((m) => box.appendChild(renderRow(m)));

  const close = document.createElement('button');
  close.textContent = '关闭';
  close.style.background = COLORS.input_bg;
  close.style.color = '#fff';
  close.style.border = '1px solid ' + COLORS.border;
  close.style.borderRadius = '4px';
  close.style.padding = '6px 14px';
  close.style.cursor = 'pointer';
  close.style.marginTop = '10px';
  close.addEventListener('click', () => overlay.remove());
  box.appendChild(close);

  overlay.appendChild(box);
  app.appendChild(overlay);
}

// ---------- 存檔列表（localStorage，手機友好） ----------
function openSaveList(): void {
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
  box.style.border = '1px solid ' + COLORS.dialog_border;
  box.style.borderRadius = '8px';
  box.style.padding = '16px';
  box.style.width = 'min(360px, 90vw)';
  box.style.maxHeight = '70vh';
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.gap = '8px';
  box.style.color = COLORS.dialog_text;
  box.style.fontSize = '13px';
  box.addEventListener('click', (e) => e.stopPropagation());

  const title = document.createElement('div');
  title.textContent = '存档列表（本机瀏览器）';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '4px';
  box.appendChild(title);

  const nameRow = document.createElement('div');
  nameRow.style.display = 'flex';
  nameRow.style.gap = '6px';
  const nameInput = document.createElement('input');
  nameInput.placeholder = '输入存档名稱';
  nameInput.style.flex = '1';
  nameInput.style.background = COLORS.input_bg;
  nameInput.style.color = COLORS.input_text;
  nameInput.style.border = '1px solid ' + COLORS.border;
  nameInput.style.borderRadius = '4px';
  nameInput.style.padding = '6px';
  const addBtn = document.createElement('button');
  addBtn.textContent = '新增存档';
  addBtn.style.background = COLORS.button_bg;
  addBtn.style.color = '#fff';
  addBtn.style.border = 'none';
  addBtn.style.borderRadius = '4px';
  addBtn.style.padding = '6px 10px';
  addBtn.style.cursor = 'pointer';
  addBtn.addEventListener('click', () => {
    const slot = saveSlot(nameInput.value || '未命名存档', store);
    if (slot) { nameInput.value = ''; renderList(); showToast('已新增存档'); }
  });
  nameRow.append(nameInput, addBtn);
  box.appendChild(nameRow);

  const listEl = document.createElement('div');
  listEl.style.overflowY = 'auto';
  listEl.style.maxHeight = '50vh';
  box.appendChild(listEl);

  const renderList = () => {
    listEl.innerHTML = '';
    const slots = listSaves();
    if (slots.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = '#888';
      empty.style.padding = '12px';
      empty.textContent = '尚无存档';
      listEl.appendChild(empty);
      return;
    }
    slots.forEach((slot) => {
      const row = document.createElement('div');
      row.style.border = '1px solid ' + COLORS.separator;
      row.style.borderRadius = '4px';
      row.style.padding = '8px';
      row.style.marginBottom = '6px';
      const info = document.createElement('div');
      info.textContent = `${slot.name}（${new Date(slot.updated).toLocaleString()}）`;
      info.style.marginBottom = '4px';
      info.style.fontWeight = 'bold';
      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '4px';
      const mk = (label: string, cb: () => void) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.background = COLORS.input_bg;
        b.style.color = '#fff';
        b.style.border = '1px solid ' + COLORS.border;
        b.style.borderRadius = '4px';
        b.style.padding = '4px 8px';
        b.style.cursor = 'pointer';
        b.addEventListener('click', cb);
        return b;
      };
      btnRow.append(
        mk('读取', () => {
          if (gameMode === 'timed') { showToast('竞速模式中无法读取存档'); return; }
          if (loadSlot(slot.id, store)) {
            renderer.animation = null;
            centerCamera();
            autosave(store);
            schedulePaint();
            showToast('已读取 ' + slot.name);
          } else showToast('读取失敗');
        }),
        mk('覆盖', () => {
          if (updateSlot(slot.id, store)) { renderList(); showToast('已覆盖 ' + slot.name); }
        }),
        mk('删除', () => {
          deleteSlot(slot.id);
          renderList();
          showToast('已删除');
        }),
      );
      row.append(info, btnRow);
      listEl.appendChild(row);
    });
  };
  renderList();

  const close = document.createElement('button');
  close.textContent = '关闭';
  close.style.background = COLORS.input_bg;
  close.style.color = '#fff';
  close.style.border = '1px solid ' + COLORS.border;
  close.style.borderRadius = '4px';
  close.style.padding = '6px 12px';
  close.style.cursor = 'pointer';
  close.style.alignSelf = 'flex-end';
  close.addEventListener('click', () => overlay.remove());
  box.appendChild(close);

  overlay.appendChild(box);
  app.appendChild(overlay);
}

// ---------- 檔案導入 ----------
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.json,.txt,.map';
fileInput.style.display = 'none';
app.appendChild(fileInput);
fileInput.addEventListener('change', () => {
  if (gameMode === 'timed') { showToast('竞速模式中无法打开存档'); fileInput.value = ''; return; }
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
  // 命令面板（原版「搜索」選單的 命令面板 Ctrl+K）：任何時候都能叫出來找功能
  if (ctrl && key === 'k') { e.preventDefault(); openCommandPalette(); return; }
  if (ctrl && key === 'z') { e.preventDefault(); if (e.shiftKey) handleRedo(); else handleUndo(); return; }
  if (ctrl && key === 'y') { e.preventDefault(); handleRedo(); return; }
  if (ctrl && key === 'x') { e.preventDefault(); handleRedo(); return; }
  if (ctrl && key === 's') { e.preventDefault(); downloadSave(store); showToast('已下载存档'); return; }
  if (ctrl && key === 'o') { e.preventDefault(); fileInput.click(); return; }
  if (ctrl && key === 'r') { e.preventDefault(); handleReset(); return; }
  if (e.altKey && key === 's') { e.preventDefault(); handleShuffle(); return; }
  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    // 與「點計時區」同一個入口（對照原版：空格與 _timer_bar_rect 都走 _timer_on_space）
    if (gameMode === 'timed') onTimerBarClick();
    return;
  }
  if (e.key === 'F1') { e.preventDefault(); toggleVK(); return; }
  if (e.key === 'F3') { e.preventDefault(); toggleRecords(); return; }
});

document.addEventListener('click', (e) => {
  // 二級子菜單也掛 data-subdropdown：點到別處要跟著一起收
  if (!(e.target as HTMLElement).closest('#menuBar, [data-dropdown], [data-subdropdown]')) closeAllMenus();
});

// ---------- 初始化 ----------
buildMenu();

buildVK();
layoutCanvas();
function onViewportChange(): void {
  closeAllMenus();
  applyChromeDensity();
  layoutCanvas();
  syncZoomSlider();
  syncSpeedSlider();
  syncRotateHint(); // 轉屏後豎/橫變了，提示要跟著出現或收起
  // 視窗變小後浮動面板可能被擠出畫面（原版每次重繪都 `_vk_clamp_position`）
  if (vkPanel.style.display !== 'none') {
    const p = vkClampPosition(
      { x: vkPanel.offsetLeft, y: vkPanel.offsetTop },
      vkViewport(),
      { w: vkPanel.offsetWidth, h: vkPanel.offsetHeight },
      vkChrome(),
    );
    vkPanel.style.left = `${p.x}px`;
    vkPanel.style.top = `${p.y}px`;
  }
  schedulePaint();
}
window.addEventListener('resize', onViewportChange);
// 轉屏：部分手機只發 orientationchange 不發 resize（或發得太早），兩個都聽
window.addEventListener('orientationchange', () => setTimeout(onViewportChange, 120));

// ---------- 手機端存檔時機（手機專項第 16 項） ----------
// 手機上「切到別的 App」往往直接被系統回收，不會有 beforeunload。
// 故在頁面被隱藏時也存一次，回來仍是同一局。
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosave(store);
});
window.addEventListener('pagehide', () => autosave(store));

// ---------- 首頁玩法演示模式（?demo=存檔路徑） ----------
const demoFile = new URLSearchParams(window.location.search).get('demo');
function followDemoCamera(): void {
  const anim = renderer.animation;
  const step = renderer.step;
  const cell = renderer.cell;
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  const blocks = store.game.blocks;
  if (anim) {
    const t = easeOut(anim.progress);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const sr = anim.start[i][0];
      const sc = anim.start[i][1];
      const er = anim.end[i][0];
      const ec = anim.end[i][1];
      const r = sr + (er - sr) * t;
      const c = sc + (ec - sc) * t;
      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
    }
  } else {
    for (const b of blocks) {
      minRow = Math.min(minRow, b.row);
      maxRow = Math.max(maxRow, b.row);
      minCol = Math.min(minCol, b.col);
      maxCol = Math.max(maxCol, b.col);
    }
  }
  if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) return;
  const left = minCol * step;
  const right = maxCol * step + cell;
  const top = minRow * step;
  const bottom = maxRow * step + cell;
  const w = (right - left) * renderer.zoom;
  const h = (bottom - top) * renderer.zoom;
  renderer.cameraX = (canvas.width - w) / 2 - left * renderer.zoom;
  renderer.cameraY = (canvas.height - h) / 2 - top * renderer.zoom;
}
if (demoFile) {
  // 演示模式：隱藏遊戲 UI，只留棋盤自動播放
  menuBar.style.display = 'none';
  rightPanel.style.display = 'none';
  status.style.display = 'none';
  vkPanel.style.display = 'none';
  recordsPanel.style.display = 'none';
  layoutCanvas();
}
function demoTick(): void {
  if (!demoPlaying) return;
  if (store.cmd.history.canRedo) {
    handleRedo();
    setTimeout(demoTick, 200);
  } else {
    // 播完回到起點；畫面由 followDemoCamera 持續置中，因此首尾兩個還原矩形無縫銜接
    store.cmd.history.setIndex(0);
    store.cmd.stepCount = 0;
    schedulePaint();
    setTimeout(demoTick, 800);
  }
}
if (demoFile) {
  // 首頁演示模式：自動播放，別彈更新公告打斷演示
  suppressChangelogOnce = true;
  const startDemo = (p: any) => {
    if (!store.deserialize(p)) { showToast('演示存档无法载入'); return; }
    store.cmd.history.setIndex(0);
    store.cmd.stepCount = 0;
    controller.animationEnabled = true;
    controller.moveDurationMs = 100;
    centerCamera();
    schedulePaint();
    demoPlaying = true;
    setTimeout(demoTick, 600);
  };
  // 優先使用內嵌的 DEMO_SAVE（file:// 也能正常播放）
  const inlineDemo = (window as any).DEMO_SAVE ?? null;
  if (inlineDemo) {
    startDemo(inlineDemo);
  } else {
    fetch(demoFile)
      .then((r) => r.json())
      .then(startDemo)
      .catch(() => showToast('无法载入演示存档'));
  }
} else if (autoload(store)) {
  centerCamera();
  showToast('已恢复上次进度');
} else if (!tutorialSeen()) {
  // 第一次來、又沒有舊進度：打開章節教程（新手教程）選關，帶著由淺入深地玩
  tutorial.openLevelSelect();
  // 同一次啟動裡不要再疊一個更新公告——兩個框一起彈，新手會不知道先看哪個。
  // 公告仍算「沒看過」，下次進來（教程已見過）再彈。
  suppressChangelogOnce = true;
}
// 虛擬鍵盤的開關與位置：觸屏設備默認開著（手機沒有實體方向鍵，不開就沒法走）
loadUiPrefs();
// 成績面板：桌面端默認展開（對照原版 show_records_panel=True）；手機/窄屏收起。
// 定位在 applyChromeDensity 裡按右欄寬調整（不擋右欄）；這裡只管顯隱與首次渲染。
recordsPanel.style.display = recordsVisible ? '' : 'none';
if (recordsVisible) renderRecordsPanel();
syncQuickBarBottom();
syncRotateHint();
maybeShowChangelogOnBoot();
schedulePaint();

// 計時中的秒錶：補幀之間也要走字。直接改 textContent 會寫成「計時：xx」、
// 與 updateStatus 的「競速模式 xx」兩種格式來回跳，故統一走 updateStatus。
setInterval(() => {
  if (timer.isRunning) updateStatus();
}, 100);

console.log('[web] 初始 solved =', store.solved);
console.log('[web] 互动：点缝隙 → 点方块 → W/S/A/D 或拖动');
