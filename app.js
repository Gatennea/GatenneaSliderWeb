/* 由 scripts/bundle.mjs 自動生成；來源為已編譯的 dist/。請勿手動編輯。 */
(function () {
  var __modules = { "m0": function (require) {
/**
 * 體驗版入口
 * 對照原版 GUI：頂部下拉選單 + 中央棋盤 + 右側面板(滑條/開關) + 底部狀態列。
 */
const { BoardRenderer } = require("./render/BoardRenderer.js");
const { BoardController } = require("./interaction/BoardController.js");
const { GameStore } = require("./store/GameStore.js");
const { COLORS, GEOMETRY, easeOut, FONT_FAMILY } = require("./render/theme.js");
const { shuffle, reset, undo, redo, selectGap, selectBlock } = require("./core/CommandBus.js");
const { solve, describeAction, bestMove, stateFromBlocks } = require("./solver/index.js");
const { autosave, autoload, downloadSave, saveAs, importData, listSaves, saveSlot, loadSlot, deleteSlot, updateSlot } = require("./io/SaveManager.js");
const { Timer, formatTime } = require("./feature/Timer.js");
const { Records, stats, series, tpsOf, blocksToMap } = require("./feature/Records.js");
const { TutorialController } = require("./feature/tutorial.js");
const { CreativeController } = require("./feature/create.js");
const app = document.querySelector('#app');
app.style.background = COLORS.background;
app.style.height = '100vh';
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
recordsBody.style.maxHeight = 'calc(70vh - 28px)';
recordsBody.style.overflowY = 'auto';
recordsPanel.appendChild(recordsBody);
recordsClose.addEventListener('click', () => { recordsPanel.style.display = 'none'; });
function makeDraggable(panel, header) {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    header.addEventListener('mousedown', (e) => {
        if (e.target === header.querySelector('span:last-child'))
            return;
        dragging = true;
        ox = e.clientX - panel.offsetLeft;
        oy = e.clientY - panel.offsetTop;
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!dragging)
            return;
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
const FULL_VERSION_URL = 'https://github.com/Gatennea/GatenneaSlider/releases/latest/download/GatenneaSlider-Windows.zip';
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
function showFullVersionDialog(feature) {
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
        '這個功能只有 Windows / Python 完整版才有。' +
            '網頁體驗版保留的是核心玩法：隨機打亂與還原、計時與成績統計、著色與連鎖視覺輔助、' +
            '本機存檔、三種控制模式。';
    box.appendChild(body);
    const hint = document.createElement('div');
    hint.textContent = '完整版一樣免費開源，不用自己裝 Python，解壓後雙擊即可執行。';
    hint.style.color = '#9a9a9a';
    hint.style.marginTop = '6px';
    box.appendChild(hint);
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '10px';
    btnRow.style.marginTop = '16px';
    const mkBtn = (text, primary, onClick) => {
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
    btnRow.appendChild(mkBtn('下載完整版', true, () => {
        window.open(FULL_VERSION_URL, '_blank', 'noopener');
        overlay.remove();
    }));
    btnRow.appendChild(mkBtn('看功能對比', false, () => {
        window.open(`${HOME_URL}#compare`, '_blank', 'noopener');
        overlay.remove();
    }));
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}
function showToast(text) {
    toast.textContent = text;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.textContent = ''), 1400);
}
// ---------- 遊戲狀態 ----------
// 初始謎題：6×6 等級2（原 4×4 等級2）
const store = new GameStore(6, 6, 2);
const renderer = new BoardRenderer(canvas.getContext('2d'), 1);
// 點擊漣漪存活期間需要連續重繪；schedulePaint 是函式聲明（已提升），此處可直接引用
renderer.repaint = schedulePaint;
let gameMode = 'practice';
const timer = new Timer();
const records = new Records();
function centerCamera() {
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
function layoutCanvas() {
    const w = Math.max(320, canvas.clientWidth);
    const h = Math.max(240, canvas.clientHeight);
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    centerCamera();
}
function updateStatus() {
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
}
let needsPaint = true;
let rafQueued = false;
let demoPlaying = false;
function schedulePaint() {
    needsPaint = true;
    if (rafQueued)
        return;
    rafQueued = true;
    // Demo 模式降低帧率：背景动画 30fps 足够，减少渲染压力
    const rafDelay = demoFile ? 33 : 0;
    setTimeout(() => {
        rafQueued = false;
        if (needsPaint) {
            needsPaint = false;
            if (demoPlaying)
                followDemoCamera();
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
        if (gameMode === 'timed') {
            if (timer.state === 'idle')
                return '競速模式：請先使用打亂功能';
            if (timer.state === 'ready')
                return '競速模式：按空白鍵開始計時後才能滑動';
        }
        return null;
    },
    onChanged: () => {
        // 引導/章節/解法回放期間不寫入自動存檔，避免把玩家原本的對局覆蓋成引導局面
        if (!tutorialActive() && !tutorial.chapterActive())
            autosave(store);
        tutorialOnMoved();
        tutorial.onMoved();
        if (gameMode === 'timed') {
            if (store.solved && timer.state === 'running') {
                timer.solve();
                const ms = timer.elapsedMs;
                records.add(store.currentM, store.currentN, store.currentStep, Math.round(ms), store.cmd.stepCount, false, store.numbered, raceInitialBlocks());
                showToast(`完成 ${formatTime(ms)}`);
            }
        }
        schedulePaint();
    },
});
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
        if (gameMode !== 'practice')
            setGameMode('practice');
        else
            timer.cancel();
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
        if (timer.state === 'running') {
            showToast('計時中無法進入創造模式');
            return;
        }
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
const TUTORIAL_STEPS = [
    { text: '① 點第 3 行與第 4 行之間那條橫縫 —— 縫是一把刀，它決定切開哪一側', wait: 'gap' },
    { text: '② 再點第 4 行（最下面一排）的任意一塊 —— 跟它連成一片的會整片一起走', cells: [[3, 1], [3, 2], [3, 3], [3, 4]], wait: 'block' },
    { text: '③ 按 ← 鍵，或直接在方塊上往左拖 —— 把這一排推回原位', wait: 'move' },
];
let tutorialStep = -1;
/** 進入引導前的局面與模式，結束時原樣還原，避免引導過程覆蓋玩家原本的對局。 */
let tutorialReturn = null;
function tutorialActive() {
    return tutorialStep >= 0;
}
/** 是否已經看過引導（隱私模式讀不到 localStorage 時當作沒看過）。 */
function tutorialSeen() {
    try {
        return localStorage.getItem(TUTORIAL_DONE_KEY) === '1';
    }
    catch {
        return false;
    }
}
function startTutorial() {
    if (gameMode === 'timed' && timer.state === 'running') {
        showToast('計時中無法開始引導');
        return;
    }
    // 記住進入引導前的局面（含模式），結束時原樣還原，不動用自動存檔
    tutorialReturn = { save: store.serialize(), mode: gameMode };
    store.loadTutorialPosition();
    // 引導走練習模式（順便把計時器歸位）；本來就是練習模式時不額外彈提示
    if (gameMode !== 'practice')
        setGameMode('practice');
    else
        timer.cancel();
    tutorialStep = 0;
    tutorialBar.style.display = 'flex';
    renderTutorialBar();
    applyTutorialHighlight();
    centerCamera();
    updateStatus();
    schedulePaint();
}
function endTutorial() {
    tutorialStep = -1;
    renderer.highlightCells = null;
    tutorialBar.style.display = 'none';
    try {
        localStorage.setItem(TUTORIAL_DONE_KEY, '1');
    }
    catch {
        // 隱私模式寫不進 localStorage：只影響「下次自動引導」，不影響遊戲
    }
    // 原樣還原進入引導前的局面（玩家原本的對局不會被引導覆蓋）
    if (tutorialReturn) {
        store.deserialize(tutorialReturn.save);
        const prevMode = tutorialReturn.mode;
        tutorialReturn = null;
        if (prevMode === 'timed')
            setGameMode('timed');
        else if (gameMode !== 'practice')
            setGameMode('practice');
        centerCamera();
        updateStatus();
    }
    schedulePaint();
}
function applyTutorialHighlight() {
    const step = TUTORIAL_STEPS[tutorialStep];
    renderer.highlightCells = step?.cells ? new Set(step.cells.map(([r, c]) => `${r}:${c}`)) : null;
}
function renderTutorialBar() {
    tutorialText.textContent = TUTORIAL_STEPS[tutorialStep]?.text ?? '';
}
/** 每次重繪順便檢查進度：互動後一定會重繪，所以在這裡檢查就夠即時。 */
function tickTutorial() {
    if (!tutorialActive())
        return;
    const step = TUTORIAL_STEPS[tutorialStep];
    if (!step)
        return;
    if (step.wait === 'gap') {
        const g = store.cmd.selectedGap;
        if (g && g.type === 'h' && g.line === 2)
            advanceTutorial();
    }
    else if (step.wait === 'block') {
        if (store.game.selected.size > 0)
            advanceTutorial();
    }
}
function advanceTutorial() {
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
function tutorialOnMoved() {
    if (!tutorialActive())
        return;
    if (tutorialStep !== TUTORIAL_STEPS.length - 1)
        return;
    if (store.solved) {
        showToast('就是這樣！剩下的交給你了');
        endTutorial();
    }
    else {
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
let syncZoomSlider = () => { };
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
function raceInitialBlocks() {
    const all = store.cmd.history.snapshotAll();
    return all.length ? all[0].blocks : undefined;
}
// 供成績面板與 DNF
function recordDnf() {
    if (gameMode !== 'timed' || timer.state !== 'running')
        return;
    timer.dnf();
    records.add(store.currentM, store.currentN, store.currentStep, Math.round(timer.elapsedMs), store.cmd.stepCount, true, store.numbered, raceInitialBlocks());
    showToast('DNF');
    schedulePaint();
}
// 右側開關狀態
let selectionAnimationEnabled = true;
let recordsVisible = false;
// 控制模式
let singleTouch = true;
let twoTouch = true;
let keyboardMouse = true;
const switchStates = [
    { key: 'animation_enabled', label: '滑动动画', get: () => controller.animationEnabled, set: (v) => { controller.animationEnabled = v; } },
    { key: 'selection_animation_enabled', label: '选中动画', get: () => selectionAnimationEnabled, set: (v) => { selectionAnimationEnabled = v; } },
    { key: 'coloring_enabled', label: '着色', get: () => renderer.coloringEnabled, set: (v) => { renderer.coloringEnabled = v; schedulePaint(); } },
    { key: 'chain_hint_enabled', label: '连锁', get: () => renderer.chainHintEnabled, set: (v) => { renderer.chainHintEnabled = v; schedulePaint(); } },
    { key: 'arrows_enabled', label: '箭头', get: () => renderer.arrowEnabled, set: (v) => { renderer.arrowEnabled = v; schedulePaint(); } },
    { key: 'game_mode', label: '模式', get: () => gameMode === 'timed', set: (v) => { if (timer.state === 'running') {
            showToast('計時中無法切換模式');
            return;
        } gameMode = v ? 'timed' : 'practice'; timer.cancel(); showToast(v ? '計時模式：打亂後需按空格開始' : '練習模式：可自由滑動，不計時'); schedulePaint(); } },
    // 對照原版右欄：滑動動畫/選中動畫/著色/連鎖/標記/模式/成績。
    // 網頁版沒有「標記」（原版的作者內部工具），所以是 6 個；「成績」對應成績面板開關。
    { key: 'records_visible', label: '成绩', get: () => recordsVisible, set: (v) => { recordsVisible = v; recordsPanel.style.display = v ? '' : 'none'; if (v)
            renderRecordsPanel(); syncSwitches(); } },
];
function renderSwitch(s) {
    if (!s.el)
        return;
    const on = s.get();
    s.el.style.background = on ? COLORS.button_bg : COLORS.input_bg;
    s.el.style.color = on ? '#fff' : '#969696';
    const text = s.key === 'game_mode' ? `模式:${on ? '竞速' : '练习'}` : `${s.label}:${on ? '开' : '关'}`;
    s.el.textContent = text;
}
/** 開關被外部（選單等）改動後，統一刷新右欄顯示 */
function syncSwitches() {
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
function makeSlider(label, onChange) {
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
    function updateFromY(clientY) {
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
        onChange(ratio);
        knob.style.top = `${(1 - ratio) * rect.height - 6}px`;
    }
    track.addEventListener('mousedown', (e) => {
        updateFromY(e.clientY);
        const onMove = (ev) => updateFromY(ev.clientY);
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
let syncSpeedSlider = () => { };
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
let stickyOn = false;
function buildVK() {
    vkBody.innerHTML = '';
    const btn = (t, cb) => {
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
                if (!store.cmd.history.canUndo) {
                    window.clearInterval(iv);
                    return;
                }
                handleUndo();
            }, 200);
        }
        else
            handleUndo();
    });
    const redoBtn = btn('重做', () => {
        if (stickyOn) {
            const iv = window.setInterval(() => {
                if (!store.cmd.history.canRedo) {
                    window.clearInterval(iv);
                    return;
                }
                handleRedo();
            }, 200);
        }
        else
            handleRedo();
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
        if (!Number.isInteger(idx)) {
            showToast('請輸入步數');
            return;
        }
        if (store.cmd.history.jumpTo(store.game, idx)) {
            store.cmd.stepCount = idx;
            autosave(store);
            schedulePaint();
            showToast('已跳到第 ' + idx + ' 步');
        }
        else
            showToast('步數超出範圍');
    });
    jumpRow.append(jumpInput, jumpBtn);
    vkBody.append(pad, actionRow, jumpRow);
}
function toggleVK() {
    const vis = vkPanel.style.display === 'none';
    vkPanel.style.display = vis ? '' : 'none';
    if (vis)
        buildVK();
    showToast(vis ? '已開啟虛擬鍵盤' : '已關閉虛擬鍵盤');
}
// ---------- 成績面板 ----------
/** 面板展開哪一條 / 哪一條正在等待「再點一次確認刪除」 */
let recordsDetailId = null;
let recordsPendingDeleteId = null;
/** 換了謎題分組就收起展開與待確認狀態，免得殘留指向別組的 id */
let recordsRenderedKey = null;
function renderRecordsPanel() {
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
    const fmt = (v) => v === null ? '-' : v === 'DNF' ? 'DNF' : formatTime(v);
    const title = document.createElement('div');
    title.textContent = `成績：${key}`;
    title.style.marginBottom = '6px';
    title.style.color = COLORS.dialog_title;
    recordsBody.appendChild(title);
    // 摘要：對照原版 panel 的顶部统计区（多了原版也有的 mean）
    const sum = document.createElement('div');
    sum.style.lineHeight = '1.6';
    sum.textContent =
        `次數 ${s.count} ｜ 最佳 ${fmt(s.best)} ｜ 最差 ${fmt(s.worst)} ｜ 平均 ${fmt(s.mean)} ｜ DNF ${s.dnf_count}`;
    recordsBody.appendChild(sum);
    const sum2 = document.createElement('div');
    sum2.style.marginBottom = '6px';
    sum2.textContent = `Ao5 ${fmt(s.ao5)} ｜ Ao12 ${fmt(s.ao12)}`;
    recordsBody.appendChild(sum2);
    if (rows.length === 0) {
        const empty = document.createElement('div');
        empty.style.color = '#888';
        empty.textContent = '尚無成績記錄';
        recordsBody.appendChild(empty);
        return;
    }
    // 表頭（原版是「序号 / 单次 / Ao5 / Ao12」三列）
    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.fontSize = '11px';
    head.style.color = '#888';
    head.style.paddingBottom = '2px';
    head.style.borderBottom = `1px solid ${COLORS.separator}`;
    head.innerHTML =
        '<span style="width:28px">#</span>'
            + '<span style="width:74px">單次</span>'
            + '<span style="width:74px">Ao5</span>'
            + '<span style="width:74px">Ao12</span>'
            + '<span style="flex:1"></span>';
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
        main.innerHTML =
            `<span style="width:28px;color:#888">${i + 1}</span>`
                + `<span style="width:74px">${row.item.dnf ? 'DNF' : formatTime(row.item.time_ms)}</span>`
                + `<span style="width:74px">${fmt(row.ao5)}</span>`
                + `<span style="width:74px">${fmt(row.ao12)}</span>`;
        if (row.item.dnf)
            main.style.color = '#cc6666';
        if (recordsDetailId === row.item.id)
            main.style.color = '#7fb3ff';
        recordsBody.appendChild(main);
        // 展開詳情：對照原版「點擊行顯示初始局面 / 生成時間 / 步數 / TPS」
        if (recordsDetailId === row.item.id) {
            const detail = document.createElement('div');
            detail.style.padding = '4px 0 6px 8px';
            detail.style.fontSize = '11px';
            detail.style.lineHeight = '1.7';
            const t = new Date(row.item.ts);
            const pad = (v) => String(v).padStart(2, '0');
            const when = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} `
                + `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
            const meta = document.createElement('div');
            meta.textContent =
                `${when} ｜ ${row.item.moves} 步 ｜ TPS ${tpsOf(row.item).toFixed(2)}`;
            detail.appendChild(meta);
            if (row.item.initial && row.item.initial.length) {
                const map = document.createElement('div');
                map.style.fontFamily = 'Consolas, Menlo, monospace';
                map.style.fontSize = '9px';
                map.style.lineHeight = '1.05';
                map.style.marginTop = '4px';
                map.textContent = blocksToMap(row.item.initial).join('\n');
                map.style.whiteSpace = 'pre';
                detail.appendChild(map);
            }
            else {
                const noInit = document.createElement('div');
                noInit.style.color = '#777';
                noInit.textContent = '（這筆沒有記到開局局面，舊版記錄才會這樣）';
                detail.appendChild(noInit);
            }
            recordsBody.appendChild(detail);
        }
        // 操作區：刪除（二次確認，對照原版：不支持編輯，只支持刪除）
        const ops = document.createElement('div');
        ops.style.display = 'flex';
        ops.style.gap = '8px';
        ops.style.padding = '2px 0 6px 28px';
        const del = document.createElement('span');
        del.style.cursor = 'pointer';
        del.style.fontSize = '11px';
        const pending = recordsPendingDeleteId === row.item.id;
        del.textContent = pending ? '再點一次確認刪除' : '刪除';
        del.style.color = pending ? '#ff6b6b' : '#888';
        del.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (recordsPendingDeleteId !== row.item.id) {
                recordsPendingDeleteId = row.item.id;
                renderRecordsPanel();
                return;
            }
            records.delete(key, row.item.id);
            if (recordsDetailId === row.item.id)
                recordsDetailId = null;
            recordsPendingDeleteId = null;
            renderRecordsPanel();
        });
        ops.appendChild(del);
        recordsBody.appendChild(ops);
        main.addEventListener('click', () => {
            recordsDetailId = recordsDetailId === row.item.id ? null : row.item.id;
            recordsPendingDeleteId = null;
            renderRecordsPanel();
        });
    });
}
function toggleRecords() {
    const vis = !recordsVisible;
    recordsVisible = vis;
    recordsPanel.style.display = vis ? '' : 'none';
    if (vis)
        renderRecordsPanel();
    syncSwitches();
    showToast(vis ? '已開啟成績面板' : '已關閉成績面板');
}
// ---------- 共用動作 ----------
const DIR_DELTA_ANIM = { w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1] };
/** 依 move_info 建立只動「該步滑塊組」的完整過場陣列；找不到對應塊回 null */
function buildHistoryAnim(moveInfo, isUndo) {
    const game = store.game;
    const delta = DIR_DELTA_ANIM[moveInfo.direction];
    if (!delta)
        return null;
    const step = moveInfo.step || store.currentStep;
    const start = game.blocks.map((b) => [b.row, b.col]);
    const end = start.map((p) => [p[0], p[1]]);
    const posToIdx = new Map();
    game.blocks.forEach((b, i) => posToIdx.set(`${b.row}:${b.col}`, i));
    for (const pre of moveInfo.moved_positions) {
        const post = [pre[0] + delta[0] * step, pre[1] + delta[1] * step];
        const idx = isUndo
            ? posToIdx.get(`${post[0]}:${post[1]}`)
            : posToIdx.get(`${pre[0]}:${pre[1]}`);
        if (idx === undefined)
            return null;
        end[idx] = isUndo ? [pre[0], pre[1]] : [post[0], post[1]];
    }
    return { start, end };
}
function blocksAtPositions(positions) {
    const map = new Map();
    store.game.blocks.forEach((b) => map.set(`${b.row}:${b.col}`, b));
    const set = new Set();
    for (const pos of positions) {
        const b = map.get(`${pos[0]}:${pos[1]}`);
        if (b)
            set.add(b);
    }
    return set;
}
function flashMoveSelection(moveInfo, isUndo, afterCommit) {
    if (!selectionAnimationEnabled || !moveInfo)
        return;
    const delta = DIR_DELTA_ANIM[moveInfo.direction];
    if (!delta)
        return;
    const step = moveInfo.step || store.currentStep;
    const targets = [];
    for (const pre of moveInfo.moved_positions) {
        const post = [pre[0] + delta[0] * step, pre[1] + delta[1] * step];
        const pos = afterCommit ? (isUndo ? pre : post) : (isUndo ? post : pre);
        targets.push(pos);
    }
    const sel = blocksAtPositions(targets);
    if (sel.size === 0)
        return;
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
const historyAnimQueue = [];
let historyAnimBusy = false;
function requestHistoryStep(kind) {
    const hist = store.cmd.history;
    if (kind === 'undo' && !hist.canUndo) {
        showToast('沒有可撤銷的步驟');
        return;
    }
    if (kind === 'redo' && !hist.canRedo) {
        showToast('沒有可重做的步驟');
        return;
    }
    historyAnimQueue.push(kind);
    processHistoryQueue();
}
function processHistoryQueue() {
    if (historyAnimBusy || historyAnimQueue.length === 0)
        return;
    historyAnimBusy = true;
    const kind = historyAnimQueue.shift();
    runHistoryAnimation(kind, () => {
        historyAnimBusy = false;
        processHistoryQueue();
    });
}
function runHistoryAnimation(kind, onDone) {
    const hist = store.cmd.history;
    const moveInfo = kind === 'undo' ? hist.currentMoveInfo() : hist.nextMoveInfo();
    const commit = () => {
        const r = kind === 'undo' ? undo(store.cmd) : redo(store.cmd);
        if (!r.ok) {
            showToast(r.message);
            onDone();
            return;
        }
        flashMoveSelection(moveInfo, kind === 'undo', true);
        autosave(store);
        schedulePaint();
        showToast(r.message);
        onDone();
    };
    if (!controller.animationEnabled) {
        commit();
        return;
    }
    let anim = moveInfo ? buildHistoryAnim(moveInfo, kind === 'undo') : null;
    if (!anim) {
        const target = kind === 'undo' ? hist.undoTarget() : hist.redoTarget();
        if (target) {
            const start = store.game.blocks.map((b) => [b.row, b.col]);
            anim = { start, end: target.blocks };
        }
    }
    if (!anim) {
        commit();
        return;
    }
    // 播放前：把該步滑塊組設為「選中」，動畫期間跟著移動（看起來像實時操作）
    if (moveInfo) {
        const delta = DIR_DELTA_ANIM[moveInfo.direction];
        const step = moveInfo.step || store.currentStep;
        const startPositions = kind === 'undo'
            ? moveInfo.moved_positions.map((pre) => [pre[0] + delta[0] * step, pre[1] + delta[1] * step])
            : moveInfo.moved_positions;
        store.game.selected = blocksAtPositions(startPositions);
        if (moveInfo.gap_type !== undefined && moveInfo.gap_line !== undefined) {
            store.cmd.selectedGap = { type: moveInfo.gap_type, line: moveInfo.gap_line };
        }
    }
    renderer.animation = { start: anim.start, end: anim.end, progress: 0, durationMs: controller.moveDurationMs };
    const t0 = performance.now();
    const frame = (now) => {
        const a = renderer.animation;
        if (!a)
            return;
        const p = Math.min(1, (now - t0) / a.durationMs);
        a.progress = p;
        schedulePaint();
        if (p < 1) {
            requestAnimationFrame(frame);
        }
        else {
            renderer.animation = null;
            commit();
        }
    };
    requestAnimationFrame(frame);
}
function handleUndo() {
    requestHistoryStep('undo');
    tutorial.onUndo();
}
function handleRedo() {
    requestHistoryStep('redo');
    tutorial.onRedo();
}
function handleShuffle() {
    if (gameMode === 'timed' && timer.state === 'running') {
        showToast('計時中無法打亂');
        return;
    }
    const r = shuffle(store.cmd, store.currentM * store.currentN * 10);
    showToast(r.message);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    if (gameMode === 'timed')
        timer.enterReady();
    else
        timer.cancel();
    schedulePaint();
}
function handleReset() {
    if (gameMode === 'timed' && timer.state === 'running') {
        showToast('計時中無法重置');
        return;
    }
    const r = reset(store.cmd);
    showToast(r.message);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    timer.cancel();
    schedulePaint();
}
function handleCustomPuzzle() {
    if (gameMode === 'timed' && timer.state === 'running') {
        showToast('計時中無法切換謎題');
        return;
    }
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
    const fields = [
        ['列數 m', String(store.currentM)],
        ['行數 n', String(store.currentN)],
        ['步距 step', String(store.currentStep)],
    ];
    const inputs = [];
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
        timer.cancel();
        schedulePaint();
        showToast(`切換謎題 ${step}~${m}*${n}`);
        overlay.remove();
    });
    btnRow.append(cancel, ok);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    app.appendChild(overlay);
}
function handlePresetPuzzle(label) {
    if (gameMode === 'timed' && timer.state === 'running') {
        showToast('計時中無法切換謎題');
        return;
    }
    const m = Number(label.split('*')[0].split('~')[1]);
    const n = Number(label.split('*')[1]);
    const step = Number(label.split('~')[0]);
    store.newPuzzle(m, n, step);
    renderer.animation = null;
    centerCamera();
    autosave(store);
    timer.cancel();
    schedulePaint();
    showToast(`切換謎題 ${step}~${m}*${n}`);
}
function setGameMode(mode) {
    if (mode !== 'practice' && timer.state === 'running') {
        showToast('計時中無法切換模式');
        return;
    }
    // 離開創造模式時收起其面板
    if (mode !== 'creative')
        creative.exit();
    gameMode = mode;
    timer.cancel();
    if (mode === 'timed')
        showToast('計時模式：打亂後需按空格開始');
    else if (mode === 'creative')
        showToast('創造模式：生成謎題後自由還原');
    else
        showToast('練習模式：可自由滑動，不計時');
    schedulePaint();
}
/** 標成完整版專屬：體驗版保留選單位階，但明確告知做不到，引導去下載。 */
const pro = (text) => ({ text, pro: true });
/** 開外部連結（官網各頁、源碼庫）。 */
const link = (text, href) => ({ text, href });
/** 數字形態選單項的兩種文字（開關式，寫法對照「模式:练习 / 模式:竞速」）。 */
const NUMBERED_ITEM_OFF = '數字形態:关';
const NUMBERED_ITEM_ON = '數字形態:开';
// ---------- 求解器（聚攏 + 填洞補缺）----------
/**
 * 求解器是「盡力而為」：
 *  - 小／中型謎題與輕度打亂大多能解（4×4 約七~八成、5×5 約五成）；
 *  - 6×6 以上的重度打亂常常解不出來；
 *  - 而且本遊戲**存在合法但永遠還原不了的死局**，解不出來不代表程式有錯。
 * 因此失敗時一律如實告知，不假裝有解。
 */
function currentBlocks() {
    return store.game.blocks.map((b) => [b.row, b.col]);
}
/** 提示一步：只幫玩家選好縫與塊（箭頭會自己出現），不代勞移動。 */
function hintOneStep() {
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
async function autoSolve() {
    if (solving)
        return;
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
    }
    finally {
        solving = false;
    }
    if (!res.solved || res.actions.length === 0) {
        showToast('没能解出来（求解器尽力而为；也可能是真踩到死局）');
        return;
    }
    showToast(`找到 ${res.steps} 步解法，开始演示`);
    await playSolverActions(res.actions);
}
/** 依序回放走法：每步都走選縫隙 → 點塊 → 推，與玩家手動操作完全一致。 */
async function playSolverActions(actions) {
    const gapMs = controller.moveDurationMs + 90;
    for (const a of actions) {
        selectGap(store.cmd, a.gapType, a.line);
        selectBlock(store.cmd, a.seed[0], a.seed[1]);
        controller.move(a.dir);
        await new Promise((r) => setTimeout(r, gapMs));
        if (store.game.is_solved())
            break;
    }
    schedulePaint();
    if (store.game.is_solved())
        showToast('已还原');
}
const menus = [
    { label: '文件', items: ['打开 Ctrl+O', '保存 Ctrl+S', '另存为...', '---', '存檔列表...'], handler: (item) => {
            if (item.includes('另存')) {
                saveAs(store);
                showToast('另存為...');
            }
            else if (item.includes('保存')) {
                downloadSave(store);
                showToast('已下載存檔');
            }
            else if (item.includes('打开'))
                fileInput.click();
            else if (item.includes('存檔列表'))
                openSaveList();
        }
    },
    { label: '编辑', items: ['撤销 Ctrl+Z', '重做 Ctrl+X', '打乱 Alt+S', '重置 Ctrl+R', '---', pro('自动求解 Ctrl+Alt+S')], handler: (item) => {
            if (item.startsWith('撤销'))
                handleUndo();
            else if (item.startsWith('重做'))
                handleRedo();
            else if (item.startsWith('打乱'))
                handleShuffle();
            else if (item.startsWith('重置'))
                handleReset();
        }
    },
    // 數字形態是方形底板加編號，規則與方形完全相同，體驗版也能做；
    // 三角 / 米字要另一套座標與畫法，仍留在完整版。
    { label: '谜题', items: ['2~4*4', '2~5*5', '2~6*6', '2~7*7', '2~8*8', '2~9*9', '2~10*10', '---', '3~6*6', '3~7*7', '3~8*8', '3~9*9', '3~10*10', '---', '自定义...', '模式:练习', '模式:竞速', '模式:创造', '---', NUMBERED_ITEM_OFF, pro('三角形態...'), pro('米字形態...'), '---', '提示一步', '自动求解'], handler: (item) => {
            if (item === '自定义...')
                handleCustomPuzzle();
            else if (item === '模式:练习')
                setGameMode('practice');
            else if (item === '模式:竞速')
                setGameMode('timed');
            else if (item === '模式:创造')
                creative.enter();
            else if (item === '提示一步')
                hintOneStep();
            else if (item === '自动求解')
                void autoSolve();
            else if (item.startsWith('數字形態'))
                toggleNumbered();
            else if (item !== '---')
                handlePresetPuzzle(item);
        }
    },
    { label: '宏定义', items: [pro('开始录制 Ctrl+M'), pro('停止录制 Ctrl+M'), '---', pro('宏列表...'), pro('播放宏...'), pro('逆序播放...')] },
    { label: '设置', items: ['虚拟键盘', '成绩面板', '控制模式...', '---', pro('求解器...'), pro('快捷键设置...')], handler: (item) => {
            if (item.includes('虚拟键盘'))
                toggleVK();
            else if (item.includes('成绩'))
                toggleRecords();
            else if (item.includes('控制模式'))
                openSettingsModal();
        }
    },
    { label: '帮助', items: ['关于', '新手引导', '---', link('玩法詳解', `${HOME_URL}guide.html`), link('更新日誌', `${HOME_URL}update_info.html`)], handler: (item) => {
            if (item.includes('关于'))
                showToast('貓九的滑塊遊戲 網頁體驗版 v0.1');
            else if (item.includes('新手引导'))
                startTutorial();
        }
    },
    { label: '教程', items: ['新手教程', '教程关卡...', '---', link('玩法詳解（網頁）', `${HOME_URL}guide.html`)], handler: (item) => {
            if (item.includes('新手教程') || item.includes('教程关卡'))
                tutorial.openLevelSelect();
        } },
    { label: '官网', items: [link('首頁', HOME_URL), link('下載完整版', FULL_VERSION_URL), '---', link('GitHub 源碼', 'https://github.com/Gatennea/GatenneaSlider')] },
];
let activeMenu = null;
/** 選單列最右側的「下載完整版」入口；buildMenu 每次重建後會把它重新釘到最右。 */
let ctaEl = null;
function ensureCta() {
    if (!ctaEl) {
        const cta = document.createElement('a');
        cta.textContent = '免費下載完整版';
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
        cta.title = '三角／米字形態、宏定義都在完整版裡，一樣免費開源';
        ctaEl = cta;
    }
    // 每次都重掛一次：appendChild 會把既有節點移到最後，
    // 這樣選單項重建後 cta 仍是最後一個，margin-left:auto 才能正確把它推到右端。
    menuBar.appendChild(ctaEl);
    return ctaEl;
}
/** 讓選單文字跟著目前狀態走（切換後要重畫選單才看得到）。 */
function refreshNumberedMenuItem() {
    const items = menus[2].items;
    const at = items.findIndex((it) => typeof it === 'string' && it.startsWith('數字形態'));
    if (at >= 0)
        items[at] = store.numbered ? NUMBERED_ITEM_ON : NUMBERED_ITEM_OFF;
}
function toggleNumbered() {
    if (gameMode === 'timed' && timer.state === 'running') {
        showToast('計時中無法切換形態');
        return;
    }
    store.setNumbered(!store.numbered);
    showToast(store.numbered ? '數字形態：開（滑塊帶編號，照數字排回去）' : '數字形態：關');
    refreshNumberedMenuItem();
    buildMenu();
    updateStatus();
    schedulePaint();
}
function closeAllMenus() {
    app.querySelectorAll('[data-dropdown]').forEach((el) => el.remove());
    activeMenu = null;
}
function buildMenu() {
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
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            if (activeMenu === idx) {
                closeAllMenus();
                return;
            }
            closeAllMenus();
            const dd = document.createElement('div');
            dd.dataset['dropdown'] = '1';
            dd.style.position = 'absolute';
            dd.style.top = `${GEOMETRY.menu_bar_height}px`;
            dd.style.background = COLORS.menu_bg;
            dd.style.border = `1px solid ${COLORS.dialog_border}`;
            // 下拉選單掛在 #app 下，#app 沒設 color → 文字會繼承瀏覽器預設黑色；
            // 顯式鎖成 menu_text（淡灰），與選單列一致，避免「一會黑一會白」。
            dd.style.color = COLORS.menu_text;
            dd.style.minWidth = '220px';
            dd.style.zIndex = '1000';
            dd.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
            // 窄屏保護：寬度不超過畫面，高度不超過棋盤區，超出就自己捲
            dd.style.maxWidth = 'calc(100vw - 8px)';
            dd.style.maxHeight = `calc(100vh - ${GEOMETRY.menu_bar_height + GEOMETRY.status_bar_height + 8}px)`;
            dd.style.overflowY = 'auto';
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
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '10px';
                row.style.padding = '6px 12px';
                row.style.cursor = 'pointer';
                row.style.fontSize = '13px';
                const text = typeof mi === 'string' ? mi : mi.text;
                const opt = typeof mi === 'string' ? null : mi;
                const label = document.createElement('span');
                label.textContent = text;
                label.style.flex = '1 1 auto';
                row.appendChild(label);
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
                else {
                    row.addEventListener('click', () => { closeAllMenus(); menu.handler?.(text); });
                }
                row.addEventListener('mouseenter', () => { row.style.background = COLORS.menu_hover; });
                row.addEventListener('mouseleave', () => { row.style.background = ''; });
                dd.appendChild(row);
            });
            app.appendChild(dd);
            // 對齊被點的選單項目，再夾住右邊界：否則窄屏點最右幾個選單，下拉會開在畫面外
            const anchorLeft = item.getBoundingClientRect().left - app.getBoundingClientRect().left;
            const maxLeft = Math.max(4, window.innerWidth - dd.offsetWidth - 4);
            dd.style.left = `${Math.min(anchorLeft, maxLeft)}px`;
            activeMenu = idx;
        });
        menuBar.appendChild(item);
    });
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
function applyChromeDensity() {
    const narrow = window.innerWidth < 520;
    const fontSize = narrow ? '12px' : '13px';
    const menuPad = narrow ? '0 6px' : '0 14px';
    menuBar.querySelectorAll('[data-menu-item]').forEach((el) => {
        el.style.fontSize = fontSize;
        el.style.padding = menuPad;
    });
    status.style.fontSize = fontSize;
    status.style.gap = narrow ? '10px' : '24px';
    status.style.overflowX = 'auto';
}
// ---------- 控制模式設定 ----------
function openSettingsModal() {
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
    const modes = [
        { key: 'singleTouch', label: '單次觸控', desc: '直接拖拽滑塊即滑動，完成後清空選中' },
        { key: 'twoTouch', label: '兩次觸控', desc: '點縫隙 → 點方塊 → 再拖拽/鍵盤' },
        { key: 'keyboardMouse', label: '鼠標鍵盤控制', desc: '鍵盤 W/A/S/D、方向鍵、點選' },
    ];
    const renderRow = (m) => {
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
        const state = () => m.key === 'singleTouch' ? singleTouch : m.key === 'twoTouch' ? twoTouch : keyboardMouse;
        const refresh = () => { btn.textContent = state() ? '開' : '關'; btn.style.background = state() ? COLORS.button_bg : COLORS.input_bg; };
        refresh();
        btn.addEventListener('click', () => {
            const v = !state();
            if (m.key === 'singleTouch')
                singleTouch = v;
            else if (m.key === 'twoTouch')
                twoTouch = v;
            else
                keyboardMouse = v;
            controller.singleTouchEnabled = singleTouch;
            controller.twoTouchEnabled = twoTouch;
            controller.keyboardMouseEnabled = keyboardMouse;
            refresh();
        });
        row.append(info, btn);
        return row;
    };
    modes.forEach((m) => box.appendChild(renderRow(m)));
    const close = document.createElement('button');
    close.textContent = '關閉';
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
function openSaveList() {
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
    title.textContent = '存檔列表（本機瀏覽器）';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '4px';
    box.appendChild(title);
    const nameRow = document.createElement('div');
    nameRow.style.display = 'flex';
    nameRow.style.gap = '6px';
    const nameInput = document.createElement('input');
    nameInput.placeholder = '輸入存檔名稱';
    nameInput.style.flex = '1';
    nameInput.style.background = COLORS.input_bg;
    nameInput.style.color = COLORS.input_text;
    nameInput.style.border = '1px solid ' + COLORS.border;
    nameInput.style.borderRadius = '4px';
    nameInput.style.padding = '6px';
    const addBtn = document.createElement('button');
    addBtn.textContent = '新增存檔';
    addBtn.style.background = COLORS.button_bg;
    addBtn.style.color = '#fff';
    addBtn.style.border = 'none';
    addBtn.style.borderRadius = '4px';
    addBtn.style.padding = '6px 10px';
    addBtn.style.cursor = 'pointer';
    addBtn.addEventListener('click', () => {
        const slot = saveSlot(nameInput.value || '未命名存檔', store);
        if (slot) {
            nameInput.value = '';
            renderList();
            showToast('已新增存檔');
        }
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
            empty.textContent = '尚無存檔';
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
            const mk = (label, cb) => {
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
            btnRow.append(mk('讀取', () => {
                if (gameMode === 'timed') {
                    showToast('競速模式中無法讀取存檔');
                    return;
                }
                if (loadSlot(slot.id, store)) {
                    renderer.animation = null;
                    centerCamera();
                    autosave(store);
                    schedulePaint();
                    showToast('已讀取 ' + slot.name);
                }
                else
                    showToast('讀取失敗');
            }), mk('覆蓋', () => {
                if (updateSlot(slot.id, store)) {
                    renderList();
                    showToast('已覆蓋 ' + slot.name);
                }
            }), mk('刪除', () => {
                deleteSlot(slot.id);
                renderList();
                showToast('已刪除');
            }));
            row.append(info, btnRow);
            listEl.appendChild(row);
        });
    };
    renderList();
    const close = document.createElement('button');
    close.textContent = '關閉';
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
    if (gameMode === 'timed') {
        showToast('競速模式中無法打開存檔');
        fileInput.value = '';
        return;
    }
    const f = fileInput.files?.[0];
    if (!f)
        return;
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
    if (e.key === 'Escape') {
        closeAllMenus();
        return;
    }
    if (ctrl && key === 'z') {
        e.preventDefault();
        if (e.shiftKey)
            handleRedo();
        else
            handleUndo();
        return;
    }
    if (ctrl && key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
    }
    if (ctrl && key === 'x') {
        e.preventDefault();
        handleRedo();
        return;
    }
    if (ctrl && key === 's') {
        e.preventDefault();
        downloadSave(store);
        showToast('已下載存檔');
        return;
    }
    if (ctrl && key === 'o') {
        e.preventDefault();
        fileInput.click();
        return;
    }
    if (ctrl && key === 'r') {
        e.preventDefault();
        handleReset();
        return;
    }
    if (e.altKey && key === 's') {
        e.preventDefault();
        handleShuffle();
        return;
    }
    if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (gameMode === 'timed') {
            if (timer.state === 'idle') {
                showToast('請先使用打亂功能');
            }
            else if (timer.state === 'ready') {
                timer.start();
                showToast('計時開始');
                schedulePaint();
            }
            else if (timer.state === 'running') {
                recordDnf();
            }
        }
        return;
    }
    if (e.key === 'F1') {
        e.preventDefault();
        toggleVK();
        return;
    }
    if (e.key === 'F3') {
        e.preventDefault();
        toggleRecords();
        return;
    }
});
document.addEventListener('click', (e) => {
    if (!e.target.closest('#menuBar, [data-dropdown]'))
        closeAllMenus();
});
// ---------- 初始化 ----------
buildMenu();
buildVK();
layoutCanvas();
window.addEventListener('resize', () => { closeAllMenus(); applyChromeDensity(); layoutCanvas(); syncZoomSlider(); syncSpeedSlider(); schedulePaint(); });
// ---------- 首頁玩法演示模式（?demo=存檔路徑） ----------
const demoFile = new URLSearchParams(window.location.search).get('demo');
function followDemoCamera() {
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
    }
    else {
        for (const b of blocks) {
            minRow = Math.min(minRow, b.row);
            maxRow = Math.max(maxRow, b.row);
            minCol = Math.min(minCol, b.col);
            maxCol = Math.max(maxCol, b.col);
        }
    }
    if (!Number.isFinite(minRow) || !Number.isFinite(minCol))
        return;
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
function demoTick() {
    if (!demoPlaying)
        return;
    if (store.cmd.history.canRedo) {
        handleRedo();
        setTimeout(demoTick, 200);
    }
    else {
        // 播完回到起點；畫面由 followDemoCamera 持續置中，因此首尾兩個還原矩形無縫銜接
        store.cmd.history.setIndex(0);
        store.cmd.stepCount = 0;
        schedulePaint();
        setTimeout(demoTick, 800);
    }
}
if (demoFile) {
    const startDemo = (p) => {
        if (!store.deserialize(p)) {
            showToast('演示存檔無法載入');
            return;
        }
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
    const inlineDemo = window.DEMO_SAVE ?? null;
    if (inlineDemo) {
        startDemo(inlineDemo);
    }
    else {
        fetch(demoFile)
            .then((r) => r.json())
            .then(startDemo)
            .catch(() => showToast('無法載入演示存檔'));
    }
}
else if (autoload(store)) {
    centerCamera();
    showToast('已恢復上次進度');
}
else if (!tutorialSeen()) {
    // 第一次來、又沒有舊進度：打開章節教程（新手教程）選關，帶著由淺入深地玩
    tutorial.openLevelSelect();
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

return {};
},
    "m1": function (require) {
/**
 * Canvas 棋盤渲染（M2：命中測試 + 選中縫隙紅線 + camera/zoom + 移動動畫）。
 *
 * 座標模型（對照 GUI.py，唯一真理源）：
 *   - CELL = base_cell_size、GAP = gap_width（未縮放基底）
 *   - 世界座標以「像素」為單位：滑塊(col,row) 左上角 = (col*(CELL+GAP), row*(CELL+GAP))
 *   - 世界 → 螢幕：screen = world * zoom + camera（不重複乘 zoom）
 *   - 縫隙 h line：y = (line+1)*(CELL+GAP) - GAP/2；v 同理
 */
const { COLORS, GEOMETRY, easeOut, FONT_FAMILY } = require("./theme.js");
const { DIRECTION_DELTA, VALID_DIRECTIONS_FOR_GAP } = require("../core/rules.js");
const { ARROW_IMAGE_DATA_URI } = require("./arrowImage.js");
const CELL = GEOMETRY.base_cell_size;
const GAP = GEOMETRY.gap_width;
function hsvToRgb(h, s, v) {
    const c = v * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hp < 1) {
        r = c;
        g = x;
    }
    else if (hp < 2) {
        r = x;
        g = c;
    }
    else if (hp < 3) {
        g = c;
        b = x;
    }
    else if (hp < 4) {
        g = x;
        b = c;
    }
    else if (hp < 5) {
        r = x;
        b = c;
    }
    else {
        r = c;
        b = x;
    }
    const m = v - c;
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
/** 把 rgb(r, g, b) 往白色提亮 amount（0~1），對照原版 _lighten。 */
function lightenCss(color, amount) {
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!m)
        return color;
    const ch = [Number(m[1]), Number(m[2]), Number(m[3])].map((c) => Math.round(c + (255 - c) * amount));
    return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}
class BoardRenderer {
    constructor(ctx, zoom = 1) {
        this.animation = null;
        /** 選中動畫：短暫高亮的格子集合（undo/redo 時顯示移動過的組） */
        this.highlightCells = null;
        /** 創造模式自定義目標形狀的「虛影」：把目標格（且當前未被佔用）畫成淡藍虛線框。 */
        this.solutionMask = null;
        /** 著色器：按 (r%step,c%step) 給滑塊描邊同色 */
        this.coloringEnabled = false;
        /** 連鎖器：懸停時提亮同組位置（含空格） */
        this.chainHintEnabled = false;
        /** 目前懸停格（棋盤座標；可為空格） */
        this.hoverCell = null;
        this.lastBounds = null;
        // ---- 箭頭按鍵（復刻原版 S1-4：選中縫隙 + 選中組後，切片兩端各一個可點箭頭）----
        /** 箭頭按鍵總開關（原版 arrows_enabled，預設開）。 */
        this.arrowEnabled = true;
        this.arrowImage = null;
        this.arrowSpriteCache = new Map();
        /** 每幀重算的命中矩形，供點擊檢測複用同一套幾何（原版 _arrow_buttons）。 */
        this.arrowButtons = [];
        /** 上次點中滑塊的「世界座標」，作為箭頭錨點（原版 _gap_anchor_world）。 */
        this.lastBlockClickWorld = null;
        // ---- 點擊漣漪反饋（原版 spawn_click_feedback / draw_click_feedback）----
        this.clickFeedback = [];
        /** 漣漪存活期間持續重繪用的回調（main 注入 schedulePaint）。 */
        this.repaint = null;
        this.ctx = ctx;
        this.zoom = zoom;
        this.cameraX = 0;
        this.cameraY = 0;
        this.loadArrowImage();
    }
    /** 懶加載原版 arrow_B.png（已內聯為 Data URI，無 file:// 污染問題）。 */
    loadArrowImage() {
        // Node 測試環境沒有 Image 構造器；箭頭貼圖只在瀏覽器裡載入
        if (typeof Image === 'undefined' || this.arrowImage)
            return;
        const img = new Image();
        img.onload = () => { this.arrowImage = img; this.repaint?.(); };
        img.src = ARROW_IMAGE_DATA_URI;
    }
    /** 分組描邊色：由 (r%step, c%step) 唯一決定（對照原版 _group_color）。 */
    groupColor(r, c, step) {
        const k = ((r % step) + step) % step * step + ((c % step) + step) % step;
        const n = step * step;
        let hue;
        if (n <= 16)
            hue = (k * 360) / n;
        else
            hue = ((k * 0.618033988749895) % 1) * 360;
        const [rr, gg, bb] = hsvToRgb(hue, 0.75, 0.92);
        return `rgb(${rr}, ${gg}, ${bb})`;
    }
    /** 連鎖提示格（含空格）：邊界盒內與懸停格同 (r%step,c%step) 的位置。 */
    chainHintCells(step) {
        if (!this.chainHintEnabled || !this.hoverCell || step <= 1)
            return null;
        const [hr, hc] = this.hoverCell;
        const b = this.lastBounds;
        if (!b)
            return null;
        if (hr < b.min_row - 1 || hr > b.max_row + 1 || hc < b.min_col - 1 || hc > b.max_col + 1)
            return null;
        const cells = new Set();
        for (let r = b.min_row; r <= b.max_row; r++) {
            for (let c = b.min_col; c <= b.max_col; c++) {
                if (((r % step) + step) % step === ((hr % step) + step) % step &&
                    ((c % step) + step) % step === ((hc % step) + step) % step) {
                    cells.add(`${r}:${c}`);
                }
            }
        }
        return { cells, hover: [hr, hc] };
    }
    get cell() {
        return CELL;
    }
    get gap() {
        return GAP;
    }
    get step() {
        return CELL + GAP;
    }
    /** 畫布上一個格的實際大小（含 zoom） */
    get scaledCell() {
        return CELL * this.zoom;
    }
    get scaledGap() {
        return GAP * this.zoom;
    }
    /** 供 main 置中用的週期（含縮放） */
    get stepPx() {
        return this.step * this.zoom;
    }
    /** 世界 → 螢幕。對照 GUI.world_to_screen（world*zoom + camera）。 */
    worldToScreen(worldX, worldY) {
        return [worldX * this.zoom + this.cameraX, worldY * this.zoom + this.cameraY];
    }
    /** 螢幕 → 世界。對照 GUI.screen_to_world。 */
    screenToWorld(screenX, screenY) {
        return [(screenX - this.cameraX) / this.zoom, (screenY - this.cameraY) / this.zoom];
    }
    /** 滑塊世界左上角。 */
    blockOrigin(r, c) {
        return [c * this.step, r * this.step];
    }
    /** 根據畫布座標取得滑塊。對照 GUI.get_block_at_pos。 */
    getBlockAtPos(screenX, screenY, store) {
        const [wx, wy] = this.screenToWorld(screenX, screenY);
        for (const block of store.game.blocks) {
            const [bx, by] = this.blockOrigin(block.row, block.col);
            if (wx >= bx && wx < bx + CELL && wy >= by && wy < by + CELL) {
                return block;
            }
        }
        return null;
    }
    /** 根據畫布座標取得格座標 (r,c)，落在縫隙上回 null。對照 GUI.get_cell_at_pos。 */
    getCellAtPos(screenX, screenY) {
        const [wx, wy] = this.screenToWorld(screenX, screenY);
        const step = this.step;
        const c = Math.floor(wx / step);
        const r = Math.floor(wy / step);
        if (wx - c * step >= CELL || wy - r * step >= CELL) {
            return null;
        }
        return [r, c];
    }
    /** 根據畫布座標取得縫隙。對照 GUI.get_gap_at_pos。 */
    getGapAtPos(screenX, screenY, store) {
        const [wx, wy] = this.screenToWorld(screenX, screenY);
        const bounds = store.game.get_boundaries();
        const { min_row, max_row, min_col, max_col } = bounds;
        const gap = GAP;
        const tolerance = gap + 10;
        for (let i = min_row; i <= max_row + 1; i++) {
            const gapY = i * this.step - gap / 2;
            if (Math.abs(wy - gapY) < tolerance) {
                const boardLeft = min_col * this.step;
                const boardRight = (max_col + 1) * this.step;
                if (boardLeft - 50 < wx && wx < boardRight + 50) {
                    const line = i - 1;
                    if (store.game.is_valid_h_line(line))
                        return { type: 'h', line };
                }
            }
        }
        for (let j = min_col; j <= max_col + 1; j++) {
            const gapX = j * this.step - gap / 2;
            if (Math.abs(wx - gapX) < tolerance) {
                const boardTop = min_row * this.step;
                const boardBottom = (max_row + 1) * this.step;
                if (boardTop - 50 < wy && wy < boardBottom + 50) {
                    const line = j - 1;
                    if (store.game.is_valid_v_line(line))
                        return { type: 'v', line };
                }
            }
        }
        return null;
    }
    /** 空白區域 = 不在滑塊也不在縫隙。對照 GUI.is_blank_area。 */
    isBlankArea(screenX, screenY, store) {
        return (this.getBlockAtPos(screenX, screenY, store) === null &&
            this.getGapAtPos(screenX, screenY, store) === null);
    }
    draw(store) {
        const { ctx } = this;
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, W, H);
        const bounds = store.game.get_boundaries();
        this.lastBounds = bounds;
        const selectedGap = store.cmd.selectedGap;
        // 1) 無限網格背景
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (let r = bounds.min_row - 1; r <= bounds.max_row + 1; r++) {
            for (let c = bounds.min_col - 1; c <= bounds.max_col + 1; c++) {
                const [x, y] = this.worldToScreen(c * this.step, r * this.step);
                ctx.strokeRect(x, y, this.scaledCell, this.scaledCell);
            }
        }
        // 2) 縫隙線（先畫，讓滑塊蓋在上面；選中紅線、其餘灰線）
        this.drawGapLines(bounds, selectedGap);
        // 2.5) 創造模式目標虛影（畫在縫隙之上、滑塊之下；已被佔用的格子不畫）
        this.drawSolutionGhosts(store);
        // 3) 滑塊（動畫中則用插值位置；著色器描邊；連鎖器提亮）
        const hint = this.chainHintCells(store.currentStep);
        for (let idx = 0; idx < store.game.blocks.length; idx++) {
            const block = store.game.blocks[idx];
            let r = block.row;
            let c = block.col;
            if (this.animation) {
                const t = easeOut(this.animation.progress);
                const sr = this.animation.start[idx][0];
                const sc = this.animation.start[idx][1];
                const er = this.animation.end[idx][0];
                const ec = this.animation.end[idx][1];
                r = sr + (er - sr) * t;
                c = sc + (ec - sc) * t;
            }
            const [x, y] = this.worldToScreen(c * this.step, r * this.step);
            const key = `${Math.round(r)}:${Math.round(c)}`;
            const selected = store.game.selected.has(block);
            const hl = this.highlightCells !== null && this.highlightCells.has(key);
            let fill = selected || hl ? COLORS.block_selected : COLORS.block;
            if (hint && hint.cells.has(key)) {
                const amt = hint.hover[0] === Math.round(r) && hint.hover[1] === Math.round(c) ? 0.55 : 0.35;
                fill = lightenCss(fill, amt);
            }
            const radius = GEOMETRY.block_radius * this.zoom;
            if (this.coloringEnabled && store.currentStep > 1) {
                // 著色器：從滑塊邊緣向內畫一圈分組色（原版 pygame 邊框是向內畫的）
                const ring = Math.max(2, 6 * this.zoom);
                ctx.fillStyle = this.groupColor(Math.round(r), Math.round(c), store.currentStep);
                this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
                ctx.fill();
                const inner = Math.max(0, this.scaledCell - ring * 2);
                const innerRadius = Math.max(0, radius - ring);
                ctx.fillStyle = fill;
                this.roundRect(x + ring, y + ring, inner, inner, innerRadius);
                ctx.fill();
            }
            else {
                ctx.fillStyle = fill;
                this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
                ctx.fill();
                ctx.strokeStyle = COLORS.border;
                ctx.lineWidth = Math.max(1, GEOMETRY.block_border_width * this.zoom);
                this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
                ctx.stroke();
            }
            // 數字形態：編號畫在滑塊正中（對照原版 renderer 的數字繪製）
            // 太小就不畫，免得數字糊成一團
            if (block.number !== null && this.scaledCell >= 16) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.font = `600 ${Math.max(9, Math.round(this.scaledCell * 0.4))}px ${FONT_FAMILY}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(String(block.number), x + this.scaledCell / 2, y + this.scaledCell / 2);
            }
            if (this.highlightCells && this.highlightCells.has(key)) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                ctx.lineWidth = 2;
                this.roundRect(x, y, this.scaledCell, this.scaledCell, radius);
                ctx.stroke();
            }
        }
        // 4) 連鎖器：同組的空格也提亮（對照原版 _chain_hint_cells）
        if (hint) {
            const occupied = new Set(store.game.blocks.map((b) => `${b.row}:${b.col}`));
            for (const key of hint.cells) {
                if (occupied.has(key))
                    continue;
                const [r, c] = key.split(':').map(Number);
                const amt = r === hint.hover[0] && c === hint.hover[1] ? 0.55 : 0.35;
                const [x, y] = this.worldToScreen(c * this.step, r * this.step);
                ctx.fillStyle = lightenCss(COLORS.background, amt);
                this.roundRect(x, y, this.scaledCell, this.scaledCell, GEOMETRY.block_radius * this.zoom);
                ctx.fill();
            }
        }
        // 5) 箭頭按鍵（選中縫隙 + 選中組後，切片兩端各一個可點箭頭；動畫中不畫）
        this.drawGapDirectionArrows(store);
        // 6) 點擊漣漪反饋（最上層，蓋住所有內容）
        this.drawClickFeedback();
    }
    drawSolutionGhosts(store) {
        if (!this.solutionMask || this.solutionMask.size === 0)
            return;
        const occupied = new Set(store.game.blocks.map((b) => `${b.row}:${b.col}`));
        const { ctx } = this;
        ctx.save();
        ctx.strokeStyle = 'rgba(120,180,255,0.6)';
        ctx.lineWidth = Math.max(1, 2 * this.zoom);
        ctx.setLineDash([6, 4]);
        for (const key of this.solutionMask) {
            if (occupied.has(key))
                continue;
            const [r, c] = key.split(':').map(Number);
            const [x, y] = this.worldToScreen(c * this.step, r * this.step);
            this.roundRect(x, y, this.scaledCell, this.scaledCell, GEOMETRY.block_radius * this.zoom);
            ctx.stroke();
        }
        ctx.restore();
    }
    drawGapLines(bounds, selectedGap) {
        const { ctx } = this;
        const gap = this.scaledGap;
        const pad = 20; // 對照原版：縫隙向外多畫 20px，但只在棋盤範圍附近，不跨全屏
        // 棋盤實際左右/上下邊界（螢幕座標）
        const left = this.worldToScreen(bounds.min_col * this.step, 0)[0];
        const right = this.worldToScreen(bounds.max_col * this.step + CELL, 0)[0];
        const top = this.worldToScreen(0, bounds.min_row * this.step)[1];
        const bottom = this.worldToScreen(0, bounds.max_row * this.step + CELL)[1];
        // h（橫縫）：只在棋盤左右範圍（外擴 pad）
        for (let i = bounds.min_row; i <= bounds.max_row + 1; i++) {
            const sy = this.worldToScreen(0, i * this.step - GAP / 2)[1];
            const isSelected = !!selectedGap && selectedGap.type === 'h' && selectedGap.line === i - 1;
            ctx.strokeStyle = isSelected ? COLORS.line : COLORS.gap;
            ctx.lineWidth = isSelected ? GEOMETRY.selected_line_width : Math.max(1, gap);
            ctx.beginPath();
            ctx.moveTo(left - pad, sy);
            ctx.lineTo(right + pad, sy);
            ctx.stroke();
        }
        // v（縱縫）：只在棋盤上下範圍（外擴 pad）
        for (let j = bounds.min_col; j <= bounds.max_col + 1; j++) {
            const sx = this.worldToScreen(j * this.step - GAP / 2, 0)[0];
            const isSelected = !!selectedGap && selectedGap.type === 'v' && selectedGap.line === j - 1;
            ctx.strokeStyle = isSelected ? COLORS.line : COLORS.gap;
            ctx.lineWidth = isSelected ? GEOMETRY.selected_line_width : Math.max(1, gap);
            ctx.beginPath();
            ctx.moveTo(sx, top - pad);
            ctx.lineTo(sx, bottom + pad);
            ctx.stroke();
        }
    }
    roundRect(x, y, w, h, r) {
        const { ctx } = this;
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }
    // ---------------- S1-4 箭頭按鍵（復刻原版 gui/renderer.py） ----------------
    /** 按鍵邊長：只跟隨全域縮放，與方向無關（原版 _arrow_button_size）。 */
    arrowButtonSize() {
        return Math.max(18, Math.round(46 * this.zoom));
    }
    /** 旋轉後的箭頭貼圖快取（先縮放到 size、再旋轉，旋轉結果不二次縮放）。 */
    arrowSprite(angleRad) {
        const img = this.arrowImage;
        if (!img || !img.complete)
            return null;
        const size = this.arrowButtonSize();
        const key = `${size}_${Math.round((angleRad * 180) / Math.PI) % 360}`;
        const cache = this.arrowSpriteCache;
        if (cache.size > 96)
            cache.clear();
        const cached = cache.get(key);
        if (cached)
            return cached;
        const cv = document.createElement('canvas');
        cv.width = size;
        cv.height = size;
        const c = cv.getContext('2d');
        c.translate(size / 2, size / 2);
        c.rotate(angleRad);
        c.drawImage(img, -size / 2, -size / 2, size, size);
        cache.set(key, cv);
        return cv;
    }
    /**
     * 計算切片兩端的箭頭按鍵幾何（每幀重算，不快取幾何）。
     * 命中矩形寫入 this.arrowButtons，供點擊檢測複用同一套幾何。
     * 方向一律用 VALID_DIRECTIONS_FOR_GAP + DIRECTION_DELTA 推導，保證與
     * animateMove 實際移動一致；禁用方向（try_move 會失敗）直接不畫。
     */
    computeArrowButtons(store) {
        this.arrowButtons = [];
        if (!this.arrowEnabled)
            return;
        const gap = store.cmd.selectedGap;
        const sel = store.game.selected;
        if (!gap || sel.size === 0 || this.animation)
            return;
        const dirs = VALID_DIRECTIONS_FOR_GAP[gap.type];
        if (dirs.length !== 2)
            return;
        const size = this.arrowButtonSize();
        // dirs[0] 單步的螢幕位移單位向量 u（row 向下、col 向右）
        const d0 = DIRECTION_DELTA[dirs[0]];
        const ux = d0[1] * this.stepPx;
        const uy = d0[0] * this.stepPx;
        const ulen = Math.hypot(ux, uy) || 1;
        const uxN = ux / ulen;
        const uyN = uy / ulen;
        const px = -uyN; // 垂直於推行方向
        const py = uxN;
        // 選中滑塊的螢幕中心
        const centers = [];
        for (const b of store.game.blocks) {
            if (!sel.has(b))
                continue;
            const [sx, sy] = this.worldToScreen(b.col * this.step + CELL / 2, b.row * this.step + CELL / 2);
            centers.push([sx, sy]);
        }
        if (centers.length === 0)
            return;
        let hi;
        let lo;
        const anchor = this.lastBlockClickWorld;
        if (anchor) {
            // 鼠標點附近：兩個按鍵沿推行軸分居兩側（原版「不額外讓位」路徑）
            const [awx, awy] = this.worldToScreen(anchor[0], anchor[1]);
            const off = size * 0.8;
            hi = { x: awx + uxN * off, y: awy + uyN * off };
            lo = { x: awx - uxN * off, y: awy - uyN * off };
        }
        else {
            // 切片投影外沿中點 + 向外讓位（原版 use_pad 路徑）
            let tLo = Infinity, tHi = -Infinity;
            let sSum = 0;
            for (const [sx, sy] of centers) {
                const t = sx * uxN + sy * uyN;
                const s = sx * px + sy * py;
                if (t < tLo)
                    tLo = t;
                if (t > tHi)
                    tHi = t;
                sSum += s;
            }
            const sMid = sSum / centers.length;
            const hiPt = { x: uxN * tHi + px * sMid, y: uyN * tHi + py * sMid };
            const loPt = { x: uxN * tLo + px * sMid, y: uyN * tLo + py * sMid };
            const blockR = this.scaledCell / 2;
            const pad = Math.max(blockR + size / 2 + 4, blockR + size / 2 + blockR * 0.1);
            // 出屏收縮，保證按鍵可見
            let p = pad;
            const m = size / 2 + 4;
            const W = this.ctx.canvas.width;
            const H = this.ctx.canvas.height;
            const inside = (pt) => m <= pt.x && pt.x <= W - m && m <= pt.y && pt.y <= H - m;
            for (let k = 0; k < 6; k++) {
                const aHi = { x: hiPt.x + uxN * p, y: hiPt.y + uyN * p };
                const aLo = { x: loPt.x - uxN * p, y: loPt.y - uyN * p };
                if (inside(aHi) && inside(aLo))
                    break;
                p *= 0.65;
            }
            hi = { x: hiPt.x + uxN * p, y: hiPt.y + uyN * p };
            lo = { x: loPt.x - uxN * p, y: loPt.y - uyN * p };
        }
        // dirs[0] 指向 +u（hi 端），dirs[1] 指向 -u（lo 端）
        this.pushArrowButton(dirs[0], hi, uxN, uyN, store, size);
        this.pushArrowButton(dirs[1], lo, -uxN, -uyN, store, size);
    }
    pushArrowButton(dir, pt, vx, vy, store, size) {
        const W = this.ctx.canvas.width;
        const H = this.ctx.canvas.height;
        const x = Math.min(Math.max(pt.x, size / 2), W - size / 2);
        const y = Math.min(Math.max(pt.y, size / 2), H - size / 2);
        // 與點擊同判定路徑：該方向真走得動才畫（原版「禁用態不畫」）
        if (store.game.try_move(dir, store.currentStep) === null)
            return;
        const angle = Math.atan2(vy, vx);
        this.arrowButtons.push({ dir, x, y, size, angle });
    }
    /** 繪製選中縫隙兩端的箭頭按鍵（在滑塊之後呼叫）。 */
    drawGapDirectionArrows(store) {
        this.computeArrowButtons(store);
        if (this.arrowButtons.length === 0)
            return;
        const { ctx } = this;
        for (const b of this.arrowButtons) {
            const spr = this.arrowSprite(b.angle);
            if (!spr)
                continue;
            ctx.drawImage(spr, b.x - b.size / 2, b.y - b.size / 2);
        }
    }
    /** 點擊座標是否命中某個箭頭按鍵，回傳該端方向，否則 null（原版 _arrow_button_hit）。 */
    hitArrowButton(x, y) {
        for (const b of this.arrowButtons) {
            if (Math.abs(x - b.x) <= b.size / 2 && Math.abs(y - b.y) <= b.size / 2)
                return b.dir;
        }
        return null;
    }
    // ---------------- 點擊漣漪反饋（復刻原版 spawn/draw_click_feedback） ----------------
    /** 記錄一次點擊的漣漪（在事件分發最前面呼叫，與命中何種控制無關）。 */
    spawnClickFeedback(x, y) {
        this.clickFeedback.push({ x, y, t0: performance.now() });
        if (this.clickFeedback.length > BoardRenderer.CLICK_FEEDBACK_MAX) {
            this.clickFeedback.splice(0, this.clickFeedback.length - BoardRenderer.CLICK_FEEDBACK_MAX);
        }
        this.repaint?.();
    }
    /** 繪製左鍵點擊漣漪：外擴圓環 + 中心亮點，隨時間淡出。在整幀最上層呼叫。 */
    drawClickFeedback() {
        const fx = this.clickFeedback;
        if (!fx.length)
            return;
        const now = performance.now();
        const ms = BoardRenderer.CLICK_FEEDBACK_MS;
        const rMax = BoardRenderer.CLICK_FEEDBACK_RADIUS;
        const { ctx } = this;
        const alive = [];
        for (const item of fx) {
            const p = (now - item.t0) / ms;
            if (p >= 1)
                continue;
            alive.push(item);
            const alpha = Math.round(170 * (1 - p));
            if (alpha <= 0)
                continue;
            const radius = 6 + (rMax - 6) * (1 - (1 - p) ** 2); // 緩出：先快後慢
            ctx.save();
            ctx.globalAlpha = alpha / 255;
            ctx.strokeStyle = 'rgb(150,220,255)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            const dotR = Math.max(1, Math.round(4 * (1 - p)));
            ctx.fillStyle = 'rgb(225,245,255)';
            ctx.beginPath();
            ctx.arc(item.x, item.y, dotR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        this.clickFeedback = alive;
        if (alive.length > 0)
            this.repaint?.();
    }
}
BoardRenderer.CLICK_FEEDBACK_MS = 380;
BoardRenderer.CLICK_FEEDBACK_RADIUS = 34;
BoardRenderer.CLICK_FEEDBACK_MAX = 12;

return { BoardRenderer };
},
    "m10": function (require) {
/**
 * 滑塊矩陣核心邏輯（對照 game.py::SliderMatrix 逐函數移植）
 *
 * 移植紀律：分支結構與原版保持一致；只把選中旗標 be_opted
 * 從 Block 物件移到 `selected` 集合，語義不變。
 */
const { Block } = require("./Block.js");
const { DIRECTION_DELTA } = require("./rules.js");
class SliderMatrix {
    constructor(m = 6, n = 6) {
        /**
         * 自定義「目標形狀」（座標集合 "r:c"）。
         * - 為 null 時：is_solved 走原本的「m×n 實心矩形」判定（練習 / 競速 / 教程沿用）。
         * - 非 null 時：is_solved 改為「當前所有滑塊位置恰好等於此集合」（創造模式手造形狀用）。
         */
        this.solutionMask = null;
        this.m = m;
        this.n = n;
        this.blocks = [];
        this.selected = new Set();
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                this.blocks.push(new Block([i, j]));
            }
        }
    }
    get_boundaries() {
        if (this.blocks.length === 0) {
            return { min_row: 0, max_row: 0, min_col: 0, max_col: 0 };
        }
        const rows = this.blocks.map((b) => b.row);
        const cols = this.blocks.map((b) => b.col);
        return {
            min_row: Math.min(...rows),
            max_row: Math.max(...rows),
            min_col: Math.min(...cols),
            max_col: Math.max(...cols),
        };
    }
    is_valid_h_line(line) {
        const bounds = this.get_boundaries();
        return bounds.min_row <= line && line < bounds.max_row;
    }
    is_valid_v_line(line) {
        const bounds = this.get_boundaries();
        return bounds.min_col <= line && line < bounds.max_col;
    }
    /**
     * 檢查移動後是否合法（碰撞 + 全體單一連通）。
     * 對照 game.py::check_move_valid。
     */
    static check_move_valid(selectedPositions, nonSelectedPositions) {
        if (selectedPositions.size + nonSelectedPositions.size === 0)
            return true;
        for (const pos of selectedPositions) {
            if (nonSelectedPositions.has(pos))
                return false; // collision
        }
        const all = new Set([...selectedPositions, ...nonSelectedPositions]);
        return SliderMatrix.is_single_connected(all);
    }
    static is_single_connected(positions) {
        if (positions.size === 0)
            return true;
        const start = positions.values().next().value;
        const visited = new Set();
        const stack = [start];
        while (stack.length > 0) {
            const current = stack.pop();
            if (visited.has(current))
                continue;
            visited.add(current);
            const [r, c] = current.split(':').map(Number);
            for (const [dr, dc] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ]) {
                const neighbor = `${r + dr}:${c + dc}`;
                if (positions.has(neighbor) && !visited.has(neighbor)) {
                    stack.push(neighbor);
                }
            }
        }
        return visited.size === positions.size;
    }
    /**
     * 選中分割線一側、與選中滑塊連通的整片方塊。
     * 對照 game.py::opt（DFS）。
     * @returns 選中的位置集合（原版直接標 be_opted）
     */
    opt(gapType, line, selectedBlock) {
        // 清除舊選中（原版會先清所有 be_opted）
        this.selected.clear();
        const blockSet = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
        const isConnected = (a, b) => {
            // 判斷兩個相鄰方塊是否在同一側（不被分割線隔開）
            if (gapType === 'h') {
                if ((a[0] <= line && b[0] > line) || (a[0] > line && b[0] <= line)) {
                    return false;
                }
            }
            else {
                if ((a[1] <= line && b[1] > line) || (a[1] > line && b[1] <= line)) {
                    return false;
                }
            }
            return true;
        };
        const start = selectedBlock.location;
        const visited = new Set();
        const stack = [start];
        while (stack.length > 0) {
            const current = stack.pop();
            const key = `${current[0]}:${current[1]}`;
            if (visited.has(key))
                continue;
            visited.add(key);
            const [row, col] = current;
            for (const [dr, dc] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ]) {
                const neighbor = [row + dr, col + dc];
                const nKey = `${row + dr}:${col + dc}`;
                if (blockSet.has(nKey) && !visited.has(nKey) && isConnected(current, neighbor)) {
                    stack.push(neighbor);
                }
            }
        }
        // 依原版：把 visited 對應的方塊標為選中
        for (const b of this.blocks) {
            if (visited.has(`${b.row}:${b.col}`)) {
                this.selected.add(b);
            }
        }
        return visited;
    }
    /**
     * 預測移動（純邏輯，逐步 1 格驗證）。
     * 對照 game.py::try_move；不合法回傳 null。
     */
    try_move(direction, step) {
        const selected = this.blocks.filter((b) => this.selected.has(b));
        const nonSelectedPositions = new Set(this.blocks.filter((b) => !this.selected.has(b)).map((b) => `${b.row}:${b.col}`));
        if (selected.length === 0)
            return null;
        const delta = DIRECTION_DELTA[direction];
        if (!delta)
            return null;
        let current = selected.map((b) => [b.row, b.col]);
        for (let k = 0; k < step; k++) {
            const next = current.map(([r, c]) => [r + delta[0], c + delta[1]]);
            const nextSet = new Set(next.map(([r, c]) => `${r}:${c}`));
            if (!SliderMatrix.check_move_valid(nextSet, nonSelectedPositions)) {
                return null;
            }
            current = next;
        }
        return current.map(([r, c]) => [r, c]);
    }
    /** 提交移動（對照 game.py::commit_move）。 */
    commit_move(finalPositions) {
        const selected = this.blocks.filter((b) => this.selected.has(b));
        for (let i = 0; i < selected.length; i++) {
            selected[i].location = [finalPositions[i][0], finalPositions[i][1]];
        }
    }
    is_solved() {
        if (this.blocks.length === 0)
            return false;
        // 創造模式：比對自定義目標形狀（不要求矩形）
        if (this.solutionMask) {
            if (this.blocks.length !== this.solutionMask.size)
                return false;
            const pos = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
            for (const p of this.solutionMask) {
                if (!pos.has(p))
                    return false;
            }
            return true;
        }
        const rows = this.blocks.map((b) => b.row);
        const cols = this.blocks.map((b) => b.col);
        const minR = Math.min(...rows);
        const maxR = Math.max(...rows);
        const minC = Math.min(...cols);
        const maxC = Math.max(...cols);
        const height = maxR - minR + 1;
        const width = maxC - minC + 1;
        if (!((height === this.m && width === this.n) || (height === this.n && width === this.m))) {
            return false;
        }
        const posSet = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                if (!posSet.has(`${r}:${c}`))
                    return false;
            }
        }
        return true;
    }
    /**
     * 隨機打亂（對照 game.py::shuffle）。
     * 注意：刻意保留原版候選縫隙範圍 `range(min+1, max)` —— 不選邊界縫隙是「規定」，
     * 使網頁版行為與原版逐位元一致。
     */
    shuffle(attempts, step, rng = Math.random) {
        for (let i = 0; i < attempts; i++) {
            const bounds = this.get_boundaries();
            const { min_row, max_row, min_col, max_col } = bounds;
            const hLines = [];
            for (let line = min_row + 1; line < max_row; line++) {
                if (this.is_valid_h_line(line))
                    hLines.push(line);
            }
            const vLines = [];
            for (let line = min_col + 1; line < max_col; line++) {
                if (this.is_valid_v_line(line))
                    vLines.push(line);
            }
            const allGaps = [
                ...hLines.map((line) => ({ type: 'h', line })),
                ...vLines.map((line) => ({ type: 'v', line })),
            ];
            if (allGaps.length === 0)
                continue;
            const gap = allGaps[Math.floor(rng() * allGaps.length)];
            const direction = gap.type === 'h' ? (rng() < 0.5 ? 'a' : 'd') : rng() < 0.5 ? 'w' : 's';
            const block = this.blocks[Math.floor(rng() * this.blocks.length)];
            this.opt(gap.type, gap.line, block);
            const finalPositions = this.try_move(direction, step);
            if (!finalPositions) {
                this.selected.clear();
                continue;
            }
            this.commit_move(finalPositions);
            this.selected.clear();
        }
        this.selected.clear();
    }
    /**
     * 安全打亂（保證打亂出來的局面一定有解）。
     *
     * 背景與**效力邊界**（2026-10-18 實測校正，別再照舊文案理解）：
     *   · 本遊戲確實存在「走得到卻回不去」的局面，但**極稀少**：完整版 C++ 引擎全圖
     *     復現 (4,4,2) 得可達局面 558,286 個、其中死局僅 **9 個**（≈0.0016%），
     *     踏入死局的入口弧只有 7 條；(3,3,1) 則是 0 個（本倉庫 scripts/probe-deadends.mjs
     *     獨立窮盡 9,908 個局面亦為 0，與原版引擎的 1,284 個 D4 形狀類、上帝之數 10 對上）。
     *   · 「單步不可逆」**不等於**死局：原版測得 (4,4,2) 有約 14% 的邊原路反推不合法
     *     （推完就黏住了），但其中絕大多數繞路仍走得回來 —— 用不可逆邊的數量來論證
     *     「打亂會把人送進死局」是過度推論，本站先前的文案就是這樣寫錯的。
     *   · 所以本改動的價值**不在**「避開那 0.0016%」（雖然確實也避掉了），而在：
     *     打亂出來的開局**自帶一條已知解法**（就是這條路徑反過來），於是指示一步、
     *     自動求解、關卡生成永遠有答案，不必仰賴求解器碰運氣。
     *
     * 做法：與 shuffle() 完全相同的隨機走法，但**每一步都多一道可逆性校驗** ——
     * 推完之後立刻試著用同一條縫、反方向推回去，能精確回到移動前的局面才採用，
     * 否則還原再挑。這樣整條打亂路徑反過來就是一條合法解法，必定可以還原。
     *
     * @param path 可選：逐步記下經過的每個局面（長度 = 成功步數 + 1）。
     *   因為每一步都可逆，這串局面**反過來就是一條合法解法**，Debug 與驗證用。
     *   scripts/certify-shuffle.mjs 會把這條解法**真的逐step走一遍**（每一步都由
     *   opt/try_move/commit_move 判定為合法走法，末端由 is_solved() 判定為已還原），
     *   交出可獨立覆核的見證，而不只是邏輯推論。
     * @returns 真正走成功的步數（可能少於 attempts：某些局面找不到任何可逆走法）
     */
    shuffle_safe(attempts, step, rng = Math.random, path) {
        let done = 0;
        if (path)
            path.push(this.snapshot());
        for (let i = 0; i < attempts; i++) {
            if (this.shuffleStepSafe(step, rng)) {
                done++;
                if (path)
                    path.push(this.snapshot());
            }
        }
        this.selected.clear();
        return done;
    }
    /** 打亂一步（必須可逆）。回傳是否真的走了一步。 */
    shuffleStepSafe(step, rng, tries = 40) {
        const gaps = this.candidateGaps();
        if (gaps.length === 0)
            return false;
        for (let t = 0; t < tries; t++) {
            const gap = gaps[Math.floor(rng() * gaps.length) % gaps.length];
            const direction = gap.type === 'h' ? (rng() < 0.5 ? 'a' : 'd') : rng() < 0.5 ? 'w' : 's';
            const block = this.blocks[Math.floor(rng() * this.blocks.length) % this.blocks.length];
            // 輕量快照：只記座標。刻意不用 snapshot()/restore() —— 那會重建整個
            // Block 陣列，而失敗嘗試很常見（8×8 實測佔用大量時間），純屬浪費。
            const beforeLoc = this.blocks.map((b) => [b.row, b.col]);
            const beforeKey = new Set(beforeLoc.map(([r, c]) => `${r}:${c}`));
            this.opt(gap.type, gap.line, block);
            const moved = [...this.selected];
            if (moved.length === 0) {
                this.selected.clear();
                continue;
            }
            const finalPositions = this.try_move(direction, step);
            if (!finalPositions) {
                this.selected.clear();
                continue;
            }
            this.commit_move(finalPositions);
            // 可逆性：同一條縫、反方向推，能否精確回到移動前的局面
            const reversible = this.canUndoWith(gap.type, gap.line, moved[0], oppositeOf(direction), step, beforeKey);
            this.selected.clear();
            if (reversible)
                return true;
            // 輕量回滾：直接把座標改回去（也保留了 Block.number，比 restore 更省）
            this.blocks.forEach((b, i) => {
                b.location = beforeLoc[i];
            });
        }
        return false;
    }
    /** shuffle() 用的候選縫隙清單（刻意不含邊界縫，與原版一致）。 */
    candidateGaps() {
        const { min_row, max_row, min_col, max_col } = this.get_boundaries();
        const gaps = [];
        for (let line = min_row + 1; line < max_row; line++) {
            if (this.is_valid_h_line(line))
                gaps.push({ type: 'h', line });
        }
        for (let line = min_col + 1; line < max_col; line++) {
            if (this.is_valid_v_line(line))
                gaps.push({ type: 'v', line });
        }
        return gaps;
    }
    /**
     * 從當前局面用同一條縫、反方向推，能否精確回到 targetKey 描述的局面。
     *
     * 只有在 opt 選中的分量與當初推動的那組完全一致時才成立 —— 若移動後該分量
     * 與別的方塊黏成更大一坨，玩家也沒辦法只推回原來那部分，故判定為不可逆。
     * （保守但安全：寧可少走一步，也不放行任何可能回不去的操作。）
     */
    canUndoWith(gapType, line, representative, backDirection, step, targetKey) {
        this.opt(gapType, line, representative);
        const selectedNow = [...this.selected];
        if (selectedNow.length === 0)
            return false;
        const back = this.try_move(backDirection, step);
        if (!back)
            return false;
        const selectedKey = new Set(selectedNow.map((b) => `${b.row}:${b.col}`));
        const union = new Set();
        for (let i = 0; i < selectedNow.length; i++)
            union.add(`${back[i][0]}:${back[i][1]}`);
        for (const b of this.blocks) {
            const key = `${b.row}:${b.col}`;
            if (!selectedKey.has(key))
                union.add(key);
        }
        if (union.size !== targetKey.size)
            return false;
        for (const key of union)
            if (!targetKey.has(key))
                return false;
        return true;
    }
    /** 導出 map 文本（#=方塊、_=空白）。對照 game.py::export_map。 */
    export_map() {
        const { min_row, max_row, min_col, max_col } = this.get_boundaries();
        const blockSet = new Set(this.blocks.map((b) => `${b.row}:${b.col}`));
        const rows = [];
        for (let row = min_row; row <= max_row; row++) {
            let line = '';
            for (let col = min_col; col <= max_col; col++) {
                line += blockSet.has(`${row}:${col}`) ? '#' : '_';
            }
            rows.push(line);
        }
        return rows.join('\n');
    }
    /** 導入 map 文本。對照 game.py::import_map。 */
    import_map(mapStr) {
        const lines = mapStr
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        if (lines.length === 0)
            return false;
        this.blocks = [];
        this.selected.clear();
        this.m = lines.length;
        this.n = lines[0]?.length ?? 0;
        for (let row = 0; row < lines.length; row++) {
            const line = lines[row];
            for (let col = 0; col < line.length; col++) {
                if (line[col] === '#') {
                    this.blocks.push(new Block([row, col]));
                }
            }
        }
        return true;
    }
    /** 原地重設為 m×n 實心矩形（reset 用，避免外部 store 持有舊引用）。 */
    resetTo(m, n) {
        this.m = m;
        this.n = n;
        this.blocks = [];
        this.selected.clear();
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                this.blocks.push(new Block([i, j]));
            }
        }
    }
    /** 快照當前版面（供 GameHistory 使用）。編號要一起帶走，否則撤銷會把數字弄丟。 */
    snapshot() {
        const snap = { blocks: this.blocks.map((b) => [b.row, b.col]) };
        if (this.blocks.some((b) => b.number !== null)) {
            snap.numbers = this.blocks.map((b) => b.number);
        }
        return snap;
    }
    /** 由快照還原版面。 */
    restore(snapshot) {
        this.blocks = snapshot.blocks.map(([r, c], i) => {
            const b = new Block([r, c]);
            b.number = snapshot.numbers?.[i] ?? null;
            return b;
        });
        this.selected.clear();
    }
    /**
     * 數字形態：按行主序把編號 1..m*n 寫進滑塊（對照 GUI.new_puzzle 的編號步驟）。
     * 版面被打亂後編號仍跟著各自滑塊，玩家靠它判斷「這塊原本該在哪」。
     */
    assignNumbers(enabled) {
        this.blocks.forEach((b, i) => {
            b.number = enabled ? i + 1 : null;
        });
    }
}
/** 反方向（可逆性校验用）。刻意不放在 rules.ts —— 只打亂用得到，避免污染公共 API。 */
function oppositeOf(direction) {
    switch (direction) {
        case 'w': return 's';
        case 's': return 'w';
        case 'a': return 'd';
        default: return 'a';
    }
}

return { SliderMatrix };
},
    "m11": function (require) {
/**
 * 求解器對外入口
 *
 * 原版 solver/__init__.py 的 SOLVER_ALGORITHMS 註冊表已明確：IDA*／貪心爬山屬
 * 「早期搜索類算法，相對宏級流水線已非常低效，保留只為備查」；有效的是聚攏與
 * 填洞補缺。故網頁版只實這一條路線（src/solver/gather.ts）。
 *
 * 語義對照原版 solver 協定：
 *   solve(game, step, max_steps, cancel_check?, progress_callback?) -> list[action] | null
 */
// 注意：本專案的打包器 scripts/bundle.mjs **不支援** `export { X } from './y.js'`
// 這種再導出寫法（它的正則只認以 `};` 結尾的 `export { X };`），寫了會讓 export
// 語句原樣殘留在 IIFE 產物裡 → app.js 直接 SyntaxError。
// 這裡一律改成「先 import，再 export { }」。
const { applyAction, enc, decRow, decCol, stateFromBlocks, blocksOf, enumerateMoves, isSolvedState, isInverseAction,  } = require("./model.js");
const { solveByGather, trimPath, findTargetWindow, detectHoles, overlapWith, bestMove, outsideDistance,  } = require("./gather.js");
// 再一個打包器坑：export 列表不能有尾隨逗號，否則 bundle.mjs 會切出空名字，
// 生成 `return { a, b, , c }` → SyntaxError。故以下一律不寫尾隨逗號。


/** 可重現的亂數（mulberry32），讓重試之間彼此不同、且測試可預測。 */
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/**
 * 求解。回傳的 actions 可直接回放（見 main.ts 的 playSolverActions）。
 *
 * 注意：本遊戲存在「合法但無法還原」的死局，且爬山法不保證最優、也不保證成功；
 * solved=false 時請如實告訴玩家，不要假裝有解。
 */
function solve(blocks, m, n, step, opts = {}) {
    const restarts = opts.restarts ?? 3;
    const initial = stateFromBlocks(blocks);
    let best = { actions: [], solved: false, steps: 0, attempts: 0 };
    for (let attempt = 0; attempt < restarts; attempt++) {
        const res = solveByGather(initial, m, n, step, {
            ...opts,
            rng: opts.rng ?? mulberry32(0x9e3779b9 + attempt * 7919),
        });
        const trimmed = trimPath(res.actions);
        const solved = res.solved || (trimmed.length > 0 && endsSolved(initial, trimmed, m, n, step));
        const candidate = {
            actions: trimmed,
            solved,
            steps: trimmed.length,
            attempts: attempt + 1,
        };
        if (solved)
            return candidate; // 先求有解，不在此比較步數優劣
        if (!best.solved && candidate.steps > 0)
            best = candidate;
        else if (best.attempts === 0)
            best = candidate;
    }
    return best;
}
/** 回放一遍確認結局真的還原（trimPath 之後重新驗證，避免剪出假解）。 */
function endsSolved(initial, actions, m, n, step) {
    let cur = new Set(initial);
    for (const a of actions) {
        const next = applyAction(cur, a, step);
        if (!next)
            return false;
        cur = next;
    }
    return isSolvedState(cur, m, n);
}
/** 求解結果的人話摘要（給 toast / 狀態列用）。 */
function describeAction(a) {
    const gap = a.gapType === 'h' ? '横缝' : '纵缝';
    const dirText = { w: '上', s: '下', a: '左', d: '右' };
    return `${gap}${a.line} · 往${dirText[a.dir]}推`;
}

return { solve, describeAction, findTargetWindow, detectHoles, overlapWith, solveByGather, bestMove, outsideDistance, enc, decRow, decCol, stateFromBlocks, blocksOf, enumerateMoves, applyAction, isSolvedState, isInverseAction };
},
    "m12": function (require) {
/**
 * 求解器 · 狀態表示與走法生成
 * 對照原版 solver/state.py（狀態編碼/特徵）與 solver/actions.py（動作枚舉/執行）。
 *
 * 兩點刻意偏離原版，都是為了「更強」而非不同：
 *  1. 原版每個 (縫隙, 側) 只取 side_blocks[0] 作代表塊，同側若有多個連通分量會漏走法；
 *     這裡枚舉同側的**每一個連通分量**，解得出來的局面只會更多。
 *  2. 狀態用「編碼後的整數集合」而非 Block 物件陣列，搜尋時免掉大量物件配置。
 *     走法語義與 SliderMatrix.opt/try_move/commit_move 完全一致，由 tests/solver.test.mjs
 *     做等價性比對（同一局面、同一走法，兩邊結果必須逐格相同）。
 */
const { DIRECTION_DELTA } = require("../core/rules.js");
// ---------- 座標編碼 ----------
// 滑塊可能被推出原本的 m×n 範圍（缺口外滑），座標可為負，故整體加偏移後打包成一個整數。
const SHIFT = 11;
const SPAN = 1 << SHIFT; // 2048
const MASK = SPAN - 1;
const OFF = 1 << 10; // 1024 → 允許 r/c ∈ [-1024, 1023]
function enc(r, c) {
    return ((r + OFF) << SHIFT) | (c + OFF);
}
function decRow(p) {
    return (p >> SHIFT) - OFF;
}
function decCol(p) {
    return (p & MASK) - OFF;
}
function stateFromBlocks(blocks) {
    const s = new Set();
    for (const [r, c] of blocks)
        s.add(enc(r, c));
    return s;
}
function blocksOf(state) {
    const out = [];
    for (const p of state)
        out.push([decRow(p), decCol(p)]);
    return out;
}
function boundsOf(state) {
    let minR = Infinity;
    let maxR = -Infinity;
    let minC = Infinity;
    let maxC = -Infinity;
    for (const p of state) {
        const r = decRow(p);
        const c = decCol(p);
        if (r < minR)
            minR = r;
        if (r > maxR)
            maxR = r;
        if (c < minC)
            minC = c;
        if (c > maxC)
            maxC = c;
    }
    return { minR, maxR, minC, maxC };
}
/** 包圍盒面積（G1 階段目標就是讓它等於 m*n）。 */
function bbArea(state) {
    const b = boundsOf(state);
    return (b.maxR - b.minR + 1) * (b.maxC - b.minC + 1);
}
/**
 * 是否已還原：包圍盒恰為 m×n（或 n×m）且盒內填滿。
 * 對照 SliderMatrix.is_solved 的「實心矩形」口徑（solutionMask 屬創造模式，求解器不處理）。
 */
function isSolvedState(state, m, n) {
    if (state.size !== m * n)
        return false;
    const b = boundsOf(state);
    const h = b.maxR - b.minR + 1;
    const w = b.maxC - b.minC + 1;
    if (!((h === m && w === n) || (h === n && w === m)))
        return false;
    for (let r = b.minR; r <= b.maxR; r++) {
        for (let c = b.minC; c <= b.maxC; c++) {
            if (!state.has(enc(r, c)))
                return false;
        }
    }
    return true;
}
// ---------- 連通性 ----------
function isSingleConnected(set) {
    if (set.size === 0)
        return true;
    const start = set.values().next().value;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length > 0) {
        const p = stack.pop();
        const r = decRow(p);
        const c = decCol(p);
        const nbs = [enc(r - 1, c), enc(r + 1, c), enc(r, c - 1), enc(r, c + 1)];
        for (const nb of nbs) {
            if (set.has(nb) && !seen.has(nb)) {
                seen.add(nb);
                stack.push(nb);
            }
        }
    }
    return seen.size === set.size;
}
/**
 * 縫某一側的所有連通分量。
 * 同一側內不會跨線，故直接在該側集合上做 BFS 即等價於 SliderMatrix.opt 的結果。
 */
function componentsOnSide(state, gapType, line, side) {
    const onSide = new Set();
    for (const p of state) {
        const r = decRow(p);
        const c = decCol(p);
        const ok = gapType === 'h'
            ? side === 'above'
                ? r <= line
                : r > line
            : side === 'left'
                ? c <= line
                : c > line;
        if (ok)
            onSide.add(p);
    }
    const seen = new Set();
    const comps = [];
    for (const p0 of onSide) {
        if (seen.has(p0))
            continue;
        const comp = [];
        const stack = [p0];
        while (stack.length > 0) {
            const p = stack.pop();
            if (seen.has(p))
                continue;
            seen.add(p);
            comp.push(p);
            const r = decRow(p);
            const c = decCol(p);
            const nbs = [enc(r - 1, c), enc(r + 1, c), enc(r, c - 1), enc(r, c + 1)];
            for (const nb of nbs) {
                if (onSide.has(nb) && !seen.has(nb))
                    stack.push(nb);
            }
        }
        comps.push(comp);
    }
    return comps;
}
/**
 * 嘗試把 comp 往 dir 推 step 格。逐步驗證（碰撞 + 全體單一連通），
 * 任一步不合法就回 null —— 與 SliderMatrix.try_move 的逐步語義一致。
 */
function tryMove(state, comp, dir, step) {
    const delta = DIRECTION_DELTA[dir];
    const rest = new Set();
    const compSet = new Set(comp);
    for (const p of state)
        if (!compSet.has(p))
            rest.add(p);
    let cur = comp.slice();
    for (let k = 0; k < step; k++) {
        const next = cur.map((p) => enc(decRow(p) + delta[0], decCol(p) + delta[1]));
        const nextSet = new Set(next);
        for (const p of nextSet)
            if (rest.has(p))
                return null; // 碰撞
        const union = new Set(rest);
        for (const p of nextSet)
            union.add(p);
        if (!isSingleConnected(union))
            return null;
        cur = next;
    }
    const out = new Set(rest);
    for (const p of cur)
        out.add(p);
    return out;
}
/**
 * 枚舉當前局面所有合法走法。
 * 縫隙範圍對照 SliderMatrix.is_valid_h_line / is_valid_v_line（含下邊界、不含上邊界）。
 */
function enumerateMoves(state, step) {
    const b = boundsOf(state);
    const out = [];
    const sidesFor = (gapType) => gapType === 'h' ? ['above', 'below'] : ['left', 'right'];
    const dirsFor = (gapType) => gapType === 'h' ? ['a', 'd'] : ['w', 's'];
    // h 縫：line ∈ [minR, maxR)，只能左右推
    for (let line = b.minR; line < b.maxR; line++) {
        for (const side of sidesFor('h')) {
            for (const comp of componentsOnSide(state, 'h', line, side)) {
                for (const dir of dirsFor('h')) {
                    const next = tryMove(state, comp, dir, step);
                    if (!next)
                        continue;
                    out.push({
                        action: {
                            gapType: 'h',
                            line,
                            side,
                            seed: [decRow(comp[0]), decCol(comp[0])],
                            dir,
                        },
                        next,
                    });
                }
            }
        }
    }
    // v 縫：line ∈ [minC, maxC)，只能上下推
    for (let line = b.minC; line < b.maxC; line++) {
        for (const side of sidesFor('v')) {
            for (const comp of componentsOnSide(state, 'v', line, side)) {
                for (const dir of dirsFor('v')) {
                    const next = tryMove(state, comp, dir, step);
                    if (!next)
                        continue;
                    out.push({
                        action: {
                            gapType: 'v',
                            line,
                            side,
                            seed: [decRow(comp[0]), decCol(comp[0])],
                            dir,
                        },
                        next,
                    });
                }
            }
        }
    }
    return out;
}
/**
 * 在狀態上執行一個走法：找出 seed 所屬的同側連通分量，再推 step 格。
 * 供求解器驗證與預覽使用（不依賴 SliderMatrix，純集合運算）。
 */
function applyAction(state, action, step) {
    const comps = componentsOnSide(state, action.gapType, action.line, action.side);
    const seedPos = enc(action.seed[0], action.seed[1]);
    for (const comp of comps) {
        if (comp.indexOf(seedPos) >= 0)
            return tryMove(state, comp, action.dir, step);
    }
    return null;
}
/**
 * 置換表用的狀態鍵：平移歸一化（減去包圍盒左上角）。
 * 對照原版 state_key —— 形狀相同、位置不同視為同一狀態。
 */
function stateKey(state) {
    const b = boundsOf(state);
    const norm = [];
    for (const p of state)
        norm.push(enc(decRow(p) - b.minR, decCol(p) - b.minC));
    norm.sort((x, y) => x - y);
    return norm.join(',');
}
/** 兩個走法是否互為逆操作（同縫隙、同側、方向相反）—— 用來禁止原地來回。 */
function isInverseAction(a, b) {
    if (a.gapType !== b.gapType || a.line !== b.line || a.side !== b.side)
        return false;
    const pairs = [
        ['w', 's'],
        ['s', 'w'],
        ['a', 'd'],
        ['d', 'a'],
    ];
    return pairs.some(([x, y]) => a.dir === x && b.dir === y);
}
// ---------- 啟發式（對照 solver/heuristic.py） ----------
function scoreParts(state, m, n) {
    const b = boundsOf(state);
    const H = b.maxR - b.minR + 1;
    const W = b.maxC - b.minC + 1;
    const K = m * n;
    const area = H * W;
    const fillRate = area > 0 ? K / area : 0;
    const minDim = Math.min(m, n);
    const maxDim = Math.max(m, n);
    const targetRatio = minDim > 0 ? maxDim / minDim : 1;
    const minHW = Math.min(H, W);
    const maxHW = Math.max(H, W);
    const currentRatio = minHW > 0 ? maxHW / minHW : 1;
    const maxRatio = Math.max(currentRatio, targetRatio);
    const aspectError = maxRatio > 0 ? Math.abs(currentRatio - targetRatio) / maxRatio : 0;
    return { fillRate, aspectError };
}
/** 標準啟發：Score = 0.5·fill_rate + 0.5·(1−aspect_error)，h = 1 − Score ∈ [0,1)。 */
function heuristic(state, m, n) {
    if (isSolvedState(state, m, n))
        return 0;
    const { fillRate, aspectError } = scoreParts(state, m, n);
    return 1 - (0.5 * fillRate + 0.5 * (1 - aspectError));
}
/** 快速模式啟發：加重聚攏權重（0.7 / 0.3），更快找到可行解，不保證最優。 */
function fastHeuristic(state, m, n) {
    if (isSolvedState(state, m, n))
        return 0;
    const { fillRate, aspectError } = scoreParts(state, m, n);
    return 1 - (0.7 * fillRate + 0.3 * (1 - aspectError));
}
/** G1（聚攏）階段專用：只看填充率。 */
function fillRateHeuristic(state, m, n) {
    if (state.size === 0)
        return 1;
    const { fillRate } = scoreParts(state, m, n);
    return 1 - fillRate;
}
/** G1 階段目標：包圍盒面積 == m*n（已是實心，但長寬比可能不對）。 */
function isGathered(state, m, n) {
    return state.size > 0 && bbArea(state) === m * n;
}

return { enc, decRow, decCol, stateFromBlocks, blocksOf, boundsOf, bbArea, isSolvedState, tryMove, enumerateMoves, applyAction, stateKey, isInverseAction, heuristic, fastHeuristic, fillRateHeuristic, isGathered };
},
    "m13": function (require) {
/**
 * 求解器 · 聚攏 + 填洞補缺（貪心爬山）
 *
 * 對照原版 solver/ml/gather_solver.py（max_overlap / find_best_window / gather_solve）
 * 與 solver/ml/hole_detector.py（detect_holes）。
 *
 * 為什麼不做 IDA*：原版 solver/__init__.py 的註冊表已把 IDA*／貪心爬山歸為
 * 「早期搜索類算法，相對現有宏級流水線已非常低效，保留只為備查」；
 * 真正有效的是**聚攏**與**填洞補缺**這條路線，本模組即照這條路線實作。
 *
 * 核心觀察（把三件事統一成一個目標函數）：
 *   設 T = 與當前局面重疊最高的 m×n（或 n×m）窗口，K = m*n。
 *   - 窗口內的空格 = 洞 + 缺口    → 填洞補缺
 *   - 窗口外的方塊 = 凸起        → 聚攏
 *   兩者都等價於「提高窗口內方塊數 overlap」；overlap == K 時即為已還原。
 * 因此爬山目標就是 overlap，洞/缺口/包圍盒面積只作為同分時的次要排序鍵。
 */
const { bbArea, blocksOf, boundsOf, enc, enumerateMoves, heuristic, isInverseAction, isSolvedState,  } = require("./model.js");
/**
 * 找「聚攏度最高」的目標窗口（平移不變、轉置對稱）。
 * 對照 hole_detector.find_target_region（原版另有 mod 約束版 find_best_window，
 * 這裡先不引入 mod 約束——實測對聚攏目標的選窗影響極小，留待需要時再加）。
 */
function findTargetWindow(state, m, n) {
    const coords = blocksOf(state);
    const total = m * n;
    if (coords.length === 0)
        return { r0: 0, c0: 0, rh: m, cw: n, overlap: 0 };
    const b = boundsOf(state);
    let best = { r0: b.minR, c0: b.minC, rh: m, cw: n, overlap: -1 };
    for (const [rh, cw] of [
        [m, n],
        [n, m],
    ]) {
        for (let r0 = b.minR - rh + 1; r0 <= b.maxR; r0++) {
            for (let c0 = b.minC - cw + 1; c0 <= b.maxC; c0++) {
                let cnt = 0;
                for (const [r, c] of coords) {
                    if (r >= r0 && r < r0 + rh && c >= c0 && c < c0 + cw)
                        cnt++;
                }
                if (cnt > best.overlap) {
                    best = { r0, c0, rh, cw, overlap: cnt };
                    if (cnt === total)
                        return best; // 已滿，不可能更好
                }
            }
        }
    }
    return best;
}
/** 窗口內的方塊數（爬山主目標）。 */
function overlapWith(state, win) {
    let cnt = 0;
    for (const p of state) {
        // 直接用編碼值比對，避免逐塊解碼
        const r = (p >> 11) - 1024;
        const c = (p & 2047) - 1024;
        if (r >= win.r0 && r < win.r0 + win.rh && c >= win.c0 && c < win.c0 + win.cw)
            cnt++;
    }
    return cnt;
}
/**
 * 偵測目標窗口內的洞與缺口、窗口外的凸起。
 * 對照 hole_detector.detect_holes：洪水填充連通空格區，
 * 觸及窗口邊緣者為 dent（缺口），否則為 hole（洞）。
 */
function detectHoles(state, win, step) {
    const { r0, c0, rh, cw } = win;
    const grid = [];
    for (let i = 0; i < rh; i++)
        grid.push(new Array(cw).fill(0));
    const protrusions = [];
    for (const p of state) {
        const r = (p >> 11) - 1024;
        const c = (p & 2047) - 1024;
        if (r >= r0 && r < r0 + rh && c >= c0 && c < c0 + cw) {
            grid[r - r0][c - c0] = 1;
        }
        else {
            protrusions.push([r, c]);
        }
    }
    const seen = [];
    for (let i = 0; i < rh; i++)
        seen.push(new Array(cw).fill(false));
    const holes = [];
    const dents = [];
    for (let i = 0; i < rh; i++) {
        for (let j = 0; j < cw; j++) {
            if (grid[i][j] !== 0 || seen[i][j])
                continue;
            const cells = [];
            let touchesEdge = false;
            const stack = [[i, j]];
            seen[i][j] = true;
            while (stack.length > 0) {
                const [x, y] = stack.pop();
                cells.push([x + r0, y + c0]);
                const nbs = [
                    [x - 1, y],
                    [x + 1, y],
                    [x, y - 1],
                    [x, y + 1],
                ];
                for (const [nx, ny] of nbs) {
                    if (nx >= 0 && nx < rh && ny >= 0 && ny < cw) {
                        if (grid[nx][ny] === 0 && !seen[nx][ny]) {
                            seen[nx][ny] = true;
                            stack.push([nx, ny]);
                        }
                    }
                    else {
                        touchesEdge = true; // 越界 = 與外緣相連
                    }
                }
            }
            (touchesEdge ? dents : holes).push(cells);
        }
    }
    // step 只影響「洞夠不夠大、能不能整組推進去」的後續判斷，這裡先保留語義；
    // 目前爬山目標用不到它，但呼叫方可藉此決定要不要優先補大洞。
    void step;
    let emptyInWindow = 0;
    for (const g of holes)
        emptyInWindow += g.length;
    for (const g of dents)
        emptyInWindow += g.length;
    return { holes, dents, protrusions, emptyInWindow };
}
/**
 * 窗口外方塊到窗口的距離和（曼哈頓）。
 *
 * 這是讓爬山能動起來的關鍵：「窗口內方塊數」是階梯函數，把方塊推近窗口
 * 卻還沒推進去時得分完全不變，貪心只會在平原上亂撞（實測 6×6 成功率僅 5~25%、
 * 平均要一百多步）。加這個連續梯度後，貪心才有「往窗口靠」的方向感
 * —— 原版最有效的算法就叫「梯度聚攏」，正是這個意思。
 */
function outsideDistance(state, win) {
    let d = 0;
    const r1 = win.r0 + win.rh - 1;
    const c1 = win.c0 + win.cw - 1;
    for (const p of state) {
        const r = (p >> 11) - 1024;
        const c = (p & 2047) - 1024;
        const dr = r < win.r0 ? win.r0 - r : r > r1 ? r - r1 : 0;
        const dc = c < win.c0 ? win.c0 - c : c > c1 ? c - c1 : 0;
        d += dr + dc;
    }
    return d;
}
function better(a, b) {
    if (a.overlap !== b.overlap)
        return a.overlap > b.overlap;
    if (a.outside !== b.outside)
        return a.outside < b.outside;
    if (a.holeCells !== b.holeCells)
        return a.holeCells < b.holeCells;
    if (a.area !== b.area)
        return a.area < b.area;
    return a.h < b.h;
}
function scoreState(state, win, step, m, n) {
    const rep = detectHoles(state, win, step);
    let holeCells = 0;
    for (const g of rep.holes)
        holeCells += g.length;
    return {
        overlap: overlapWith(state, win),
        outside: outsideDistance(state, win),
        area: bbArea(state),
        holeCells,
        h: heuristic(state, m, n),
    };
}
/**
 * 聚攏求解：貪心爬山 + 卡死時隨機踢一步。
 *
 * 每一步：枚舉全部合法走法 → 用「與目標窗口的重疊數」評分 → 走最好的一步；
 * 若最好的一步也沒有比現況好，視為陷入平原，隨機踢一步重試，
 * 連續 patience 步無改善就放棄。
 *
 * 注意：本遊戲**存在合法但無法還原的死局**（見「相關數學問題」），
 * 所以失敗不代表程式有錯；solved=false 時呼叫方應如實告知玩家。
 */
function solveByGather(state, m, n, step, opts = {}) {
    const maxSteps = opts.maxSteps ?? 400;
    const patience = opts.patience ?? 40;
    const maxStages = opts.maxStages ?? 4;
    const timeBudgetMs = opts.timeBudgetMs ?? 5000;
    const rng = opts.rng ?? Math.random;
    /** 卡住時每隔幾步重選一次目標窗口（形狀會因踢步而改變） */
    const replanEvery = 12;
    /** 平原上每隔幾步隨機擾動一次（其餘時候走當下最好的一步） */
    const kickEvery = 5;
    const deadline = Date.now() + timeBudgetMs;
    let cur = new Set(state);
    const path = [];
    // 窗口在一個階段內固定：每步重選會讓目標一直漂，貪心反而沒有穩定方向
    let win = findTargetWindow(cur, m, n);
    let stuck = 0;
    let stage = 0;
    if (isSolvedState(cur, m, n))
        return { actions: path, solved: true, steps: 0 };
    for (let i = 0; i < maxSteps; i++) {
        if (isSolvedState(cur, m, n))
            return { actions: path, solved: true, steps: path.length };
        if (Date.now() > deadline)
            break;
        const curScore = scoreState(cur, win, step, m, n);
        const moves = enumerateMoves(cur, step).filter((mv) => !path.length || !isInverseAction(path[path.length - 1], mv.action));
        if (moves.length === 0)
            break; // 完全凍結的死局
        let bestMove = null;
        let bestScore = null;
        for (const mv of moves) {
            const s = scoreState(mv.next, win, step, m, n);
            if (bestScore === null || better(s, bestScore)) {
                bestScore = s;
                bestMove = mv;
            }
        }
        if (!bestMove || !bestScore)
            break;
        if (better(bestScore, curScore)) {
            cur = bestMove.next;
            path.push(bestMove.action);
            stuck = 0;
        }
        else {
            // 平原：先換目標窗口再說，真的沒救才隨機踢一步
            stuck++;
            if (stuck > patience) {
                stage++;
                if (stage > maxStages)
                    break;
                win = findTargetWindow(cur, m, n);
                stuck = 0;
                continue;
            }
            if (stuck % replanEvery === 0)
                win = findTargetWindow(cur, m, n);
            // 平原時不再一律亂踢：填洞常常得先「惡化」一步（挪開讓出通道），
            // 純爬山拒絕任何惡化步就只能在原地亂撞。這裡改走當下最好的一步——
            // 有「到窗口的距離」這個連續梯度導引，它多半仍在往目標靠；
            // 只每隔幾步才隨機擾動一次，避免整條路線被同一個局部極值鎖死。
            if (stuck % kickEvery === 0) {
                const kick = moves[Math.floor(rng() * moves.length) % moves.length];
                cur = kick.next;
                path.push(kick.action);
            }
            else {
                cur = bestMove.next;
                path.push(bestMove.action);
            }
        }
    }
    return {
        actions: path,
        solved: isSolvedState(cur, m, n),
        steps: path.length,
    };
}
/**
 * 只挑「當下最好的一步」，不做完整求解。
 * 「提示一步」用這個：一步前瞻很便宜，且與求解器共用同一套評分標準，
 * 所以提示的方向一定不會跟自動求解的第一步打架。
 */
function bestMove(state, m, n, step) {
    const win = findTargetWindow(state, m, n);
    const curScore = scoreState(state, win, step, m, n);
    const moves = enumerateMoves(state, step);
    if (moves.length === 0)
        return null; // 完全凍結
    let bm = null;
    let bs = null;
    for (const mv of moves) {
        const s = scoreState(mv.next, win, step, m, n);
        if (bs === null || better(s, bs)) {
            bs = s;
            bm = mv;
        }
    }
    if (!bm || !bs)
        return null;
    // 當下沒有更好的一步時，仍然回傳最好的一步（可能等於現況）：
    // 提示的目的是給方向，寧可給一個「最接近目標」的，也不要空白。
    void curScore;
    return { action: bm.action, next: bm.next };
}
/**
 * 求解後的收尾：把連續「同一組來回推」的贅步壓掉，讓回放更乾淨。
 * 只移除相鄰的互逆步驟（其餘順序一律保留，避免破壞可行性）。
 */
function trimPath(actions) {
    const out = [];
    for (const a of actions) {
        const last = out[out.length - 1];
        if (last && isInverseAction(last, a))
            out.pop();
        else
            out.push(a);
    }
    return out;
}
/** 方便外部從 SliderMatrix 的 blocks 建立狀態。 */
function stateOf(blocks) {
    const s = new Set();
    for (const [r, c] of blocks)
        s.add(enc(r, c));
    return s;
}

return { findTargetWindow, overlapWith, detectHoles, outsideDistance, solveByGather, bestMove, trimPath, stateOf };
},
    "m14": function (require) {
/**
 * 存檔/導入（M4）：localStorage 自動快照 + 檔案下載/上傳 + 解析 map 文本。
 * 存檔 JSON 與原版完全一致（{version, puzzle, step_count, history:{history_index, snapshots}}）。
 */
const STORAGE_KEY = 'gatennea-slider-web:last';
/** 移植原版 _compact_json_dumps：讓輸出格式與原版一字不差。 */
function compactJsonDumps(data) {
    const indent = 2;
    const maxLineWidth = 200;
    function format(obj, depth, sparse) {
        const currentPad = ' '.repeat(depth * indent);
        const nextPad = ' '.repeat((depth + 1) * indent);
        if (obj === null)
            return 'null';
        if (Array.isArray(obj)) {
            if (obj.length === 0)
                return '[]';
            const allAtomic = obj.every((x) => typeof x === 'number' || typeof x === 'boolean' || x === null);
            if (allAtomic) {
                const inline = '[' + obj.map((x) => JSON.stringify(x)).join(', ') + ']';
                return inline;
            }
            const items = obj.map((x) => format(x, depth + 1, false));
            if (sparse) {
                const sep = ',\n';
                return '[\n' + items.map((it) => nextPad + it).join(sep) + '\n' + currentPad + ']';
            }
            const allSingle = items.every((it) => !it.includes('\n'));
            if (allSingle) {
                const inline = '[' + items.join(', ') + ']';
                if (inline.length <= maxLineWidth)
                    return inline;
            }
            return '[\n' + items.map((it) => nextPad + it).join(',\n') + '\n' + currentPad + ']';
        }
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0)
                return '{}';
            const pairs = keys.map((k) => {
                const v = obj[k];
                const vStr = format(v, depth + 1, k === 'matrix' && Array.isArray(v) && v.length > 0 && Array.isArray(v[0]));
                return [JSON.stringify(k), vStr];
            });
            const allSingle = pairs.every(([, v]) => !v.includes('\n'));
            if (allSingle) {
                const inline = '{' + pairs.map(([k, v]) => k + ': ' + v).join(', ') + '}';
                if (inline.length <= maxLineWidth)
                    return inline;
            }
            return '{\n' + pairs.map(([k, v]) => nextPad + k + ': ' + v).join(',\n') + '\n' + currentPad + '}';
        }
        return JSON.stringify(obj);
    }
    return format(data, 0, false);
}
function puzzleTag(store) {
    return `${store.currentStep}~${store.currentM}*${store.currentN}`;
}
function nowStamp() {
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const p4 = (n) => String(n).padStart(4, '0');
    return `${p4(d.getFullYear())}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}
/** localStorage 自動快照（對照原版 temp_history.json）。 */
function autosave(store) {
    try {
        localStorage.setItem(STORAGE_KEY, compactJsonDumps(store.serialize()));
        return true;
    }
    catch {
        return false;
    }
}
/** 啟動時恢復 localStorage 快照。回傳是否恢復成功。 */
function autoload(store) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return false;
        const p = JSON.parse(raw);
        return store.deserialize(p);
    }
    catch {
        return false;
    }
}
/** 下載存檔：內容與原版完全一致，檔名也沿用原版 step-m-n-日期時間.json。 */
function downloadSave(store) {
    const p = store.serialize();
    const name = `${store.currentStep}-${store.currentM}-${store.currentN}-${nowStamp()}.json`;
    downloadText(name, compactJsonDumps(p));
}
/** 「另存為」：優先呼叫系統檔案對話框（File System Access API），否則退回下載。 */
async function saveAs(store) {
    const p = store.serialize();
    const name = `${store.currentStep}-${store.currentM}-${store.currentN}-${nowStamp()}.json`;
    const text = compactJsonDumps(p);
    const w = window;
    if (w && typeof w.showSaveFilePicker === 'function') {
        try {
            const handle = await w.showSaveFilePicker({ suggestedName: name, types: [{ description: 'JSON 存檔', accept: { 'application/json': ['.json'] } }] });
            const writable = await handle.createWritable();
            await writable.write(text);
            await writable.close();
            return;
        }
        catch (e) {
            // 使用者取消或其他失敗 → 退回下載
        }
    }
    downloadText(name, text);
}
/** 從 JSON 或 map 文本導入。回傳結果文案。 */
function importData(store, text) {
    const t = text.trim();
    if (!t)
        return { ok: false, message: '內容為空' };
    if (t[0] === '{') {
        try {
            const p = JSON.parse(t);
            if (store.deserialize(p))
                return { ok: true, message: '已導入存檔' };
            return { ok: false, message: '存檔內容不合法' };
        }
        catch {
            return { ok: false, message: 'JSON 解析失敗' };
        }
    }
    if (store.game.import_map(t)) {
        return { ok: true, message: '已導入 map' };
    }
    return { ok: false, message: 'map 解析失敗' };
}
// ---------- localStorage 多存檔列表（手機為主、電腦備援） ----------
const SAVES_KEY = 'gatennea-slider-web:saves';
function listSaves() {
    try {
        const raw = localStorage.getItem(SAVES_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    }
    catch {
        return [];
    }
}
function writeSaves(list) {
    try {
        localStorage.setItem(SAVES_KEY, JSON.stringify(list));
    }
    catch {
        // 忽略
    }
}
function saveSlot(name, store) {
    const list = listSaves();
    const slot = {
        id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
        name: name.trim() || '未命名存檔',
        updated: Date.now(),
        payload: store.serialize(),
    };
    list.unshift(slot);
    writeSaves(list);
    return slot;
}
function updateSlot(id, store) {
    const list = listSaves();
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0)
        return false;
    list[idx].payload = store.serialize();
    list[idx].updated = Date.now();
    writeSaves(list);
    return true;
}
function loadSlot(id, store) {
    const slot = listSaves().find((s) => s.id === id);
    if (!slot)
        return false;
    return store.deserialize(slot.payload);
}
function deleteSlot(id) {
    const list = listSaves().filter((s) => s.id !== id);
    writeSaves(list);
    return true;
}
function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

return { compactJsonDumps, autosave, autoload, downloadSave, saveAs, importData, listSaves, saveSlot, updateSlot, loadSlot, deleteSlot };
},
    "m15": function (require) {
/**
 * 計時器（M5，對照原版競速狀態機）
 * 狀態：idle（待打亂）→ ready（就緒，空格開始）→ running → solved | dnf
 */
function formatTime(ms) {
    if (ms === null)
        return '-';
    const total = ms / 1000;
    const minutes = Math.floor(total / 60);
    const sec = total - minutes * 60;
    if (minutes > 0)
        return `${minutes}:${sec.toFixed(2).padStart(5, '0')}`;
    return sec.toFixed(2);
}
class Timer {
    constructor() {
        this.state = 'idle';
        this.startMs = 0;
        this.endMs = 0;
    }
    get elapsedMs() {
        if (this.state === 'running')
            return performance.now() - this.startMs;
        if (this.state === 'solved' || this.state === 'dnf')
            return this.endMs - this.startMs;
        return 0;
    }
    /** 打亂完成後進入 ready（就緒，空格開始）。 */
    enterReady() {
        this.state = 'ready';
        this.startMs = 0;
        this.endMs = 0;
    }
    /** 取消計時 / 切模式 / 換謎題：回到 idle（待打亂）。 */
    cancel() {
        this.state = 'idle';
        this.startMs = 0;
        this.endMs = 0;
    }
    /** 首次合法移動或按空白：ready → running。 */
    start() {
        if (this.state !== 'ready')
            return;
        this.state = 'running';
        this.startMs = performance.now();
    }
    /** 完成（solved 自動停錶）。 */
    solve() {
        if (this.state !== 'running')
            return this.elapsedMs;
        this.endMs = performance.now();
        this.state = 'solved';
        return this.elapsedMs;
    }
    /** 手動 DNF。 */
    dnf() {
        if (this.state !== 'running')
            return;
        this.state = 'dnf';
        this.endMs = performance.now();
    }
    get isRunning() {
        return this.state === 'running';
    }
}

return { formatTime, Timer };
},
    "m16": function (require) {
/**
 * 成績記錄（M6）：按 puzzle 分組存 localStorage，統計 count/best/worst/ao5/ao12/dnf。
 * 對照 records.py 的語義（AoN 取最近 n 次、去掉最好與最差、DNF 視為無窮）。
 */
const STORAGE_KEY = 'gatennea-slider-web:records';
/** 平均（AoN）。不足 n 次回 null；窗口內含 DNF 回 'DNF'；否則平均毫秒。 */
function avgOf(times, n) {
    if (times.length < n)
        return null;
    const window = times.slice(-n);
    const vals = window.map((t) => (t === null ? Infinity : t)).sort((a, b) => a - b);
    const trimmed = vals.slice(1, -1);
    if (trimmed.some((v) => v === Infinity))
        return 'DNF';
    return trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
}
function stats(records) {
    const times = records.map((r) => (r.dnf ? null : r.time_ms));
    const valid = times.filter((t) => t !== null);
    return {
        count: records.length,
        best: valid.length ? Math.min(...valid) : null,
        worst: valid.length ? Math.max(...valid) : null,
        mean: valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null,
        dnf_count: times.length - valid.length,
        ao5: avgOf(times, 5),
        ao12: avgOf(times, 12),
    };
}
/**
 * 逐行成績：每條都帶上「到那一條為止」的 Ao5/Ao12。
 * 對照原版 records.py::series —— 列表是 csTimer 那種三列，不是只看最後一個平均值。
 */
function series(records) {
    const times = records.map((r) => (r.dnf ? null : r.time_ms));
    return records.map((item, i) => ({
        item,
        ao5: avgOf(times.slice(0, i + 1), 5),
        ao12: avgOf(times.slice(0, i + 1), 12),
    }));
}
/** TPS（每秒步數），與原版同口徑：moves / 秒。時間 0 或無步數時回 0。 */
function tpsOf(item) {
    if (!item.time_ms || item.time_ms <= 0)
        return 0;
    return item.moves / (item.time_ms / 1000);
}
/**
 * 把一組方塊座標畫成等寬文字地圖（開局局面用）。
 * 正常化到左上角為原點，每格兩個字寬（██ / ··），讓 HTML 裡對齊得像棋盤。
 */
function blocksToMap(blocks) {
    if (!blocks || blocks.length === 0)
        return [];
    const rows = blocks.map((b) => b[0]);
    const cols = blocks.map((b) => b[1]);
    const minR = Math.min(...rows);
    const maxR = Math.max(...rows);
    const minC = Math.min(...cols);
    const maxC = Math.max(...cols);
    const set = new Set(blocks.map(([r, c]) => `${r}:${c}`));
    const out = [];
    for (let r = minR; r <= maxR; r++) {
        let line = '';
        for (let c = minC; c <= maxC; c++)
            line += set.has(`${r}:${c}`) ? '██' : '··';
        out.push(line);
    }
    return out;
}
function puzzleKey(m, n, step) {
    return `${step}~${m}*${n}`;
}
class Records {
    constructor() {
        this.data = {};
        this.load();
    }
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            this.data = raw ? JSON.parse(raw) : {};
        }
        catch {
            this.data = {};
        }
    }
    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        }
        catch {
            /* ignore */
        }
    }
    /** numbered：數字形態另算一組（對照原版 puzzle_key 的 #num 後綴）。 */
    add(m, n, step, timeMs, moves, dnf, numbered = false, initial) {
        var _a;
        const item = {
            id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            ts: Date.now(),
            m,
            n,
            step,
            time_ms: Math.round(timeMs),
            moves,
            dnf,
        };
        if (initial && initial.length)
            item.initial = initial;
        const key = numbered ? `${puzzleKey(m, n, step)}#num` : puzzleKey(m, n, step);
        ((_a = this.data)[key] ?? (_a[key] = [])).push(item);
        this.save();
        return item;
    }
    get(key) {
        return this.data[key] ?? [];
    }
    delete(key, id) {
        const list = this.data[key];
        if (!list)
            return false;
        const idx = list.findIndex((r) => r.id === id);
        if (idx < 0)
            return false;
        list.splice(idx, 1);
        if (list.length === 0)
            delete this.data[key];
        this.save();
        return true;
    }
    allKeys() {
        return Object.keys(this.data);
    }
}

return { avgOf, stats, series, tpsOf, blocksToMap, puzzleKey, Records };
},
    "m17": function (require) {
/**
 * 新手教程控制器（對照原版 gui/tutorial.py 的 TutorialMixin 數據驅動設計）
 *
 * 移植要點：
 * - 關卡數據由 scripts/gen-tutorial-data.mjs 從原版 beginner_archive + tutorial_texts.json 生成，
 *   內聯進 tutorialData.ts，file:// 下無需 fetch。
 * - 第 1 關為互動教學（選縫→選塊→推→撤銷→重做→挑戰還原）；其餘關「少量引導 + 自己還原過關」，
 *   解法可一鍵回放（依序把存檔快照重播，沒解法的占位關顯示「敬請期待」）。
 * - 過關評分沿用原版公式：存檔步數 / 玩家步數 * 100（封頂 100）。
 * - 關卡解鎖遞進、完成度持久化到 localStorage。
 *
 * 與 main.ts 解耦：只透過 TutorialHost 拿遊戲物件與幾個 UI 鉤子，不反向依賴 main。
 */
const { TUTORIAL_LEVELS, TUTORIAL_ORDER, TUTORIAL_ARCHIVES, TUTORIAL_TEXTS } = require("../tutorial/tutorialData.js");
const { COLORS, GEOMETRY } = require("../render/theme.js");
// 生成的資料是「字面值鍵」型別，直接用 string 索引會報錯；統一以 any 視之最省事
const ARCHIVES = TUTORIAL_ARCHIVES;
const TEXTS = TUTORIAL_TEXTS;
const LEVELS = TUTORIAL_LEVELS;
const BRAND = '#4696c8';
const PROGRESS_KEY = 'gatennea-web:tutorial-progress';
function snapshotBlocks(snap) {
    const out = [];
    const m = snap?.matrix;
    const b = snap?.bounds;
    if (!Array.isArray(m) || !b)
        return out;
    for (let r = 0; r < m.length; r++) {
        const row = m[r];
        if (!Array.isArray(row))
            continue;
        for (let c = 0; c < row.length; c++) {
            if (row[c] === 1)
                out.push([b.min_row + r, b.min_col + c]);
        }
    }
    return out;
}
function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
}
/**
 * 把 from/to 兩個「以 [row,col] 列表描述的局面」做滑塊對齊，
 * 使 start[k] 與 end[k] 指向同一個物理滑塊（位置級插值才不會把整排一起平移）。
 * Gatennea 每次移動至多一個滑塊越過缺口，故先用「位置相同」配對靜止塊，
 * 剩餘的用最近距離貪心配對（即移動中的滑塊）。
 *
 * 關鍵：start/end 必須以「from 的索引順序」回填（start[i]=from[i]），
 * 這樣渲染器才能用 animation.start[idx]/end[idx] 對應到 game.blocks[idx]。
 */
function alignSnapshots(from, to) {
    const start = new Array(from.length);
    const end = new Array(from.length);
    const usedTo = new Array(to.length).fill(false);
    const unmatched = [];
    for (let i = 0; i < from.length; i++) {
        const f = from[i];
        let m = -1;
        for (let j = 0; j < to.length; j++) {
            if (!usedTo[j] && to[j][0] === f[0] && to[j][1] === f[1]) {
                m = j;
                break;
            }
        }
        if (m >= 0) {
            usedTo[m] = true;
            start[i] = [f[0], f[1]];
            end[i] = [to[m][0], to[m][1]];
        }
        else {
            unmatched.push(i);
        }
    }
    for (const i of unmatched) {
        let best = -1;
        let bestD = Infinity;
        for (let j = 0; j < to.length; j++) {
            if (usedTo[j])
                continue;
            const d = Math.abs(to[j][0] - from[i][0]) + Math.abs(to[j][1] - from[i][1]);
            if (d < bestD) {
                bestD = d;
                best = j;
            }
        }
        if (best >= 0) {
            usedTo[best] = true;
            start[i] = [from[i][0], from[i][1]];
            end[i] = [to[best][0], to[best][1]];
        }
    }
    return { start, end };
}
class TutorialController {
    constructor(host) {
        this.active = false; // 章節系統是否運行中
        this.teaching = false; // 是否為第 1 關互動教學
        this.replaying = false; // 是否正在回放解法
        this.completed = false; // 當前關是否已過關（避免重複觸發）
        this.challengeStep = false; // 教學進入「挑戰」後才檢查 solved
        this.currentSub = null;
        this.returnSave = null;
        this.teachingSteps = [];
        this.teachingIdx = -1;
        this.levelSelect = null;
        this.host = host;
        this.bar = document.createElement('div');
        this.bar.style.position = 'fixed';
        this.bar.style.left = '50%';
        this.bar.style.bottom = `${GEOMETRY.status_bar_height + 12}px`;
        this.bar.style.transform = 'translateX(-50%)';
        this.bar.style.display = 'none';
        this.bar.style.alignItems = 'center';
        this.bar.style.gap = '10px';
        this.bar.style.maxWidth = 'calc(100vw - 24px)';
        this.bar.style.background = COLORS.dialog_bg;
        this.bar.style.border = `1px solid ${COLORS.dialog_border}`;
        this.bar.style.borderRadius = '8px';
        this.bar.style.padding = '8px 12px';
        this.bar.style.color = COLORS.dialog_text;
        this.bar.style.fontSize = '13px';
        this.bar.style.lineHeight = '1.5';
        this.bar.style.zIndex = '800';
        this.bar.style.boxShadow = '0 2px 10px rgba(0,0,0,0.45)';
        this.barText = document.createElement('span');
        this.barText.style.flex = '1';
        this.barText.style.whiteSpace = 'pre-line';
        this.barBtns = document.createElement('span');
        this.barBtns.style.display = 'flex';
        this.barBtns.style.gap = '8px';
        this.barBtns.style.flex = '0 0 auto';
        this.bar.append(this.barText, this.barBtns);
        host.app.appendChild(this.bar);
    }
    // ---------- 進度持久化 ----------
    loadProgress() {
        try {
            return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        }
        catch {
            return {};
        }
    }
    saveProgress(p) {
        try {
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
        }
        catch {
            /* 隱私模式寫不進：不影響遊戲 */
        }
    }
    isUnlocked(subId) {
        const i = TUTORIAL_ORDER.indexOf(subId);
        if (i <= 0)
            return true;
        const prev = TUTORIAL_ORDER[i - 1];
        return this.loadProgress()[prev] !== undefined;
    }
    isCompleted(subId) {
        return this.loadProgress()[subId] !== undefined;
    }
    /** 供 main 判斷是否要跳過自動存檔。 */
    chapterActive() {
        return this.active;
    }
    /** 當前是否正在回放解法（main 的 onChanged 應因此跳過自動存檔與過關偵測）。 */
    isReplaying() {
        return this.replaying;
    }
    // ---------- 選關面板 ----------
    openLevelSelect() {
        this.closeLevelSelect();
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.55)';
        overlay.style.zIndex = '2000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.addEventListener('click', () => this.closeLevelSelect());
        const box = document.createElement('div');
        box.style.background = COLORS.dialog_bg;
        box.style.border = `1px solid ${COLORS.dialog_border}`;
        box.style.borderRadius = '10px';
        box.style.padding = '18px';
        box.style.width = 'min(560px, 92vw)';
        box.style.maxHeight = '86vh';
        box.style.overflowY = 'auto';
        box.style.color = COLORS.dialog_text;
        box.style.fontSize = '13px';
        box.style.boxShadow = '0 6px 24px rgba(0,0,0,0.5)';
        box.addEventListener('click', (e) => e.stopPropagation());
        const title = document.createElement('div');
        title.textContent = TEXTS.level_select?.title ?? '选择关卡';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '15px';
        title.style.marginBottom = '4px';
        box.appendChild(title);
        const sub = document.createElement('div');
        sub.textContent = '完成一關才會解鎖下一關；點擊已解鎖的關卡開始。';
        sub.style.opacity = '0.7';
        sub.style.marginBottom = '12px';
        box.appendChild(sub);
        for (const lv of LEVELS) {
            const lvHead = document.createElement('div');
            lvHead.textContent = lv.title;
            lvHead.style.fontWeight = 'bold';
            lvHead.style.margin = '12px 0 6px';
            lvHead.style.color = BRAND;
            box.appendChild(lvHead);
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
            grid.style.gap = '8px';
            for (const sub2 of lv.sublevels) {
                grid.appendChild(this.makeLevelButton(sub2));
            }
            box.appendChild(grid);
        }
        const exit = mkBtn('回到练习模式', false, () => this.closeLevelSelect());
        exit.style.marginTop = '16px';
        box.appendChild(exit);
        overlay.appendChild(box);
        this.host.app.appendChild(overlay);
        this.levelSelect = overlay;
    }
    closeLevelSelect() {
        if (this.levelSelect) {
            this.levelSelect.remove();
            this.levelSelect = null;
        }
    }
    makeLevelButton(sub) {
        const btn = document.createElement('button');
        btn.style.textAlign = 'left';
        btn.style.background = COLORS.input_bg;
        btn.style.color = COLORS.dialog_text;
        btn.style.border = `1px solid ${COLORS.border}`;
        btn.style.borderRadius = '6px';
        btn.style.padding = '8px 10px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';
        const hasArchive = !!ARCHIVES[sub.archiveId];
        const completed = this.isCompleted(sub.id);
        const unlocked = this.isUnlocked(sub.id);
        const mark = completed ? `  ✓${this.loadProgress()[sub.id] ?? ''}` : unlocked ? '' : '  🔒';
        btn.textContent = sub.title + mark;
        if (!hasArchive) {
            btn.title = '敬请期待（本关为占位，尚未制作）';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
        else if (!unlocked) {
            btn.title = '完成上一关后解锁';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
        else {
            btn.addEventListener('click', () => {
                this.closeLevelSelect();
                this.startSublevel(sub.id);
            });
        }
        return btn;
    }
    // ---------- 開始某關 ----------
    startSublevel(subId) {
        const sub = this.findSublevel(subId);
        const archive = ARCHIVES[sub?.archiveId ?? ''];
        if (!sub || !archive) {
            this.host.showToast('这一关还在制作中，敬请期待~');
            return;
        }
        this.returnSave = this.host.store.serialize();
        this.host.ensurePractice();
        this.active = true;
        this.currentSub = subId;
        this.replaying = false;
        this.completed = false;
        this.challengeStep = false;
        this.teaching = false;
        const pz = archive.puzzle;
        const blocks = snapshotBlocks(archive.history.snapshots[0]);
        this.host.store.solutionMask = null;
        this.host.store.applyPuzzle(pz.m, pz.n, pz.step, blocks);
        this.host.renderer.solutionMask = null;
        this.host.centerCamera();
        if (sub.teaching) {
            this.startTeaching();
        }
        else {
            this.showBar(sub.guidance ?? '', [
                this.replayEnabled(archive) ? mkBtn('查看解法', true, () => this.viewSolution()) : null,
                mkBtn('退出', false, () => this.exit()),
            ]);
        }
        this.host.schedulePaint();
    }
    startTeaching() {
        this.teaching = true;
        // 第 1 關：先用一塊「完整還原的 3×3」教基礎操作（撤銷/重做才有東西可動），
        // 進入「挑戰」時再載入官方亂局讓玩家自己還原。
        this.host.store.solutionMask = null;
        this.host.store.newPuzzle(3, 3, 1);
        this.host.renderer.solutionMask = null;
        this.host.centerCamera();
        const steps = TEXTS.levels?.['1']?.steps;
        this.teachingSteps = steps
            ? [
                { text: steps['1'], wait: 'gap' },
                { text: steps['2'], wait: 'block' },
                { text: steps['3'], wait: 'move' },
                { text: steps['4'], wait: 'undo' },
                { text: steps['5'], wait: 'redo' },
                { text: steps['6'], wait: 'solved' },
                { text: steps['7'], wait: 'final' },
            ]
            : [{ text: '把这块拼图还原成完整矩形即可过关！', wait: 'solved' }];
        this.teachingIdx = 0;
        this.showBar(this.teachingSteps[0].text, [mkBtn('跳过引导', false, () => this.exit())]);
    }
    findSublevel(subId) {
        for (const lv of LEVELS) {
            const s = lv.sublevels.find((x) => x.id === subId);
            if (s)
                return s;
        }
        return null;
    }
    replayEnabled(archive) {
        return Array.isArray(archive?.history?.snapshots) && archive.history.snapshots.length > 1;
    }
    // ---------- 每次重繪呼叫（main 的 schedulePaint 中觸發）----------
    tick() {
        if (!this.active || this.replaying || this.completed)
            return;
        if (this.teaching) {
            this.tickTeaching();
            return;
        }
        if (this.challengeStep && this.host.store.solved)
            this.complete();
    }
    /** 移動提交後（main 的 onChanged 中觸發）。 */
    onMoved() {
        if (!this.active || this.replaying || this.completed)
            return;
        if (this.teaching) {
            if (this.challengeStep) {
                if (this.host.store.solved)
                    this.complete();
                return;
            }
            const w = this.teachingSteps[this.teachingIdx]?.wait;
            if (w === 'move')
                this.advanceTeaching();
            return;
        }
        if (this.challengeStep && this.host.store.solved)
            this.complete();
    }
    onUndo() {
        if (this.teaching && this.teachingSteps[this.teachingIdx]?.wait === 'undo')
            this.advanceTeaching();
    }
    onRedo() {
        if (this.teaching && this.teachingSteps[this.teachingIdx]?.wait === 'redo')
            this.advanceTeaching();
    }
    tickTeaching() {
        if (this.teachingIdx < 0)
            return;
        const step = this.teachingSteps[this.teachingIdx];
        if (!step)
            return;
        if (step.wait === 'gap') {
            const g = this.host.store.cmd.selectedGap;
            if (g)
                this.advanceTeaching();
        }
        else if (step.wait === 'block') {
            if (this.host.store.game.selected.size > 0)
                this.advanceTeaching();
        }
        // move/undo/redo/solved 由 onMoved/onUndo/onRedo 收尾
    }
    advanceTeaching() {
        this.teachingIdx += 1;
        const step = this.teachingSteps[this.teachingIdx];
        if (!step) {
            this.complete();
            return;
        }
        if (step.wait === 'solved' && !this.challengeStep) {
            // 進入挑戰：載入官方亂局，玩家自己還原
            const archive = ARCHIVES['1'];
            if (archive) {
                const pz = archive.puzzle;
                this.host.store.solutionMask = null;
                this.host.store.applyPuzzle(pz.m, pz.n, pz.step, snapshotBlocks(archive.history.snapshots[0]));
                this.host.renderer.solutionMask = null;
                this.host.centerCamera();
            }
            this.challengeStep = true;
            this.showBar(step.text, [mkBtn('查看解法', true, () => this.viewSolution()), mkBtn('退出', false, () => this.exit())]);
            this.host.schedulePaint();
            return;
        }
        this.barText.textContent = step.text;
        this.host.schedulePaint();
    }
    // ---------- 過關 ----------
    computeScore(subId) {
        const archive = ARCHIVES[this.findSublevel(subId)?.archiveId ?? ''];
        const solSteps = archive?.step_count ?? 0;
        const playerSteps = this.host.store.cmd.stepCount;
        if (solSteps <= 0)
            return 100; // 沒有參考解（如第1關）統一給滿分
        if (playerSteps <= 0)
            return 100;
        let s = Math.round((solSteps / playerSteps) * 100);
        if (s > 100)
            s = 100;
        if (s < 0)
            s = 0;
        return s;
    }
    complete() {
        if (this.completed)
            return;
        this.completed = true;
        const subId = this.currentSub;
        if (subId) {
            const score = this.computeScore(subId);
            const p = this.loadProgress();
            p[subId] = Math.max(p[subId] ?? 0, score);
            this.saveProgress(p);
        }
        this.teaching = false;
        const sub = this.findSublevel(subId ?? '');
        const notify = sub ? sub.title + ' 完成！' : '过关！';
        this.host.showToast(notify);
        // 過關後：顯示成績與下一步
        const nextId = this.nextSublevel(subId);
        const btns = [];
        if (nextId) {
            btns.push(mkBtn('下一关', true, () => this.startSublevel(nextId)));
        }
        btns.push(mkBtn('返回练习', false, () => this.exit()));
        const scoreLine = subId ? `\n得分 ${this.computeScore(subId)}` : '';
        this.showBar(notify + scoreLine + '\n（可继续下一关，或返回练习模式）', btns);
        this.host.schedulePaint();
    }
    nextSublevel(subId) {
        if (!subId)
            return null;
        const i = TUTORIAL_ORDER.indexOf(subId);
        if (i < 0 || i + 1 >= TUTORIAL_ORDER.length)
            return null;
        return TUTORIAL_ORDER[i + 1];
    }
    // ---------- 查看解法（回放存檔歷史）----------
    async viewSolution() {
        const subId = this.currentSub;
        const archive = ARCHIVES[this.findSublevel(subId ?? '')?.archiveId ?? ''];
        if (!archive || !this.replayEnabled(archive)) {
            this.host.showToast('暂无解法可回放');
            return;
        }
        this.replaying = true;
        this.host.showToast('正在回放解法…');
        const pz = archive.puzzle;
        const snaps = archive.history.snapshots.map((s) => snapshotBlocks(s));
        // 回到起點
        this.host.store.solutionMask = null;
        this.host.store.applyPuzzle(pz.m, pz.n, pz.step, snaps[0]);
        this.host.renderer.solutionMask = null;
        this.host.schedulePaint();
        // 取法：取所有快照的聯集邊界，回放全程固定取景（缺口滑出矩陣時版面不會亂跳）。
        let mnR = Infinity, mxR = -Infinity, mnC = Infinity, mxC = -Infinity;
        for (const s of snaps) {
            for (const [r, c] of s) {
                if (r < mnR)
                    mnR = r;
                if (r > mxR)
                    mxR = r;
                if (c < mnC)
                    mnC = c;
                if (c > mxC)
                    mxC = c;
            }
        }
        this.host.frameBounds(mnR, mnC, mxR, mxC);
        await delay(350);
        // 依序把每個快照重播（位置級插值過渡，與歷史動畫一致，與步長無關）。
        // 原版「其餘關」的解法查看就是重播存檔歷史，而非重模擬移動指令，
        // 這樣能避開 move_info.step 與 puzzle.step 偶爾不一致的脫鉤問題。
        for (let i = 1; i < snaps.length; i++) {
            await this.animateStatic(snaps[i - 1], snaps[i]);
            this.host.store.applyPuzzle(pz.m, pz.n, pz.step, snaps[i]);
            this.host.store.cmd.stepCount = i;
            this.host.schedulePaint();
            await delay(140);
        }
        await delay(550);
        // 回到起點讓玩家自己試（重新對準起點局面）
        this.host.store.solutionMask = null;
        this.host.store.applyPuzzle(pz.m, pz.n, pz.step, snaps[0]);
        this.host.renderer.solutionMask = null;
        this.host.centerCamera();
        this.replaying = false;
        this.completed = false;
        this.host.schedulePaint();
        this.host.showToast('已回到起点，试着自己还原吧');
    }
    /**
     * 位置級插值過渡：依據 from/to 把對應的滑塊平滑移動到新位置（與步長無關）。
     * 用 alignSnapshots 做滑塊對齊，避免「整排一起平移」的錯覺。
     */
    animateStatic(from, to) {
        return new Promise((resolve) => {
            const r = this.host.renderer;
            const { start, end } = alignSnapshots(from, to);
            r.animation = { start, end, progress: 0, durationMs: this.host.controller.moveDurationMs };
            const t0 = performance.now();
            const frame = (now) => {
                const a = r.animation;
                if (!a)
                    return resolve();
                const p = Math.min(1, (now - t0) / a.durationMs);
                a.progress = p;
                this.host.schedulePaint();
                if (p < 1)
                    requestAnimationFrame(frame);
                else {
                    r.animation = null;
                    resolve();
                }
            };
            requestAnimationFrame(frame);
        });
    }
    // ---------- 退出 ----------
    exit() {
        this.active = false;
        this.teaching = false;
        this.replaying = false;
        this.completed = false;
        this.challengeStep = false;
        this.currentSub = null;
        if (this.returnSave) {
            this.host.store.deserialize(this.returnSave);
            this.returnSave = null;
        }
        this.hideBar();
        this.host.ensurePractice();
        this.host.centerCamera();
        this.host.schedulePaint();
    }
    // ---------- 引導條 ----------
    showBar(text, btns) {
        this.barText.textContent = text;
        this.barBtns.innerHTML = '';
        for (const b of btns)
            if (b)
                this.barBtns.appendChild(b);
        this.bar.style.display = 'flex';
    }
    hideBar() {
        this.bar.style.display = 'none';
    }
}
function mkBtn(label, primary, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.background = primary ? BRAND : COLORS.input_bg;
    b.style.color = '#fff';
    b.style.border = primary ? 'none' : `1px solid ${COLORS.border}`;
    b.style.borderRadius = '4px';
    b.style.padding = '5px 12px';
    b.style.cursor = 'pointer';
    b.style.fontSize = '12px';
    b.style.whiteSpace = 'nowrap';
    b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
    });
    return b;
}

return { TutorialController };
},
    "m18": function (require) {
/**
 * 新手教程數據（由 scripts/gen-tutorial-data.mjs 自動生成，來源為原版 GatenneaSlider）。
 * 內聯以避免 file:// 下 fetch 本地 JSON 失敗。請勿手動編輯。
 *
 * - TUTORIAL_TEXTS：原版 gui/tutorial_texts.json（含 prompt / level_select / score / 各關文案）
 * - TUTORIAL_LEVELS：關卡層級結構（levels → sublevels），每個 sublevel 指向一個 archiveId
 * - TUTORIAL_ARCHIVES：各關存檔（與 GameStore.deserialize 相容的 {version,puzzle,step_count,history}）
 *   其中 snapshots 為「解法序列」：snapshot[0] 是起始亂局，snapshot[last] 是已還原的目標；
 *   「查看解法」即依序把這些快照播一遍。
 *   體積佔 app.js 絕大部分，故以緊湊 JSON 字串內聯（見生成腳本註解），解析後結構不變。
 */
const TUTORIAL_TEXTS = {
    "prompt": {
        "title": "新手教程",
        "body": "本游戏带有由浅入深的新手教程（待完善）。\n第 1 关会带你先学会基本操作。\n（可随时在 谜题菜单 → 新手教程 回顾，也可跳过）",
        "start_btn": "开始教程",
        "skip_btn": "跳过"
    },
    "level_select": {
        "title": "选择关卡",
        "locked": "待补充",
        "completed_mark": "✓",
        "exit_btn": "回到练习模式"
    },
    "score": {
        "notify": "本次得分 {score}",
        "best": "最高 {score}"
    },
    "levels": {
        "1": {
            "title": "第 1 关·基本操作",
            "steps": {
                "1": "① 选中缝隙\n这是一块完整还原的滑块组\n（请留意底部标题：2~4*4）。\n请先点击一条「缝隙」（滑块间的分隔线），\n它会变成红色。",
                "2": "② 选中一部分滑块\n请点击缝隙一侧的任意滑块\n变成绿色的为已选中。",
                "3": "③ 移动滑块\n请按 方向键W/A/S/D 将滑块组移动一次\n（虚拟键盘的按键也可以）。\n\n注意：整组滑块必须一直连在一起。\n如果某次移动会让滑块组“断开成两截”，这次移动就无法执行（游戏会自动阻止）。",
                "4": "④ 撤销\n请按 Ctrl+Z 撤销刚才的移动\n棋盘会回到上一步",
                "5": "⑤ 重做\n请按 Ctrl+X 重做一次\n刚才的移动会被重新应用",
                "6": "⑥ 挑战\n注意到了吗？底部标题改变了：1~3*3。\n第一个数字叫步长（等级）：滑块每次统一移动的格数。\n后两个数字叫尺寸，即还原时的大小。本关步长为 1：按一次方向键就移动 1 格。\n步长越大移动越快，但也更难控制。\n\n尺寸：本关是 3×3，即 3 行 3 列。\n谜题越大越难；通关后还有更大的挑战等着你。\n\n请把这块拼图还原成完整矩形，即可过关！\n（不会解时可点「查看解法」）",
                "7": "✓ 过关！\n第 1 关完成！你已经掌握了基本操作。\n"
            },
            "complete_notify": "过关！第 1 关完成"
        },
        "2": {
            "title": "第 2 关·填洞",
            "sublevel_titles": {
                "2.1": "2.1 单洞填补",
                "2.2": "2.2 更大的谜题",
                "2.3": "2.3 内部洞 + 底部大缺口"
            },
            "sublevels": {
                "2.1": "滑块组内部缺了一块，试试把右下角凸起的滑块放入孔洞。",
                "2.2": "尺寸更大了，但方法差不多，只是要多走几步。",
                "2.3": "先把凸起移到一边，然后……你应该知道怎么做~"
            },
            "solve_tail": "",
            "complete_notify": "过关！第 2 关（填洞）完成"
        },
        "3": {
            "title": "第 3 关·多洞与分组",
            "sublevel_titles": {
                "3.1": "3.1 两种匹配都可以？",
                "3.2": "3.2 看着近不一定真的近",
                "3.3": "3.3 四个分组",
                "3.4": "3.4 扎堆怎么办？"
            },
            "sublevels": {
                "3.1": "哪个凸起填哪个洞？有时候都可以啦",
                "3.2": "这两个凸起如图宿敌，井水不犯河水",
                "3.3": "总结出规律了吗？实际上，2级谜题的滑块分为四组，打开右下角的着色/连锁功能，可以帮你更快分类，以后就不用一个个尝试啦~",
                "3.4": "上面这些滑块挤在一起，多动脑筋拆开它们才能还原"
            },
            "solve_tail": "",
            "complete_notify": "过关！第 3 关（多洞与分组）完成"
        },
        "4": {
            "title": "第 4 关·缺口",
            "sublevel_titles": {
                "4.1": "4.1 边缺口",
                "4.2": "4.2 多个边缺口",
                "4.3": "4.3 当缺口位于角块时",
                "4.4": "4.4 缺口挡住了填洞？",
                "4.5": "4.5 尺寸太小怎么办",
                "4.6": "4.6 相连的缺口"
            },
            "sublevels": {
                "4.1": "填缺口的填孔洞的大致思路是一样的，不过需要先把缺口开口的一边堵上（这通常至少需要两步），让它转换为一个孔洞，我们可以称其为构造。然后用孔洞解法填上，再逆序做构造。如果你精通魔方或群论就会知道这是常见的共轭操作。",
                "4.2": "想想之前处理多洞的方法",
                "4.3": "角缺口比边缺口更难处理，至少需要三步才能构造一个孔洞出来",
                "4.4": "有时候，缺口的存在会妨碍填洞，因为凸起无法跨过它，不过没关系，一般来说先填缺口是更好的选择",
                "4.5": "4*4的滑块组对于补缺来说，资源显得捉襟见肘。回想之前复原1级谜题的方法，如果你把每个2*2部分视为一个滑块，就可以用'移形换位'大法来造洞",
                "4.6": "处理方法和上一关类似。"
            },
            "solve_tail": "",
            "complete_notify": "过关！第 4 关（缺口）完成"
        },
        "5": {
            "title": "第 5 关·二连刚体凸起",
            "sublevel_titles": {
                "5.1": "5.1 大洞",
                "5.2": "5.2 构建大洞",
                "5.3": "5.3 构建大缺口",
                "5.4": "5.4 拆东墙补西墙",
                "5.5": "5.5 构建大缺口2"
            },
            "sublevels": {
                "5.1": "右侧凸起是两个滑块组成的，不能像3.4中那样直接拆开，我们称其为刚体凸起。而洞刚好也是相同形状，所以可以直接'挤'进去",
                "5.2": "洞可以自由移动，让它变成1*2的形状吧",
                "5.3": "缺口也是类似的",
                "5.4": "左下的缺口和右侧凸起位置相对，这时可以直接'挤'掉这个缺口",
                "5.5": "很可惜，这下不能拆东墙补西墙了"
            },
            "solve_tail": "",
            "complete_notify": "过关！第 5 关（刚体凸起）完成"
        },
        "6": {
            "title": "第 6 关·更复杂的刚体凸起",
            "sublevel_titles": {
                "6.1": "6.1 ...",
                "6.2": "6.2 ...",
                "6.3": "6.3 ...",
                "6.4": "6.4 ...",
                "6.5": "6.5 ..."
            },
            "sublevels": {
                "6.1": "...",
                "6.2": "...",
                "6.3": "...",
                "6.4": "...",
                "6.5": "..."
            },
            "solve_tail": "",
            "complete_notify": "过关！第 6 关（更复杂的刚体凸起）完成"
        }
    }
};
const TUTORIAL_LEVELS = [
    {
        "id": "1",
        "title": "第 1 关·基本操作",
        "complete_notify": "过关！第 1 关完成",
        "solve_tail": "",
        "sublevels": [
            {
                "id": "1",
                "title": "第 1 关·基本操作",
                "guidance": null,
                "steps": {
                    "1": "① 选中缝隙\n这是一块完整还原的滑块组\n（请留意底部标题：2~4*4）。\n请先点击一条「缝隙」（滑块间的分隔线），\n它会变成红色。",
                    "2": "② 选中一部分滑块\n请点击缝隙一侧的任意滑块\n变成绿色的为已选中。",
                    "3": "③ 移动滑块\n请按 方向键W/A/S/D 将滑块组移动一次\n（虚拟键盘的按键也可以）。\n\n注意：整组滑块必须一直连在一起。\n如果某次移动会让滑块组“断开成两截”，这次移动就无法执行（游戏会自动阻止）。",
                    "4": "④ 撤销\n请按 Ctrl+Z 撤销刚才的移动\n棋盘会回到上一步",
                    "5": "⑤ 重做\n请按 Ctrl+X 重做一次\n刚才的移动会被重新应用",
                    "6": "⑥ 挑战\n注意到了吗？底部标题改变了：1~3*3。\n第一个数字叫步长（等级）：滑块每次统一移动的格数。\n后两个数字叫尺寸，即还原时的大小。本关步长为 1：按一次方向键就移动 1 格。\n步长越大移动越快，但也更难控制。\n\n尺寸：本关是 3×3，即 3 行 3 列。\n谜题越大越难；通关后还有更大的挑战等着你。\n\n请把这块拼图还原成完整矩形，即可过关！\n（不会解时可点「查看解法」）",
                    "7": "✓ 过关！\n第 1 关完成！你已经掌握了基本操作。\n"
                },
                "archiveId": "1",
                "teaching": true
            }
        ]
    },
    {
        "id": "2",
        "title": "第 2 关·填洞",
        "complete_notify": "过关！第 2 关（填洞）完成",
        "solve_tail": "",
        "sublevels": [
            {
                "id": "2.1",
                "title": "2.1 单洞填补",
                "guidance": "滑块组内部缺了一块，试试把右下角凸起的滑块放入孔洞。",
                "steps": null,
                "archiveId": "2.1",
                "teaching": false
            },
            {
                "id": "2.2",
                "title": "2.2 更大的谜题",
                "guidance": "尺寸更大了，但方法差不多，只是要多走几步。",
                "steps": null,
                "archiveId": "2.2",
                "teaching": false
            },
            {
                "id": "2.3",
                "title": "2.3 内部洞 + 底部大缺口",
                "guidance": "先把凸起移到一边，然后……你应该知道怎么做~",
                "steps": null,
                "archiveId": "2.3",
                "teaching": false
            }
        ]
    },
    {
        "id": "3",
        "title": "第 3 关·多洞与分组",
        "complete_notify": "过关！第 3 关（多洞与分组）完成",
        "solve_tail": "",
        "sublevels": [
            {
                "id": "3.1",
                "title": "3.1 两种匹配都可以？",
                "guidance": "哪个凸起填哪个洞？有时候都可以啦",
                "steps": null,
                "archiveId": "3.1",
                "teaching": false
            },
            {
                "id": "3.2",
                "title": "3.2 看着近不一定真的近",
                "guidance": "这两个凸起如图宿敌，井水不犯河水",
                "steps": null,
                "archiveId": "3.2",
                "teaching": false
            },
            {
                "id": "3.3",
                "title": "3.3 四个分组",
                "guidance": "总结出规律了吗？实际上，2级谜题的滑块分为四组，打开右下角的着色/连锁功能，可以帮你更快分类，以后就不用一个个尝试啦~",
                "steps": null,
                "archiveId": "3.3",
                "teaching": false
            },
            {
                "id": "3.4",
                "title": "3.4 扎堆怎么办？",
                "guidance": "上面这些滑块挤在一起，多动脑筋拆开它们才能还原",
                "steps": null,
                "archiveId": "3.4",
                "teaching": false
            }
        ]
    },
    {
        "id": "4",
        "title": "第 4 关·缺口",
        "complete_notify": "过关！第 4 关（缺口）完成",
        "solve_tail": "",
        "sublevels": [
            {
                "id": "4.1",
                "title": "4.1 边缺口",
                "guidance": "填缺口的填孔洞的大致思路是一样的，不过需要先把缺口开口的一边堵上（这通常至少需要两步），让它转换为一个孔洞，我们可以称其为构造。然后用孔洞解法填上，再逆序做构造。如果你精通魔方或群论就会知道这是常见的共轭操作。",
                "steps": null,
                "archiveId": "4.1",
                "teaching": false
            },
            {
                "id": "4.2",
                "title": "4.2 多个边缺口",
                "guidance": "想想之前处理多洞的方法",
                "steps": null,
                "archiveId": "4.2",
                "teaching": false
            },
            {
                "id": "4.3",
                "title": "4.3 当缺口位于角块时",
                "guidance": "角缺口比边缺口更难处理，至少需要三步才能构造一个孔洞出来",
                "steps": null,
                "archiveId": "4.3",
                "teaching": false
            },
            {
                "id": "4.4",
                "title": "4.4 缺口挡住了填洞？",
                "guidance": "有时候，缺口的存在会妨碍填洞，因为凸起无法跨过它，不过没关系，一般来说先填缺口是更好的选择",
                "steps": null,
                "archiveId": "4.4",
                "teaching": false
            },
            {
                "id": "4.5",
                "title": "4.5 尺寸太小怎么办",
                "guidance": "4*4的滑块组对于补缺来说，资源显得捉襟见肘。回想之前复原1级谜题的方法，如果你把每个2*2部分视为一个滑块，就可以用'移形换位'大法来造洞",
                "steps": null,
                "archiveId": "4.5",
                "teaching": false
            },
            {
                "id": "4.6",
                "title": "4.6 相连的缺口",
                "guidance": "处理方法和上一关类似。",
                "steps": null,
                "archiveId": "4.6",
                "teaching": false
            }
        ]
    },
    {
        "id": "5",
        "title": "第 5 关·二连刚体凸起",
        "complete_notify": "过关！第 5 关（刚体凸起）完成",
        "solve_tail": "",
        "sublevels": [
            {
                "id": "5.1",
                "title": "5.1 大洞",
                "guidance": "右侧凸起是两个滑块组成的，不能像3.4中那样直接拆开，我们称其为刚体凸起。而洞刚好也是相同形状，所以可以直接'挤'进去",
                "steps": null,
                "archiveId": "5.1",
                "teaching": false
            },
            {
                "id": "5.2",
                "title": "5.2 构建大洞",
                "guidance": "洞可以自由移动，让它变成1*2的形状吧",
                "steps": null,
                "archiveId": "5.2",
                "teaching": false
            },
            {
                "id": "5.3",
                "title": "5.3 构建大缺口",
                "guidance": "缺口也是类似的",
                "steps": null,
                "archiveId": "5.3",
                "teaching": false
            },
            {
                "id": "5.4",
                "title": "5.4 拆东墙补西墙",
                "guidance": "左下的缺口和右侧凸起位置相对，这时可以直接'挤'掉这个缺口",
                "steps": null,
                "archiveId": "5.4",
                "teaching": false
            },
            {
                "id": "5.5",
                "title": "5.5 构建大缺口2",
                "guidance": "很可惜，这下不能拆东墙补西墙了",
                "steps": null,
                "archiveId": "5.5",
                "teaching": false
            }
        ]
    },
    {
        "id": "6",
        "title": "第 6 关·更复杂的刚体凸起",
        "complete_notify": "过关！第 6 关（更复杂的刚体凸起）完成",
        "solve_tail": "",
        "sublevels": [
            {
                "id": "6.1",
                "title": "认识刚体凸起",
                "guidance": "整块一起伸到外面的部分叫「刚体凸起」——推的时候是好几格一起动，没法只挪其中一格。",
                "steps": null,
                "archiveId": "6.1",
                "teaching": false
            },
            {
                "id": "6.2",
                "title": "两个方向的凸起",
                "guidance": "横的竖的都有凸起时，先处理挡住另一个的那个，别急着把最近的推回去。",
                "steps": null,
                "archiveId": "6.2",
                "teaching": false
            },
            {
                "id": "6.3",
                "title": "更长的凸起",
                "guidance": "棋盘变大，凸起也更长。长条要顺着它伸出的方向整条推回去。",
                "steps": null,
                "archiveId": "6.3",
                "teaching": false
            },
            {
                "id": "6.4",
                "title": "缺口连成一片",
                "guidance": "左边缺了一大块、右边鼓出来一大坨——其实是同一件事：盯着那个最大的凸起整体推回去，缺口就跟着补上了。",
                "steps": null,
                "archiveId": "6.4",
                "teaching": false
            },
            {
                "id": "6.5",
                "title": "综合练习",
                "guidance": "凸起不止一个，而且互相牵制。先想清楚次序，别把刚推回去的又挤出来。",
                "steps": null,
                "archiveId": "6.5",
                "teaching": false
            }
        ]
    }
];
/** 攤平後的有序 sublevel id 列表（解鎖鏈順序）。 */
const TUTORIAL_ORDER = [
    "1",
    "2.1",
    "2.2",
    "2.3",
    "3.1",
    "3.2",
    "3.3",
    "3.4",
    "4.1",
    "4.2",
    "4.3",
    "4.4",
    "4.5",
    "4.6",
    "5.1",
    "5.2",
    "5.3",
    "5.4",
    "5.5",
    "6.1",
    "6.2",
    "6.3",
    "6.4",
    "6.5"
];
const TUTORIAL_ARCHIVES = JSON.parse("{\"1\":{\"version\":1,\"puzzle\":{\"m\":3,\"n\":3,\"step\":1},\"step_count\":0,\"history\":{\"history_index\":0,\"snapshots\":[{\"matrix\":[[0,0,1,1,0],[1,1,1,1,0],[0,0,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":-4,\"min_col\":-4,\"max_col\":0}}]}},\"2.1\":{\"version\":1,\"puzzle\":{\"m\":4,\"n\":4,\"step\":2},\"step_count\":3,\"history\":{\"history_index\":3,\"snapshots\":[{\"matrix\":[[1,1,1,1],[1,1,1,1],[1,0,1,1],[1,1,1,1],[0,0,0,1]],\"bounds\":{\"min_row\":0,\"max_row\":4,\"min_col\":0,\"max_col\":3}},{\"matrix\":[[0,0,1,1],[0,0,1,1],[1,1,1,1],[1,1,1,1],[1,0,0,1],[1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":3,\"min_col\":0,\"max_col\":3}},{\"matrix\":[[0,0,1,1],[0,0,1,1],[1,1,1,1],[1,1,1,1],[1,1,0,0],[1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":3,\"min_col\":0,\"max_col\":3}},{\"matrix\":[[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":3,\"min_col\":0,\"max_col\":3}}]}},\"2.2\":{\"version\":1,\"puzzle\":{\"m\":6,\"n\":6,\"step\":2},\"step_count\":5,\"history\":{\"history_index\":5,\"snapshots\":[{\"matrix\":[[0,1,1,1,1,1,1],[0,1,1,1,1,1,1],[0,1,1,1,0,1,1],[0,1,1,1,1,1,1],[1,1,1,1,1,1,1],[0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-1,\"max_col\":5}},{\"matrix\":[[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,0,1,1,0,0],[0,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,0,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":5}}]}},\"2.3\":{\"version\":1,\"puzzle\":{\"m\":9,\"n\":9,\"step\":2},\"step_count\":6,\"history\":{\"history_index\":6,\"snapshots\":[{\"matrix\":[[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":8}},{\"matrix\":[[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,0,0,0,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":8}},{\"matrix\":[[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,0,1,0,0,0,0],[1,1,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":8,\"min_col\":0,\"max_col\":8}},{\"matrix\":[[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,0,0,1,0,0,0,0],[1,1,1,0,0,0,0,0,0],[1,1,1,0,0,0,0,0,0],[1,1,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-4,\"max_row\":8,\"min_col\":0,\"max_col\":8}},{\"matrix\":[[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,0,0,0,0,0,0],[1,1,1,0,0,0,0,0,0],[1,1,1,0,0,0,0,0,0],[1,1,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-4,\"max_row\":8,\"min_col\":0,\"max_col\":8}},{\"matrix\":[[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,0,0,0,0,0,0],[1,1,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":8,\"min_col\":0,\"max_col\":8}},{\"matrix\":[[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":8,\"min_col\":0,\"max_col\":8}}]}},\"3.1\":{\"version\":1,\"puzzle\":{\"m\":8,\"n\":8,\"step\":2},\"step_count\":15,\"history\":{\"history_index\":15,\"snapshots\":[{\"matrix\":[[0,0,0,0,0,0,1,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,0,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,1,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,0,1,0,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[1,1,1,1,1,0,1,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,0,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,0,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":11,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[1,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,1,1,1,0,0,1,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,0,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":13,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[1,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,0,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":13,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[1,1,1,1,1,0,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,0,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":11,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,0,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,0,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,0,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,0,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":11}},{\"matrix\":[[0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,0,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":13}},{\"matrix\":[[0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":13}},{\"matrix\":[[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":11}},{\"matrix\":[[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":7}}]},\"readonly\":false},\"3.2\":{\"version\":1,\"puzzle\":{\"m\":7,\"n\":7,\"step\":2},\"step_count\":13,\"history\":{\"history_index\":13,\"snapshots\":[{\"matrix\":[[0,0,1,0,0,0,0,0],[1,1,1,1,1,1,1,0],[1,1,1,0,1,1,1,0],[1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,0],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,0]],\"bounds\":{\"min_row\":-1,\"max_row\":6,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,0,0,0,0],[0,0,1,1,1,1,1,1,1],[0,0,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,1,1,0,1,1,1,0],[1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":6,\"min_col\":-2,\"max_col\":6}},{\"matrix\":[[0,0,0,0,0,0,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,0,1,1,1,0,0,0],[1,1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":6,\"min_col\":-4,\"max_col\":6}},{\"matrix\":[[0,0,0,0,0,0,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0],[1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,0,1,1,0,0,0,0],[1,1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":6,\"min_col\":-4,\"max_col\":6}},{\"matrix\":[[0,0,0,0,0,0,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,0,1,1,0,0,0,0],[1,1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":6,\"min_col\":-4,\"max_col\":6}},{\"matrix\":[[0,0,0,0,1,0,0,0,0],[0,0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,1,1,0,1,1,0,0],[1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":6,\"min_col\":-2,\"max_col\":6}},{\"matrix\":[[0,0,1,0,0,0,0],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,0,1,1],[1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":6,\"min_col\":0,\"max_col\":6}},{\"matrix\":[[0,0,0,0,1,1,1],[0,0,1,0,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,0,1,1],[1,1,1,1,1,1,1],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":8,\"min_col\":0,\"max_col\":6}},{\"matrix\":[[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,1,0,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,0,1,1],[1,1,1,1,1,1,1],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":10,\"min_col\":0,\"max_col\":6}},{\"matrix\":[[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,1,0,0,1,1],[1,1,1,1,1,1,1],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":12,\"min_col\":0,\"max_col\":6}},{\"matrix\":[[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":12,\"min_col\":0,\"max_col\":6}},{\"matrix\":[[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":10,\"min_col\":0,\"max_col\":6}},{\"matrix\":[[0,0,0,0,1,1,1],[0,0,0,0,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,0,0,0],[1,1,1,1,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":8,\"min_col\":0,\"max_col\":6}},{\"matrix\":[[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":6,\"min_col\":0,\"max_col\":6}}]},\"readonly\":false},\"3.3\":{\"version\":1,\"puzzle\":{\"m\":8,\"n\":8,\"step\":2},\"step_count\":37,\"history\":{\"history_index\":24,\"snapshots\":[{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,0,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,0,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,0,1,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":8,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,0,0],[0,1,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,0,1,1,0,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,0,1,0,1,1],[0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":9,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,0,0],[0,1,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0],[0,1,1,1,0,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,0,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,0,1,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":11,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,0,0],[0,1,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0],[0,1,1,1,0,1,1,0,0],[1,1,1,0,1,1,1,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,0,1,0,0,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":13,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,0,0],[0,1,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0],[0,1,1,1,0,1,1,0,0],[1,1,1,0,1,1,1,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":13,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,0,0],[0,1,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0],[0,1,1,1,0,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":11,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,0,0],[0,1,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,0,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,0,1,1],[0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":9,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,0,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":8,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,0,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":9,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,1,0,0,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":11,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":11,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":9,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,0,0,0,1,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,1,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,0,1,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-4,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[1,1,1,0,0,1,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[1,1,1,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":5,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,0,0,0,0,0],[0,1,0,1,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1],[0,0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":3,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":1,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,1,0,0],[1,0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":1,\"min_col\":-2,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,1,0,0],[1,0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":1,\"min_col\":-2,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":1,\"min_col\":-2,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":1,\"min_col\":0,\"max_col\":7}}]},\"readonly\":false},\"3.4\":{\"version\":1,\"puzzle\":{\"m\":8,\"n\":8,\"step\":2},\"step_count\":31,\"history\":{\"history_index\":31,\"snapshots\":[{\"matrix\":[[0,1,0,0,1,1,1,0],[1,1,1,1,1,1,1,1],[1,1,0,1,0,1,1,1],[1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,1]],\"bounds\":{\"min_row\":-1,\"max_row\":8,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,1,1,0],[0,0,0,0,1,1,1,1],[0,1,0,0,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1],[1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,0,1,1,1,1],[1,1,1,1,0,0,0,1],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":9,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,1,1,0],[0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,1,1,1,1],[0,1,0,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1],[1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,0,0,0,1],[1,0,1,0,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":11,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,1,1,0],[0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,1,1,1,1],[0,0,0,0,1,1,1,1],[0,0,0,0,1,1,1,1],[0,1,0,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1],[1,1,1,0,0,0,0,1],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,0,1,0,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":13,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,1,1,0],[0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,1,1,1,1],[0,0,0,0,1,1,1,1],[0,0,0,0,1,1,1,1],[0,1,0,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1],[1,1,1,0,0,1,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,0,1,0,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":13,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,1,1,0],[0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,1,1,1,1],[0,0,0,0,1,1,1,1],[0,0,0,0,1,1,1,1],[0,1,0,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,0,1,0,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":13,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,1,1,0],[0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,1,1,1,1],[0,1,0,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,0,0,0,0],[1,0,1,0,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":11,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,1,1,0],[0,0,0,0,1,1,1,1],[0,1,0,0,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,0,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,0,1,1,1,1],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":9,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,1,0,0,1,1,1,0],[1,1,1,1,1,1,1,1],[1,1,0,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,1,0,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,0,0,1,1,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-3,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,1,0,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,1,1,1,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-3,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,1,0,1,1,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,0,0,0],[0,0,0,1,1,1,1,1],[0,1,0,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0]],\"bounds\":{\"min_row\":-3,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,0,0,0],[0,0,0,1,1,1,1,1],[0,0,0,1,0,1,1,1],[0,0,0,1,1,1,1,1],[0,1,0,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,0,0,0,0,0],[1,0,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0]],\"bounds\":{\"min_row\":-5,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,0,0,0],[0,0,0,1,1,1,1,1],[0,0,0,1,0,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[0,1,0,0,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,0,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0]],\"bounds\":{\"min_row\":-7,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,0,0,0],[0,0,0,1,1,1,1,1],[0,0,0,1,0,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,0,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0]],\"bounds\":{\"min_row\":-7,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,0,0,0],[0,0,0,1,1,1,1,1],[0,0,0,1,0,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,0,0,0,0,0],[1,0,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0]],\"bounds\":{\"min_row\":-5,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,0,0,0],[0,0,0,1,1,1,1,1],[0,0,0,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0]],\"bounds\":{\"min_row\":-3,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,0,0,0],[0,0,0,0,1,1,1,1],[0,0,0,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-3,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,0,0,1,0],[0,0,0,0,1,1,1,1],[0,0,0,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-3,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,1,0,0,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,1,0,0,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,1,0,0,1,0],[1,1,1,1,1,1,1,1],[1,0,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-4,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,0,0,1,0,0,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-6,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-4,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,0,0,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,0,0,0],[1,1,1,1,0,0,1,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,0,0,0],[1,1,1,1,1,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":7}}]},\"readonly\":false},\"4.1\":{\"version\":1,\"puzzle\":{\"m\":8,\"n\":8,\"step\":2},\"step_count\":8,\"history\":{\"history_index\":8,\"snapshots\":[{\"matrix\":[[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,0,0,0,0,0,0],[0,1,1,0,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,1,1,0,0,0,0,0,0],[0,1,1,0,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":7}}]}},\"4.2\":{\"version\":1,\"puzzle\":{\"m\":8,\"n\":8,\"step\":2},\"step_count\":31,\"history\":{\"history_index\":25,\"snapshots\":[{\"matrix\":[[0,1,1,1,1,0,1,1,1,1],[0,0,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,0,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-1,\"max_col\":8}},{\"matrix\":[[0,0,0,1,1,1,1,0,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0,0,0],[1,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,0,1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-3,\"max_col\":8},\"steps\":1,\"step_total\":1},{\"matrix\":[[0,1,1,1,1,1,1,0,1,1,1,1],[1,1,1,0,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,0,1,1,1,1,1,1,0,0,0],[0,0,0,1,1,1,1,1,1,0,0,0],[0,0,0,1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-3,\"max_col\":8},\"steps\":1,\"step_total\":2},{\"matrix\":[[0,0,1,1,1,1,1,1,0,1,1,1,1],[0,1,1,1,0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0],[1,0,1,1,1,1,1,1,0,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-2,\"max_col\":10},\"steps\":1,\"step_total\":3},{\"matrix\":[[0,0,0,0,1,1,1,1,1,1,0,1,1,1,1],[0,0,0,1,1,1,0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],[1,0,1,1,1,1,1,1,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-2,\"max_col\":12},\"steps\":1,\"step_total\":4},{\"matrix\":[[0,0,0,0,0,0,1,1,1,1,1,1,0,1,1,1,1],[0,0,0,0,0,1,1,1,0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[1,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-2,\"max_col\":14},\"steps\":1,\"step_total\":5},{\"matrix\":[[0,0,0,0,0,0,1,1,1,1,1,1,0,1,1,1,1],[0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[1,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-2,\"max_col\":14},\"steps\":3,\"step_total\":8},{\"matrix\":[[0,1,1,1,1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,0,1,1,1,1,1,1,0,0,0],[0,0,0,1,1,1,1,1,1,0,0,0],[0,0,0,1,1,1,1,1,1,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-3,\"max_col\":8},\"steps\":3,\"step_total\":11},{\"matrix\":[[0,0,0,1,1,1,1,0,1,1,1,1],[0,0,0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0,0,0],[1,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0],[0,1,0,1,1,1,1,1,1,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-3,\"max_col\":8},\"steps\":1,\"step_total\":12},{\"matrix\":[[0,1,1,1,1,0,1,1,1,1],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,0,1,1,1,1,1,1,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-3,\"max_col\":6},\"steps\":1,\"step_total\":13},{\"matrix\":[[0,1,1,1,1,0,0,0,0,0],[0,1,1,1,1,0,0,0,0,0],[0,1,1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,0,1,1,1,1,1,1,0],[0,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,1,1,1,1,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":6},\"steps\":1,\"step_total\":14},{\"matrix\":[[0,0,0,1,1,1,1,0,0,0],[0,0,0,1,1,1,1,0,0,0],[0,1,1,1,1,0,1,1,1,1],[1,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,0,1,1,1,1,1,1,0],[0,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,1,1,1,1,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":6},\"steps\":1,\"step_total\":15},{\"matrix\":[[0,0,0,1,1,1,1,0,0,0],[0,0,0,1,1,1,1,0,0,0],[0,1,1,1,1,0,1,1,1,0],[1,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0],[0,1,0,1,1,1,1,1,1,0],[0,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,1,1,1,1,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":6},\"steps\":1,\"step_total\":16},{\"matrix\":[[0,0,0,0,0,1,1,1,1,0,0],[0,0,0,0,0,1,1,1,1,0,0],[0,0,0,1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,1,0,0],[0,1,0,1,1,1,1,1,1,0,0],[0,0,0,0,0,1,1,1,1,0,0],[0,0,0,0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":7},\"steps\":1,\"step_total\":17},{\"matrix\":[[0,0,0,0,0,0,0,1,1,1,1,0,0],[0,0,0,0,0,0,0,1,1,1,1,0,0],[0,0,0,0,0,1,1,1,1,0,1,1,1],[1,1,1,1,1,1,1,1,1,0,0,0,0],[0,1,1,1,1,1,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0,0],[0,1,0,1,1,1,1,1,1,0,0,0,0],[0,0,0,0,0,1,1,1,1,0,0,0,0],[0,0,0,0,0,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":9},\"steps\":1,\"step_total\":18},{\"matrix\":[[0,0,0,0,0,0,0,1,1,1,1,0,0],[0,0,0,0,0,0,0,1,1,1,1,0,0],[0,0,0,0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,0,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0,0],[0,1,1,1,1,1,1,1,1,0,0,0,0],[0,1,0,1,1,1,1,1,1,0,0,0,0],[0,0,0,0,0,1,1,1,1,0,0,0,0],[0,0,0,0,0,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":9},\"steps\":1,\"step_total\":19},{\"matrix\":[[0,0,0,1,1,1,1,0,0],[0,0,0,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":5},\"steps\":2,\"step_total\":21},{\"matrix\":[[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,0,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,1],[0,0,0,0,0,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":5},\"steps\":1,\"step_total\":22},{\"matrix\":[[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-3,\"max_col\":5},\"steps\":1,\"step_total\":23},{\"matrix\":[[0,1,1,0,0,0,0,0,0],[0,1,1,0,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":5},\"steps\":1,\"step_total\":24},{\"matrix\":[[0,1,1,0,0,0,0,0,0],[0,1,1,0,0,0,0,0,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-3,\"max_col\":5},\"steps\":1,\"step_total\":25},{\"matrix\":[[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":26},{\"matrix\":[[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-4,\"max_col\":5},\"steps\":2,\"step_total\":28},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":29},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":30},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":31}]},\"readonly\":true},\"4.3\":{\"version\":1,\"puzzle\":{\"m\":8,\"n\":8,\"step\":2},\"step_count\":13,\"history\":{\"history_index\":9,\"snapshots\":[{\"matrix\":[[0,1,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-1,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,0,0,0,0,0],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":11},\"steps\":2,\"step_total\":2},{\"matrix\":[[0,0,0,0,0,0,0,0,1,1,1,1],[1,1,1,1,1,1,1,0,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":0,\"max_col\":11},\"steps\":1,\"step_total\":3},{\"matrix\":[[0,0,0,0,0,0,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":0,\"max_col\":11},\"steps\":1,\"step_total\":4},{\"matrix\":[[0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,0,1,1,1,1,0,0,0,0],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0],[0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":-4,\"max_col\":11},\"steps\":2,\"step_total\":6},{\"matrix\":[[0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0],[0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":-4,\"max_col\":11},\"steps\":1,\"step_total\":7},{\"matrix\":[[0,0,0,0,0,0,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":0,\"max_col\":11},\"steps\":2,\"step_total\":9},{\"matrix\":[[0,0,0,0,0,0,0,0,1,1,1,1],[1,1,1,1,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":0,\"max_col\":11},\"steps\":1,\"step_total\":10},{\"matrix\":[[1,1,1,1,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":11},\"steps\":1,\"step_total\":11},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":4,\"max_col\":11},\"steps\":2,\"step_total\":13}]},\"readonly\":true},\"4.4\":{\"version\":1,\"puzzle\":{\"m\":6,\"n\":6,\"step\":2},\"step_count\":15,\"history\":{\"history_index\":11,\"snapshots\":[{\"matrix\":[[0,0,0,1,0,0,0],[0,1,1,1,1,1,1],[0,1,1,1,0,1,1],[0,1,1,1,1,1,1],[0,0,1,1,1,1,1],[0,1,1,1,1,1,1],[1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":5,\"min_col\":-1,\"max_col\":5}},{\"matrix\":[[0,0,1,0,0,0,0,0],[1,1,1,1,1,1,0,0],[1,1,1,0,1,1,0,0],[1,1,1,1,1,1,0,0],[0,0,0,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":1},{\"matrix\":[[0,0,1,0,0,0,0,0],[0,0,1,1,1,1,0,0],[0,0,1,0,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,0,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":2},{\"matrix\":[[0,0,0,0,1,0,0,0],[0,0,1,1,1,1,0,0],[0,0,1,0,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,0,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-1,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":3},{\"matrix\":[[0,0,1,0,0,0,0,0],[0,0,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,0,0,1,0,0,0],[1,1,1,1,1,1,0,0],[0,1,1,0,1,1,0,0],[0,0,0,1,1,1,0,0],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-4,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":2,\"step_total\":5},{\"matrix\":[[0,0,1,0,0,0,0,0],[0,0,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,1,0,0,0,0,0],[1,1,1,1,1,1,0,0],[0,1,1,0,1,1,0,0],[0,0,0,1,1,1,0,0],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1]],\"bounds\":{\"min_row\":-4,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":6},{\"matrix\":[[0,0,1,1,1,1,0,0],[0,0,1,0,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":2,\"step_total\":8},{\"matrix\":[[1,1,1,1,1,1,0,0],[1,1,1,0,1,1,0,0],[1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":9},{\"matrix\":[[0,1,1,1,1,1,1],[0,1,1,1,0,1,1],[0,1,1,1,1,1,1],[1,1,1,1,1,1,1],[0,1,1,1,1,1,1],[0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-1,\"max_col\":5},\"steps\":1,\"step_total\":10},{\"matrix\":[[1,1,1,1,1,1,0,0,0,0],[1,1,1,0,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":2,\"step_total\":12},{\"matrix\":[[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":13},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":5},\"steps\":2,\"step_total\":15}]},\"readonly\":true},\"4.5\":{\"version\":1,\"puzzle\":{\"m\":4,\"n\":4,\"step\":2},\"step_count\":8,\"history\":{\"history_index\":8,\"snapshots\":[{\"matrix\":[[1,1,1,1],[1,1,1,1],[1,1,1,0],[1,1,1,1],[0,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":4,\"min_col\":0,\"max_col\":3}},{\"matrix\":[[0,0,1,1,1,1],[0,0,1,1,1,1],[1,1,1,0,0,0],[1,1,1,1,0,0],[0,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":4,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":1},{\"matrix\":[[0,0,1,1,0,0],[0,0,1,1,0,0],[1,1,1,0,1,1],[1,1,1,1,1,1],[0,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":4,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":2},{\"matrix\":[[1,1,1,1,0,0],[1,1,1,1,0,0],[0,1,1,0,1,1],[0,0,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":3,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":3},{\"matrix\":[[0,1,1,1,1],[0,1,1,1,1],[1,1,0,1,1],[0,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":3,\"min_col\":1,\"max_col\":5},\"steps\":1,\"step_total\":4},{\"matrix\":[[1,1,1,1,1],[0,1,1,1,1],[0,1,0,1,1],[0,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":3,\"min_col\":1,\"max_col\":5},\"steps\":1,\"step_total\":5},{\"matrix\":[[0,1,1,1,1,1],[0,0,1,1,1,1],[1,0,1,1,0,0],[1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":3,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":6},{\"matrix\":[[0,0,1,1,1,1],[0,0,1,1,1,1],[1,1,1,1,0,0],[1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":3,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":7},{\"matrix\":[[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":3,\"min_col\":2,\"max_col\":5},\"steps\":1,\"step_total\":8}]},\"readonly\":true},\"4.6\":{\"version\":1,\"puzzle\":{\"m\":6,\"n\":6,\"step\":2},\"step_count\":18,\"history\":{\"history_index\":18,\"snapshots\":[{\"matrix\":[[0,1,1,1,1,1,1],[0,1,1,1,1,1,1],[1,1,1,1,1,1,0],[1,1,1,1,1,1,0],[1,1,1,1,1,1,0],[1,1,1,1,1,1,0]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":6}},{\"matrix\":[[0,1,1,1,1,1,0],[0,1,1,1,1,1,0],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,0],[1,1,1,1,1,1,0]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":6},\"steps\":1,\"step_total\":1},{\"matrix\":[[0,0,0,1,1,1,1,1],[0,0,0,1,1,1,1,1],[1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":2},{\"matrix\":[[0,0,0,0,0,1,1,1,1,1],[0,0,0,0,0,1,1,1,1,1],[1,1,1,1,1,1,1,0,0,0],[1,1,1,1,1,1,1,0,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":3},{\"matrix\":[[1,1,1,1,0,1,1,1,1,1],[1,1,1,1,0,1,1,1,1,1],[1,1,1,1,1,1,1,0,0,0],[1,1,1,1,1,1,1,0,0,0],[0,0,0,0,1,1,0,0,0,0],[0,0,0,0,1,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":4},{\"matrix\":[[1,1,0,0,0,0,0,0,0,0],[1,1,0,0,0,0,0,0,0,0],[1,1,1,1,0,1,1,1,1,1],[1,1,1,1,0,1,1,1,1,1],[0,0,1,1,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0,0],[0,0,0,0,1,1,0,0,0,0],[0,0,0,0,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":5},{\"matrix\":[[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0],[1,1,1,1,0,1,1,1,1,1],[1,1,1,1,0,1,1,1,1,1],[0,0,1,1,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0,0],[0,0,0,0,1,1,0,0,0,0],[0,0,0,0,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":6},{\"matrix\":[[1,1,1,1,0,0,0,0,0,0],[1,1,1,1,0,0,0,0,0,0],[0,0,1,1,0,1,1,1,1,1],[0,0,1,1,0,1,1,1,1,1],[0,0,1,1,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0,0],[0,0,0,0,1,1,0,0,0,0],[0,0,0,0,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":7},{\"matrix\":[[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,0,1,1,1,1,1],[1,1,0,1,1,1,1,1],[1,1,1,1,1,0,0,0],[1,1,1,1,1,0,0,0],[0,0,1,1,0,0,0,0],[0,0,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":8},{\"matrix\":[[0,0,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,0,0,0,0],[0,0,1,1,0,1,1,1,1,1],[0,0,1,1,0,1,1,1,1,1],[1,1,1,1,1,0,0,0,0,0],[1,1,1,1,1,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":7},\"steps\":1,\"step_total\":9},{\"matrix\":[[0,0,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,0,0,0,0,0,0],[1,1,1,1,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":7},\"steps\":1,\"step_total\":10},{\"matrix\":[[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[0,0,1,1,0,0,0,0],[0,0,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":11},{\"matrix\":[[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,1,1,0,0,0,0],[0,0,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":12},{\"matrix\":[[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":13},{\"matrix\":[[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":3,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":14},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":3,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":15},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":3,\"min_col\":-4,\"max_col\":3},\"steps\":1,\"step_total\":16},{\"matrix\":[[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":3,\"min_col\":-4,\"max_col\":3},\"steps\":1,\"step_total\":17},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":3,\"min_col\":-2,\"max_col\":3},\"steps\":1,\"step_total\":18}]},\"readonly\":true},\"5.1\":{\"version\":1,\"puzzle\":{\"m\":7,\"n\":7,\"step\":2},\"step_count\":4,\"history\":{\"history_index\":4,\"snapshots\":[{\"matrix\":[[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,0,0,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":6,\"min_col\":0,\"max_col\":8}},{\"matrix\":[[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,0,0,1,1,1,1,1],[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":6,\"min_col\":0,\"max_col\":8},\"steps\":1,\"step_total\":1},{\"matrix\":[[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[1,1,0,0,1,1,1,1,1],[0,0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":6,\"min_col\":-2,\"max_col\":6},\"steps\":1,\"step_total\":2},{\"matrix\":[[1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":6,\"min_col\":-2,\"max_col\":6},\"steps\":1,\"step_total\":3},{\"matrix\":[[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1],[1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":6,\"min_col\":0,\"max_col\":6},\"steps\":1,\"step_total\":4}]},\"readonly\":true},\"5.2\":{\"version\":1,\"puzzle\":{\"m\":6,\"n\":6,\"step\":2},\"step_count\":8,\"history\":{\"history_index\":5,\"snapshots\":[{\"matrix\":[[1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,0,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,0,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[1,1,1,1,1,0,0,0],[0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,0,0,1,1],[0,0,1,1,1,1,1,1],[0,0,0,0,0,1,1,1],[0,0,0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":1},{\"matrix\":[[0,0,1,1,1,1,1,0,0,0],[0,0,0,0,1,1,1,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1],[1,1,0,0,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[0,0,0,1,1,1,0,0,0,0],[0,0,0,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":2,\"step_total\":3},{\"matrix\":[[0,0,0,0,1,1,1,0,0,0],[0,0,0,0,1,1,1,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[0,0,0,1,1,1,0,0,0,0],[0,0,0,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":2,\"step_total\":5},{\"matrix\":[[1,1,1,0,0,0],[1,1,1,0,0,0],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[0,0,0,1,1,1],[0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":0,\"max_col\":5},\"steps\":2,\"step_total\":7},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":3,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":8}]},\"readonly\":true},\"5.3\":{\"version\":1,\"puzzle\":{\"m\":6,\"n\":6,\"step\":2},\"step_count\":9,\"history\":{\"history_index\":8,\"snapshots\":[{\"matrix\":[[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,0,1,1,0,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,0,1,0,0],[1,1,1,1,0,0,0,0],[1,0,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":0,\"max_col\":7},\"steps\":1,\"step_total\":1},{\"matrix\":[[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,0,1,0,0],[0,0,1,1,1,1,0,0],[0,0,1,0,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":0,\"max_col\":7},\"steps\":1,\"step_total\":2},{\"matrix\":[[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,1,0,0,1,0,0],[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":7},\"steps\":1,\"step_total\":3},{\"matrix\":[[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,1,0,0,1,1,1],[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":7},\"steps\":2,\"step_total\":5},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[0,0,1,1,1,1],[0,0,1,1,1,1],[0,0,1,1,0,0],[0,0,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":6},{\"matrix\":[[0,0,1,1,1,1],[0,0,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[0,0,1,1,0,0],[0,0,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":7},{\"matrix\":[[0,0,1,1,1,1],[0,0,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,0,0,0,0],[1,1,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":8},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":9}]},\"readonly\":true},\"5.4\":{\"version\":1,\"puzzle\":{\"m\":6,\"n\":6,\"step\":2},\"step_count\":12,\"history\":{\"history_index\":10,\"snapshots\":[{\"matrix\":[[1,1,1,0,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[0,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,1,0,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":7},\"steps\":1,\"step_total\":1},{\"matrix\":[[1,1,1,0,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":2},{\"matrix\":[[0,1,1,1,0,1,1],[0,1,1,1,1,1,1],[0,1,1,1,1,1,1],[0,1,1,1,1,1,1],[1,1,1,1,1,1,1],[0,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-1,\"max_col\":5},\"steps\":1,\"step_total\":3},{\"matrix\":[[0,1,1,1,0,0,0],[0,1,1,1,0,0,0],[0,1,1,1,0,1,1],[0,1,1,1,1,1,1],[1,1,1,1,1,1,1],[0,1,1,1,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-1,\"max_col\":5},\"steps\":1,\"step_total\":4},{\"matrix\":[[0,0,0,1,1,1,0],[0,0,0,1,1,1,0],[0,1,1,1,0,1,1],[0,1,1,1,1,1,1],[1,1,1,1,1,1,1],[0,1,1,1,1,1,1],[0,0,0,0,1,1,1],[0,0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-1,\"max_col\":5},\"steps\":1,\"step_total\":5},{\"matrix\":[[0,0,1,1,1,0,0,0,0,0],[0,0,1,1,1,0,0,0,0,0],[1,1,1,0,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,0,0,0,1,1,1],[0,0,0,0,0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":2,\"step_total\":7},{\"matrix\":[[0,0,1,1,1,0,0,0,0,0],[0,0,1,1,1,0,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,0,0,0,1,1,1],[0,0,0,0,0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":8},{\"matrix\":[[0,0,1,1,1,0],[0,0,1,1,1,0],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[0,0,0,1,1,1],[0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":0,\"max_col\":5},\"steps\":2,\"step_total\":10},{\"matrix\":[[1,1,1,0,0,0],[1,1,1,0,0,0],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[0,0,0,1,1,1],[0,0,0,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":11},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":3,\"min_col\":0,\"max_col\":5},\"steps\":1,\"step_total\":12}]},\"readonly\":true},\"5.5\":{\"version\":1,\"puzzle\":{\"m\":6,\"n\":6,\"step\":2},\"step_count\":13,\"history\":{\"history_index\":13,\"snapshots\":[{\"matrix\":[[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[0,1,1,1,1,0,0,0],[1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,0,0,0],[1,1,1,1,1,1,0,0],[0,1,1,1,0,0,0,0],[1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":0,\"max_col\":7},\"steps\":1,\"step_total\":1},{\"matrix\":[[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,1,1,0,0,0],[0,0,1,1,1,1,1,1],[0,0,0,1,1,1,0,0],[0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5},\"steps\":1,\"step_total\":2},{\"matrix\":[[0,0,0,0,1,1,0,0,0,0],[0,0,0,0,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,0,0,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,0,0],[0,0,0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":3},{\"matrix\":[[0,0,0,0,1,1,0,0,0,0],[0,0,0,0,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,0,1,1,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,0,0],[0,0,0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":4},{\"matrix\":[[0,0,0,0,0,0,1,1,0,0],[0,0,0,0,0,0,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[1,1,1,1,1,0,1,1,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,0,1,1,1,0,0],[0,0,0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":5},{\"matrix\":[[0,0,1,1,1,0,1,1,0,0],[0,0,1,1,1,0,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,0,0,1,1,1,1,0,0],[0,0,0,0,0,0,1,1,0,0],[0,0,0,0,0,1,1,1,1,1],[0,0,0,0,0,1,1,1,0,0],[0,0,0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":6},{\"matrix\":[[0,0,1,1,1,0,1,1,0,0,0,0],[0,0,1,1,1,0,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,0,0,0,0],[0,0,0,0,0,0,1,1,0,0,0,0],[0,0,0,0,0,0,0,1,1,1,1,1],[0,0,0,0,0,0,0,1,1,1,0,0],[0,0,0,0,0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-6,\"max_col\":5},\"steps\":1,\"step_total\":7},{\"matrix\":[[0,0,1,1,1,0,1,1,0,0],[0,0,1,1,1,0,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,0,0,1,1,1,1,0,0],[0,0,0,0,1,1,0,0,0,0],[0,0,0,0,0,1,1,1,1,1],[0,0,0,0,0,1,1,1,0,0],[0,0,0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":8},{\"matrix\":[[0,0,0,0,0,0,1,1,0,0],[0,0,0,0,0,0,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,0,0],[0,0,0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":9},{\"matrix\":[[0,0,0,0,1,1,0,0,0,0],[0,0,0,0,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,0,0,0,0],[0,0,0,0,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,0,0],[0,0,0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":5},\"steps\":1,\"step_total\":10},{\"matrix\":[[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":3},\"steps\":1,\"step_total\":11},{\"matrix\":[[0,0,0,0,1,1],[0,0,0,0,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,0,0],[1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-4,\"max_col\":1},\"steps\":1,\"step_total\":12},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":-4,\"max_col\":1},\"steps\":1,\"step_total\":13}]},\"readonly\":true},\"6.1\":{\"version\":1,\"puzzle\":{\"m\":6,\"n\":6,\"step\":2},\"step_count\":5,\"history\":{\"history_index\":5,\"snapshots\":[{\"matrix\":[[1,1,1,0,1,1,0,0],[1,1,1,0,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,0,1,1,1,0,0],[0,0,0,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,0,0],[1,1,1,0,1,1,0,0],[1,1,1,0,1,1,0,0],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,0,1,0,0,0,0],[0,0,0,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[1,1,1,0,1,1,0,0],[1,1,1,0,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,0,1,1,1,0,0],[0,0,0,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,0,0],[1,1,1,1,1,1,0,0],[1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,0,0],[0,0,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[0,0,0,0,1,1],[0,0,0,0,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,0,0],[1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":0,\"max_col\":5}},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":5}}]}},\"6.2\":{\"version\":1,\"puzzle\":{\"m\":6,\"n\":6,\"step\":2},\"step_count\":8,\"history\":{\"history_index\":8,\"snapshots\":[{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,1,1,0,1,0,1],[1,1,1,1,0,1,0,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,0],[0,0,1,0,1,1,1,0],[0,0,1,0,1,1,0,0],[0,0,1,1,0,0,0,0],[0,0,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[1,1,0,0,0,0,0,0],[1,1,1,1,0,1,0,1],[1,1,1,1,0,1,0,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,0],[0,0,1,0,1,1,1,0],[0,0,1,0,1,1,0,0],[0,0,0,0,1,1,0,0],[0,0,0,0,1,1,0,0]],\"bounds\":{\"min_row\":-1,\"max_row\":7,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[0,0,0,0,0,1,0,1],[1,1,0,0,0,1,0,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0],[0,0,1,1,1,1,0,0],[0,0,1,0,1,1,0,0],[0,0,1,0,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[0,0,0,0,0,1,0,0],[1,1,0,0,0,1,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,0,0],[0,0,1,0,1,1,0,0],[0,0,1,0,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[0,0,0,0,0,1,0,0],[0,0,0,0,0,1,0,0],[0,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[0,0,1,0,1,1,0,0],[0,0,1,0,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[0,0,0,0,0,1,0,0],[0,0,0,0,0,1,0,0],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[0,0,1,1,1,1,1,1],[1,1,1,1,1,1,0,0],[1,1,1,0,1,1,0,0],[1,1,1,0,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":-2,\"max_col\":5}},{\"matrix\":[[0,0,0,1,0,0],[0,0,0,1,0,0],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,0,1,1],[1,1,1,0,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":0,\"max_col\":5}},{\"matrix\":[[0,0,0,1,1,1],[0,0,0,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,0,0,0],[1,1,1,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":5,\"min_col\":0,\"max_col\":5}},{\"matrix\":[[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":5,\"min_col\":0,\"max_col\":5}}]}},\"6.3\":{\"version\":1,\"puzzle\":{\"m\":8,\"n\":8,\"step\":2},\"step_count\":8,\"history\":{\"history_index\":8,\"snapshots\":[{\"matrix\":[[0,1,1,0,0,0,0,0,1,1],[0,1,1,0,0,0,0,0,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,0,0,1,1,1,0,0],[0,0,1,0,0,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[0,1,1,0,0,0,0,0,0,0],[0,1,1,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,0,0,1,1,1,0,0],[0,0,1,0,0,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[0,0,0,1,1,0,0,0,0,0],[0,0,0,1,1,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,0,0,1,1,1,0,0],[0,0,1,0,0,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":-2,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,0,0,0,0,0],[0,0,0,1,1,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,0,0,1,1,1],[0,0,0,0,1,0,0,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":-4,\"max_col\":5}},{\"matrix\":[[0,0,0,1,1,0,0,0,0,0],[0,0,0,1,1,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,1,0,0,1,1,1,0,0],[0,0,1,0,0,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":-2,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,0,0,0,0,0],[0,0,0,1,1,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,0,0,1,1,1,0,0],[1,1,1,0,0,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":-2,\"max_col\":7}},{\"matrix\":[[0,0,0,1,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,0,0,0,0,0,0,0],[1,1,1,0,0,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":-2,\"max_col\":7}},{\"matrix\":[[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":-2,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":7}}]}},\"6.4\":{\"version\":1,\"puzzle\":{\"m\":8,\"n\":8,\"step\":2},\"step_count\":11,\"history\":{\"history_index\":11,\"snapshots\":[{\"matrix\":[[0,0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,1,1,0,0],[1,0,1,1,1,1,1,1,0,0],[1,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,0,0,0,0,0],[1,1,1,1,1,0,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":4,\"max_col\":13}},{\"matrix\":[[1,0,0,1,1,1,1,1,0,0],[1,0,0,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,0,0,0,0,0],[0,0,1,1,1,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":4,\"max_col\":13}},{\"matrix\":[[0,0,1,0,0,1,1,1,1,1],[0,0,1,0,0,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,0,0,0,0,0],[0,0,1,1,1,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":2,\"max_col\":11}},{\"matrix\":[[0,0,1,0,0,0,0,0,0,0],[0,0,1,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":2,\"max_col\":11}},{\"matrix\":[[0,0,0,0,1,0,0,0,0,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":11}},{\"matrix\":[[0,0,1,0,0,0,0,0,0,0],[0,0,1,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":2,\"max_col\":11}},{\"matrix\":[[0,0,0,0,1,0,0,0,0,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,0,1,1,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1,1,1],[0,0,0,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,1,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":11}},{\"matrix\":[[0,0,1,0,0,0,0,0,0,0],[0,0,1,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[0,0,1,0,0,0,0,0,0,0],[0,0,1,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[0,0,1,0,0,0,0,0,0,0],[0,0,1,0,0,0,0,0,0,0],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":7}}]}},\"6.5\":{\"version\":1,\"puzzle\":{\"m\":8,\"n\":8,\"step\":2},\"step_count\":14,\"history\":{\"history_index\":14,\"snapshots\":[{\"matrix\":[[1,0,0,1,1,1,0,0,0,0],[1,0,0,1,1,1,0,0,0,0],[1,0,1,1,1,1,1,1,0,0],[1,0,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[0,0,0,1,1,0,0,0,1,1],[0,0,0,1,1,0,0,0,1,1],[0,0,0,1,0,0,1,1,1,1],[0,0,0,1,0,0,1,1,1,1],[0,0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":-2,\"max_col\":7}},{\"matrix\":[[1,0,0,1,1,1,0,0,0,0,0,0],[1,0,0,1,1,1,0,0,0,0,0,0],[1,0,1,1,1,1,1,1,0,0,0,0],[1,0,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,1,1,0,0],[0,0,0,1,1,0,0,0,1,1,0,0],[0,0,0,1,1,0,0,0,1,1,0,0],[0,0,0,1,0,0,0,0,1,1,1,1],[0,0,0,1,0,0,0,0,1,1,1,1],[0,0,0,0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":-2,\"max_col\":9}},{\"matrix\":[[0,0,0,0,0,1,0,0,0,0,0,0],[0,0,0,0,0,1,0,0,0,0,0,0],[1,0,0,1,1,1,1,1,0,0,0,0],[1,0,0,1,1,1,1,1,0,0,0,0],[1,0,1,1,1,1,1,1,1,1,0,0],[1,0,1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,0,0,0,1,1,0,0],[1,1,1,1,1,0,0,0,1,1,0,0],[0,0,0,1,1,0,0,0,1,1,1,1],[0,0,0,1,1,0,0,0,1,1,1,1],[0,0,0,1,0,0,0,0,0,0,1,1],[0,0,0,1,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-4,\"max_row\":7,\"min_col\":-2,\"max_col\":9}},{\"matrix\":[[1,0,0,1,1,1,0,0,0,0,0,0],[1,0,0,1,1,1,0,0,0,0,0,0],[1,0,1,1,1,1,1,1,0,0,0,0],[1,0,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,1,1,0,0],[0,0,0,1,1,0,0,0,1,1,0,0],[0,0,0,1,1,0,0,0,1,1,0,0],[0,0,0,1,0,0,0,0,1,1,1,1],[0,0,0,1,0,0,0,0,1,1,1,1],[0,0,0,0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":-2,\"max_col\":9}},{\"matrix\":[[1,0,0,0,0,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0,0,0,0,0],[1,0,0,1,1,1,0,0,0,0,0,0],[1,0,0,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1,0,0],[0,0,0,1,1,0,0,0,1,1,0,0],[0,0,0,1,1,0,0,0,1,1,0,0],[0,0,0,1,0,0,0,0,1,1,1,1],[0,0,0,1,0,0,0,0,1,1,1,1],[0,0,0,0,0,0,0,0,0,0,1,1],[0,0,0,0,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":11,\"min_col\":-2,\"max_col\":9}},{\"matrix\":[[1,0,0,0,0,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0,0,0,0,0],[1,0,0,1,1,1,0,0,0,0,0,0],[1,0,0,1,1,1,0,0,0,0,0,0],[1,1,1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1,0,0],[0,0,1,1,1,1,1,1,1,1,0,0],[0,0,0,1,1,0,0,0,1,1,1,1],[0,0,0,1,1,0,0,0,1,1,1,1],[0,0,0,1,0,0,0,0,0,0,1,1],[0,0,0,1,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":-2,\"max_col\":9}},{\"matrix\":[[1,0,0,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0,0,0],[1,0,0,1,1,1,0,0,0,0],[1,0,0,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,1,1,0,0,0,1,1,1,1],[0,1,1,0,0,0,1,1,1,1],[0,1,0,0,0,0,0,0,1,1],[0,1,0,0,0,0,0,0,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,0,0,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0,0,0],[1,0,0,1,1,1,0,0,0,0],[1,0,0,1,1,1,0,0,0,0],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,1,1,0,1,1,1,1,0,0],[0,1,1,0,1,1,1,1,0,0],[0,1,0,0,0,0,1,1,0,0],[0,1,0,0,0,0,1,1,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,0,0,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0,0,0],[1,0,0,1,1,1,1,1,1,1],[1,0,0,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,1,1,0,1,1,1,1,0,0],[0,1,1,0,1,1,1,1,0,0],[0,1,0,0,0,0,0,0,0,0],[0,1,0,0,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,0,0,0,1,1,1,1,1,1],[1,0,0,0,1,1,1,1,1,1],[1,0,0,1,1,1,1,1,0,0],[1,0,0,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,1,1,0,0,0,0,0,0,0],[0,1,1,0,0,0,0,0,0,0],[0,1,0,0,0,0,0,0,0,0],[0,1,0,0,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,0,0,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0,0,0],[1,0,0,0,1,1,1,1,1,1],[1,0,0,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[1,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0,0],[0,1,0,0,0,0,0,0,0,0],[0,1,0,0,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":0,\"max_col\":9}},{\"matrix\":[[1,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0],[1,0,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1],[0,1,0,0,0,0,0,0],[0,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":-2,\"max_row\":9,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,0,1,1,1,1,1,1],[1,0,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,0,0,0,0,0,0],[0,1,0,0,0,0,0,0]],\"bounds\":{\"min_row\":0,\"max_row\":9,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":-2,\"max_row\":7,\"min_col\":0,\"max_col\":7}},{\"matrix\":[[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1]],\"bounds\":{\"min_row\":0,\"max_row\":7,\"min_col\":0,\"max_col\":7}}]}}}");

return { TUTORIAL_TEXTS, TUTORIAL_LEVELS, TUTORIAL_ORDER, TUTORIAL_ARCHIVES };
},
    "m19": function (require) {
/**
 * 創造模式控制器（對照原版 gui/annotation.py + speedrun.py 的模式開關第三態）。
 *
 * 兩種造謎方式：
 * - 隨機生成：在 m×n 實心矩形上挖掉一塊並頂到外側（挖洞 / 缺口），目標仍是還原成實心矩形。
 * - 手動構造：在網格上點選連通形狀，該形狀即為「目標」，套用後隨機打亂，玩家要把滑塊復原回這個形狀。
 *   目標會以淡藍虛線「虛影」顯示在棋盤上（BoardRenderer.solutionMask）。
 *
 * 與 main.ts 解耦：只透過 CreativeHost 拿遊戲物件與套用謎題的鉤子。
 */
const { SliderMatrix } = require("../core/SliderMatrix.js");
const { COLORS, GEOMETRY } = require("../render/theme.js");
const BRAND = '#4696c8';
const EDITOR_SIZE = 12; // 手動構造網格 12×12
class CreativeController {
    constructor(host) {
        this.editor = null;
        this.host = host;
        this.panel = document.createElement('div');
        this.panel.style.position = 'fixed';
        this.panel.style.top = `${GEOMETRY.menu_bar_height + 8}px`;
        this.panel.style.right = '8px';
        this.panel.style.display = 'none';
        this.panel.style.flexDirection = 'column';
        this.panel.style.gap = '8px';
        this.panel.style.width = '210px';
        this.panel.style.background = COLORS.dialog_bg;
        this.panel.style.border = `1px solid ${COLORS.dialog_border}`;
        this.panel.style.borderRadius = '8px';
        this.panel.style.padding = '12px';
        this.panel.style.color = COLORS.dialog_text;
        this.panel.style.fontSize = '12px';
        this.panel.style.zIndex = '700';
        this.panel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.45)';
        this.buildPanel();
        host.app.appendChild(this.panel);
    }
    buildPanel() {
        const title = document.createElement('div');
        title.textContent = '创造模式';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '13px';
        title.style.marginBottom = '2px';
        this.panel.appendChild(title);
        const sizeRow = document.createElement('div');
        sizeRow.style.display = 'flex';
        sizeRow.style.gap = '6px';
        sizeRow.style.alignItems = 'center';
        const mkNum = (label, def) => {
            const wrap = document.createElement('label');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.fontSize = '11px';
            wrap.style.opacity = '0.8';
            const span = document.createElement('span');
            span.textContent = label;
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.value = String(def);
            inp.min = '2';
            inp.max = '20';
            inp.style.width = '48px';
            inp.style.background = COLORS.input_bg;
            inp.style.color = COLORS.dialog_text;
            inp.style.border = `1px solid ${COLORS.border}`;
            inp.style.borderRadius = '4px';
            inp.style.padding = '2px 4px';
            wrap.append(span, inp);
            return inp;
        };
        const mInp = mkNum('行 m', 6);
        const nInp = mkNum('列 n', 6);
        const sInp = mkNum('步距', 2);
        sizeRow.append(mInp, nInp, sInp);
        this.panel.append(title, sizeRow);
        const note = document.createElement('div');
        note.textContent = '随机生成：挖掉一块顶到外侧，目标仍是还原成实心矩形。';
        note.style.opacity = '0.7';
        note.style.lineHeight = '1.4';
        this.panel.appendChild(note);
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gap = '6px';
        grid.append(this.mkBtn('随机生成（挖洞）', true, () => this.randomGen(mInp, nInp, sInp, false)), this.mkBtn('随机生成（缺口）', true, () => this.randomGen(mInp, nInp, sInp, true)), this.mkBtn('手动构造…', false, () => this.openEditor(sInp)), this.mkBtn('退出创造模式', false, () => this.host.exitCreative()));
        this.panel.appendChild(grid);
    }
    enter() {
        this.host.enterCreative();
        this.panel.style.display = 'flex';
        this.host.showToast('创造模式：生成谜题后自由还原');
        this.host.schedulePaint();
    }
    exit() {
        this.panel.style.display = 'none';
        this.closeEditor();
    }
    // ---------- 隨機生成 ----------
    randomGen(mInp, nInp, sInp, edgeOnly) {
        const m = clampInt(mInp.value, 2, 20, 6);
        const n = clampInt(nInp.value, 2, 20, 6);
        const step = clampInt(sInp.value, 1, Math.max(m, n) - 1, 2);
        const blocks = this.buildRandomShape(m, n, edgeOnly);
        this.host.applyAsPuzzle(m, n, step, blocks, null);
        this.host.showToast(edgeOnly ? '已生成「缺口」谜题' : '已生成「挖洞」谜题');
    }
    /** 完整矩形挖掉一格並在外側補一個凸起；保證連通且可還原為實心矩形。 */
    buildRandomShape(m, n, edgeOnly) {
        const rect = [];
        for (let r = 0; r < m; r++)
            for (let c = 0; c < n; c++)
                rect.push([r, c]);
        const candidates = [];
        for (let r = 0; r < m; r++) {
            for (let c = 0; c < n; c++) {
                const edge = r === 0 || c === 0 || r === m - 1 || c === n - 1;
                if (edgeOnly ? edge : !edge)
                    candidates.push([r, c]);
            }
        }
        if (candidates.length === 0)
            candidates.push([Math.floor(m / 2), Math.floor(n / 2)]);
        const [hr, hc] = candidates[Math.floor(Math.random() * candidates.length)];
        // 找一個「外側、且與挖掉格的某個剩餘鄰格相鄰」的凸起格 → 保證連通
        const neighbors = [
            [hr - 1, hc],
            [hr + 1, hc],
            [hr, hc - 1],
            [hr, hc + 1],
        ].filter(([r, c]) => r >= 0 && r < m && c >= 0 && c < n && !(r === hr && c === hc));
        const outs = [];
        for (const [r, c] of neighbors) {
            outs.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
        }
        const protrusion = outs.find(([r, c]) => r < 0 || r >= m || c < 0 || c >= n);
        const set = new Set(rect.map(([r, c]) => `${r}:${c}`));
        set.delete(`${hr}:${hc}`);
        set.add(`${protrusion[0]}:${protrusion[1]}`);
        return [...set].map((k) => k.split(':').map(Number));
    }
    // ---------- 手動構造 ----------
    openEditor(sInp) {
        this.closeEditor();
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.55)';
        overlay.style.zIndex = '2000';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.addEventListener('click', () => this.closeEditor());
        const box = document.createElement('div');
        box.style.background = COLORS.dialog_bg;
        box.style.border = `1px solid ${COLORS.dialog_border}`;
        box.style.borderRadius = '10px';
        box.style.padding = '16px';
        box.style.color = COLORS.dialog_text;
        box.style.fontSize = '13px';
        box.style.boxShadow = '0 6px 24px rgba(0,0,0,0.5)';
        box.addEventListener('click', (e) => e.stopPropagation());
        const title = document.createElement('div');
        title.textContent = '手动构造（点格增减滑块，需连成一片）';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '8px';
        box.appendChild(title);
        const cells = new Set();
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${EDITOR_SIZE}, 22px)`;
        grid.style.gap = '2px';
        const cellEls = [];
        for (let r = 0; r < EDITOR_SIZE; r++) {
            for (let c = 0; c < EDITOR_SIZE; c++) {
                const cell = document.createElement('div');
                cell.style.width = '22px';
                cell.style.height = '22px';
                cell.style.borderRadius = '3px';
                cell.style.background = COLORS.input_bg;
                cell.style.border = `1px solid ${COLORS.border}`;
                cell.style.cursor = 'pointer';
                const key = `${r}:${c}`;
                cell.addEventListener('click', () => {
                    if (cells.has(key))
                        cells.delete(key);
                    else
                        cells.add(key);
                    cell.style.background = cells.has(key) ? BRAND : COLORS.input_bg;
                });
                cellEls.push(cell);
                grid.appendChild(cell);
            }
        }
        box.appendChild(grid);
        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.gap = '8px';
        btnRow.style.marginTop = '12px';
        btnRow.appendChild(this.mkBtn('应用为谜题', true, () => {
            const shape = [...cells].map((k) => {
                const parts = k.split(':');
                return [Number(parts[0]), Number(parts[1])];
            });
            if (shape.length < 2) {
                this.host.showToast('至少选 2 个相连滑块');
                return;
            }
            // 連通性檢查
            if (!SliderMatrix.is_single_connected(new Set(shape.map(([r, c]) => `${r}:${c}`)))) {
                this.host.showToast('形状必须连成一片');
                return;
            }
            const step = clampInt(sInp.value, 1, 10, 2);
            const tmp = new SliderMatrix(1, 1);
            tmp.restore({ blocks: shape });
            // 打亂幾步，避免一開始就是還原態。
            // 用「安全打亂」而非 shuffle()：每一步都驗證可逆，所以真的保證能還原
            // （原本這裡寫 shuffle() 並註解「反向即回原狀」，但普通打亂並不保證這點）。
            let attempts = 0;
            do {
                tmp.shuffle_safe(8, step);
                attempts++;
            } while (tmp.is_solved() && attempts < 6);
            const scrambled = tmp.blocks.map((b) => [b.row, b.col]);
            const solution = new Set(shape.map(([r, c]) => `${r}:${c}`));
            let maxR = 0;
            let maxC = 0;
            for (const [r, c] of shape) {
                maxR = Math.max(maxR, r);
                maxC = Math.max(maxC, c);
            }
            this.host.applyAsPuzzle(maxR + 1, maxC + 1, step, scrambled, solution);
            this.closeEditor();
            this.host.showToast('已套用：把滑块复原回虚线形状');
        }));
        btnRow.appendChild(this.mkBtn('清空', false, () => {
            cells.clear();
            for (const el of cellEls)
                el.style.background = COLORS.input_bg;
        }));
        btnRow.appendChild(this.mkBtn('取消', false, () => this.closeEditor()));
        box.appendChild(btnRow);
        overlay.appendChild(box);
        this.host.app.appendChild(overlay);
        this.editor = overlay;
    }
    closeEditor() {
        if (this.editor) {
            this.editor.remove();
            this.editor = null;
        }
    }
    mkBtn(label, primary, onClick) {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.background = primary ? BRAND : COLORS.input_bg;
        b.style.color = '#fff';
        b.style.border = primary ? 'none' : `1px solid ${COLORS.border}`;
        b.style.borderRadius = '4px';
        b.style.padding = '6px 8px';
        b.style.cursor = 'pointer';
        b.style.fontSize = '12px';
        b.style.textAlign = 'center';
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });
        return b;
    }
}
function clampInt(v, lo, hi, def) {
    const x = Math.floor(Number(v));
    if (!Number.isFinite(x))
        return def;
    return Math.max(lo, Math.min(hi, x));
}

return { CreativeController };
},
    "m2": function (require) {
/**
 * 畫風 token（對照 docs/theme.md；來源 GUI.py::self.colors 與 gui/renderer.py）
 * 單一來源，渲染與選單共用，禁止散落寫死色值。
 */
function rgb(r, g, b) {
    return `rgb(${r}, ${g}, ${b})`;
}
const COLORS = {
    background: rgb(30, 30, 30),
    block: rgb(60, 150, 200),
    block_selected: rgb(0, 200, 100),
    border: rgb(100, 100, 100),
    gap: rgb(80, 80, 80),
    line: rgb(255, 0, 0),
    grid: rgb(40, 40, 40),
    menu_bg: rgb(50, 50, 50),
    menu_hover: rgb(70, 70, 70),
    menu_text: rgb(220, 220, 220),
    menu_selected: rgb(80, 130, 180),
    status_bg: rgb(40, 40, 40),
    status_text: rgb(200, 200, 200),
    dialog_bg: rgb(45, 45, 48),
    dialog_border: rgb(100, 100, 100),
    dialog_text: rgb(230, 230, 230),
    dialog_title: rgb(255, 255, 255),
    solved: rgb(0, 200, 80),
    unsolved: rgb(200, 160, 0),
    input_bg: rgb(60, 60, 65),
    input_active: rgb(80, 80, 120),
    input_text: rgb(255, 255, 255),
    selection_bg: rgb(50, 80, 160),
    button_bg: rgb(70, 130, 180),
    button_hover: rgb(90, 150, 200),
    separator: rgb(80, 80, 80),
    timer_running: rgb(255, 200, 80),
    macro_base_mark: rgb(255, 200, 50),
};
const GEOMETRY = {
    base_cell_size: 60,
    gap_width: 4,
    padding: 10,
    block_radius: 5, // 原版 int(5 * zoom)，zoom=1 時為 5
    block_border_width: 2, // 原版 max(1, int(2 * zoom))
    selected_line_width: 3,
    menu_bar_height: 32,
    status_bar_height: 28,
    right_panel_width: 132,
    min_width: 1000,
    min_height: 618,
};
/** 原版 ease_out：1 - (1-t)^2 */
function easeOut(t) {
    return 1 - (1 - t) * (1 - t);
}
/**
 * 介面字型：原版全 UI 都用 SimHei（黑體，`_gui_safe_font('SimHei', …)`）。
 * 這裡優先同名，其後才是跨平台的中文黑體替代，最後才退回系統預設。
 */
const FONT_FAMILY = "'SimHei', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', system-ui, sans-serif";
const TEXT = {
    solved: '狀態：復原',
    unsolved: '狀態：未復原',
    stepPrefix: '步數：',
    puzzlePrefix: '謎題：',
    // 原版選單列順序（GUI.py::self.menu_items）
    menuItems: ['文件', '编辑', '谜题', '宏定义', '设置', '帮助', '教程', '官网'],
};

return { COLORS, GEOMETRY, easeOut, FONT_FAMILY, TEXT };
},
    "m3": function (require) {
/**
 * 規則常量（對照 game.py / 術語規定.md）
 *
 * - h 縫隙（橫向，row 之間）只能 a/d（左右）
 * - v 縫隙（縱向，col 之間）只能 w/s（上下）
 * - side 邊界：above/left 含 line（<=），below/right 不含（>）
 */
const DIRECTION_DELTA = {
    w: [-1, 0],
    s: [1, 0],
    a: [0, -1],
    d: [0, 1],
};
/** h 縫隙的合法移動方向 */
const VALID_DIRECTIONS_FOR_GAP = {
    h: ['a', 'd'],
    v: ['w', 's'],
};
function isValidDirectionForGap(gap, dir) {
    return VALID_DIRECTIONS_FOR_GAP[gap].includes(dir);
}
/**
 * mod 不變量：step > 1 時，每次合法移動使每塊的 (r % step, c % step) 永不變。
 * 互動邏輯不依賴它，但務必保留此假設（日後接求解器/著色/連鎖時共用）。
 */
function modGroupOf(r, c, step) {
    return ((r % step) * step + (c % step)) >>> 0;
}

return { DIRECTION_DELTA, VALID_DIRECTIONS_FOR_GAP, isValidDirectionForGap, modGroupOf };
},
    "m4": function (require) {
// 原版 arrow_B.png 的 base64 Data URI（gui/renderer.py 默认 _ARROW_STYLE='B'）。
// 直接内联，避免 file:// 下 <img> 加载污染 canvas 或路径问题。
const ARROW_IMAGE_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAFOUlEQVR4nO3by40VOxiFUYNuLAwQWZAB2RAB2ZABWSAGRMPgqlED/aiHq/xve63xGVjd3l9bap3WAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYHFvRh+gp+8/fn4afQbm9+H9u6+jz9BLfACMnpHSYxAbAMOnktQQRAbA+KkoMQJxATB+KkuLQFQAjJ8ESRGICYDxkyQlAhEBMH4SJUSgfAAOjP/bJQeB/33c8+HqESgdgJ3jN3zutDkElSPwdvQBOjF+7jbFnSv7Atjx13+KXwSxNr0Eqr4C0l8Axs9o0XcwOQDRP3imEnsXSwbAv/2YTdU7XTIAG8QWl2lF3snUAAAdCAAsTABgYQIACxMAWJgAwMIEABYmALAwAYCFCQAsTAD2+TL6ANCTAOz3pQkBkxCA44SAeAJwnhAQSwD6EQLiCEB/QkAMAbiOEFCeAFxPCChLAO4jBJQjAPcTAsoQgHGEgOEEYDwhYBgBqEMIuJ0A1CME3EYA6hICLicA9QkBlxGAHEJAdwKQRwjoRgByCQGnCUA+IeAwAZiHELCbAMxHCNhMAOYlBLxKAOYnBDxLANYhBPxDANYjBPwmAPt8Hn2AjoQAATjgcxMCJiEAxwkB8QTgPCEglgD0IwTEEYD+hIAYAnAdIaA8AbieEFCWANxHCChHAO4nBJQhAOMIAcMJwHhCwDACUIcQcDsBqEcIuI0A1CUEXE4A6hMCLiMAOYSA7gQgjxDQjQDkEgJOE4B8QsBhAjAPIWA3AZiPELCZAMxLCHiVAMxPCHiWAKxDCPiHAKxHCPhNANYlBAgAU4aAjQSAB7OFgA0EgL8JwUIEgOcIwQIEgNcIwcQEgK2EYEICwF5CMBEB4CghmIAAcJYQBBMAehGCQAJAb0IQRAC4ihAEEACuJgSFCQB38AWdov4bfQCmZvjFCQBXMPwQAkBPhh9GAOjB8EMJAGcYfjgB4AjDn4QAsIfhT0YA2MLwJyUAvMTwJycAPMXwFyEAPGb4ixEAWjP8ZQnA2mYbvm8d7iQAazJ8WmsCsBrD5w8CsAbD50kCMDfD50UCMCfDZxMBmIvhs4sAzMHwOUQAshk+pwhAJsOnCwHIYvh0JQAZDJ9LCEBths+lBKAmw+cWAlCL4XMrAajB8BlCAMYyfIYSgDEMnxIE4F6GTykCcA/DpyQBuJbhU5oAXMPwiSAAfRk+UQSgD8MnkgCcY/hEE4BjDJ8pCMA+hs9UBGBNhk9rTQBWY/j8QQDWYPg8SQDmZvi8SADmZPhsIgBzMXx2EYA5GD6HCEA2w+cUAchk+HQhAFkMn64EIIPhcwkBqM3wuZQA1GT43EIAajF8biUANRg+QwjAWIbPUAIwhuFTggDcy/ApRQDuYfiUJADXMnxKE4BrGD4RBKAvwyeKAPRh+EQSgHMMn2gCcIzhMwUB2Mfwmcrb0QcAxhEAWJgAwMIEABYmALAwAYCFCQAsTABgYQIAC0sNwMfRB4C/RN7JkgH48P7d19FngJ6q3umSAdgosrhMKfYuJgegteAfPNOIvoNvRh/gJd9//Py08aPfLj0IPG3T+Ks+/1vLfwE8iK4wkaa4c6VfAK3tegU88BrgSruGX/mvf2sBAWjtUARguOrjby0kAK2JAFkSxt9aUABaEwEypIy/tbAAtCYC1JY0/tYCA9CaCFBT2vhbCw1AayJALYnjby04AA+EgJFSh/8gPgCPiQF3SB89AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8MgvBf32PCl9htwAAAAASUVORK5CYII=';

return { ARROW_IMAGE_DATA_URI };
},
    "m5": function (require) {
/**
 * 棋盤互動控制器（M2）
 * 對照 gui/events.py 的三連互動與 gui/renderer.py 的命中測試。
 *
 * - 點縫隙 → selectGap（再點同縫隙 = 取消）
 * - 點方塊（已選縫隙）→ selectBlock（DFS 選中組）
 * - 鍵盤/方向鍵/拖動 → move（先 try_move 再 commit；非法則閃紅提示）
 * - 空白拖拽 → 平移鏡頭（camera）
 */
const { selectBlock, selectGap } = require("../core/CommandBus.js");
const { isValidDirectionForGap } = require("../core/rules.js");
const DRAG_MOVE_THRESHOLD = 18;
const DIRECTION_KEYS = {
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
const GAP_ABBR = ['d', 'l', 'r', 'd', 'u', 'r', 'l', 'u'];
const DIR_ABBR = ['r', 'u', 'u', 'l', 'l', 'd', 'd', 'r'];
function directGestureFromDrag(row, col, dx, dy) {
    const angle = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360; // y 向上：0°=右、90°=上
    const sector = Math.floor(angle / 45) % 8;
    const gapAbbr = GAP_ABBR[sector];
    const moveAbbr = DIR_ABBR[sector];
    let gap;
    if (gapAbbr === 'd') {
        gap = { type: 'h', line: row }; // 下沿：row 到 row+1 之間
    }
    else if (gapAbbr === 'u') {
        gap = { type: 'h', line: row - 1 }; // 上沿：row-1 到 row 之間
    }
    else if (gapAbbr === 'l') {
        gap = { type: 'v', line: col - 1 }; // 左沿
    }
    else {
        gap = { type: 'v', line: col }; // 右沿
    }
    const direction = moveAbbr === 'r' ? 'd' : moveAbbr === 'l' ? 'a' : moveAbbr === 'u' ? 'w' : 's';
    return { gap, direction };
}
class BoardController {
    constructor(ui) {
        /** 右側面板「滑動動畫」開關；關閉時移動瞬間完成 */
        this.animationEnabled = true;
        /** 右側面板「速度」滑條控制的移動動畫時長（ms） */
        this.moveDurationMs = 180;
        /** 控制模式：單次觸控（直接拖拽）、兩次觸控（先選縫隙再選組）、鼠標鍵盤（鍵盤移動） */
        this.singleTouchEnabled = true;
        this.twoTouchEnabled = true;
        this.keyboardMouseEnabled = true;
        /** 單次觸控完成後是否清空選中，確保下次拖拽是全新的單次操作 */
        this.clearSelectionAfterMove = false;
        this.pinchDist = 0;
        /** 按下時的鼠標鍵（0=左鍵）；非左鍵不觸發點擊/滑動（原版僅左鍵操作） */
        this.downButton = 0;
        this.pinchZoom = 1;
        this.pinchActive = false;
        this.ui = ui;
        this.drag = { active: false, startX: 0, startY: 0, camX: 0, camY: 0, moved: false, ax: 0, ay: 0, pan: true };
        this.attach();
    }
    /** 播放一段過場動畫（undo/redo 用）：從 from 到 to 平滑過渡後停在 to。 */
    playTransition(from, to, durationMs = this.moveDurationMs) {
        const renderer = this.ui.renderer;
        renderer.animation = { start: from, end: to, progress: 0, durationMs };
        const t0 = performance.now();
        const frame = (now) => {
            const anim = renderer.animation;
            if (!anim)
                return;
            const p = Math.min(1, (now - t0) / anim.durationMs);
            anim.progress = p;
            this.ui.requestPaint?.();
            if (p < 1)
                requestAnimationFrame(frame);
            else
                renderer.animation = null;
        };
        requestAnimationFrame(frame);
    }
    get canvas() {
        return this.ui.canvas;
    }
    notify(message) {
        this.ui.onStatus?.(message);
        this.ui.requestPaint?.();
    }
    flashInvalid() {
        // 簡化的非法移動反饋：短暫把畫布外框閃紅
        const c = this.canvas;
        const prev = c.style.outline;
        c.style.transition = 'outline 0.12s';
        c.style.outline = '3px solid rgba(255, 0, 0, 0.85)';
        setTimeout(() => {
            c.style.outline = prev || 'none';
        }, 200);
    }
    attach() {
        const c = this.canvas;
        c.addEventListener('mousedown', (e) => this.onPointerDown(e.offsetX, e.offsetY, e.button));
        c.addEventListener('mousemove', (e) => this.onPointerMove(e.offsetX, e.offsetY));
        window.addEventListener('mouseup', () => this.onPointerUp());
        // 觸控
        const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
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
                if (e.touches.length < 2)
                    this.pinchActive = false;
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
    updateHover(x, y) {
        const { renderer } = this.ui;
        if (!renderer.chainHintEnabled) {
            if (renderer.hoverCell) {
                renderer.hoverCell = null;
                this.ui.requestPaint?.();
            }
            return;
        }
        const cell = renderer.getCellAtPos(x, y);
        const prev = renderer.hoverCell;
        const changed = (!!cell !== !!prev) || (cell && prev && (cell[0] !== prev[0] || cell[1] !== prev[1]));
        renderer.hoverCell = cell;
        if (changed)
            this.ui.requestPaint?.();
    }
    onPointerDown(x, y, button = 0) {
        // 原版：事件分發最前面呼叫 spawn_click_feedback —— 左鍵按下都給漣漪
        this.downButton = button;
        if (button === 0)
            this.ui.renderer.spawnClickFeedback(x, y);
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
    onPointerMove(x, y) {
        if (!this.drag.active)
            return;
        const dx = x - this.drag.startX;
        const dy = y - this.drag.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4)
            this.drag.moved = true;
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
    onPointerUp() {
        const downButton = this.downButton;
        this.downButton = 0;
        if (!this.drag.active)
            return;
        const { store } = this.ui;
        const r = this.ui.renderer;
        const moved = this.drag.moved;
        const dx = this.drag.ax;
        const dy = this.drag.ay;
        const [x, y] = [this.drag.startX, this.drag.startY];
        this.drag.active = false;
        // 非左鍵鬆開：平移已在 move 期間跟手生效，這裡不再觸發點擊/滑動
        if (downButton !== 0)
            return;
        if (!moved) {
            // 視為點擊
            this.handleClick(x, y);
            return;
        }
        // 拖動：若已選中縫隙，且起點在滑塊上，超過閾值 → 直接選中組並滑動（不必先點方塊）
        const overThreshold = Math.abs(dx) > DRAG_MOVE_THRESHOLD || Math.abs(dy) > DRAG_MOVE_THRESHOLD;
        const startBlock = r.getBlockAtPos(x, y, store);
        const direction = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'd' : 'a')
            : (dy > 0 ? 's' : 'w');
        if (startBlock && overThreshold) {
            if (this.twoTouchEnabled && store.cmd.selectedGap) {
                if (!store.cmd.selectedBlock) {
                    const reply = selectBlock(store.cmd, startBlock.row, startBlock.col);
                    if (!reply.ok)
                        return;
                }
                this.animateMove(direction);
            }
            else if (this.singleTouchEnabled && !store.cmd.selectedGap) {
                // 無縫隙時：依拖拽角度直接判定縫隙/方向（8 區）；單次觸控完成後清空選中
                const gesture = directGestureFromDrag(startBlock.row, startBlock.col, dx, dy);
                if (gesture) {
                    store.cmd.selectedGap = gesture.gap;
                    const reply = selectBlock(store.cmd, startBlock.row, startBlock.col);
                    if (reply.ok)
                        this.animateMove(gesture.direction, true);
                }
            }
        }
        else if (this.drag.pan) {
            // 平移鏡頭（已在 move 期間跟手，這裡確保最終位置一致）
            r.cameraX = this.drag.camX + dx;
            r.cameraY = this.drag.camY + dy;
            this.ui.requestPaint?.();
        }
    }
    handleClick(x, y) {
        const { store, renderer } = this.ui;
        // 箭頭按鍵命中優先於選縫隙（原版 events 裡先問它，否則會被「點空白起拖」吃掉）
        const arrowDir = renderer.hitArrowButton(x, y);
        if (arrowDir) {
            this.animateMove(arrowDir);
            return;
        }
        const gap = renderer.getGapAtPos(x, y, store);
        const block = renderer.getBlockAtPos(x, y, store);
        if (gap !== null) {
            // 再點同一縫隙 = 取消
            const cur = store.cmd.selectedGap;
            if (cur && cur.type === gap.type && cur.line === gap.line) {
                store.cmd.selectedGap = null;
                store.cmd.selectedBlock = null;
                store.game.selected.clear();
                renderer.lastBlockClickWorld = null;
                this.notify('已取消縫隙');
            }
            else {
                const reply = selectGap(store.cmd, gap.type, gap.line);
                renderer.lastBlockClickWorld = null;
                this.notify(reply.ok ? `選中${gap.type === 'v' ? '縱' : '橫'}向縫隙` : reply.message);
            }
        }
        else if (block !== null && store.cmd.selectedGap !== null) {
            const reply = selectBlock(store.cmd, block.row, block.col);
            if (reply.ok)
                renderer.lastBlockClickWorld = renderer.screenToWorld(x, y);
            this.notify(reply.ok ? `選中滑塊組 共${store.game.selected.size}個` : reply.message);
        }
        else if (renderer.isBlankArea(x, y, store)) {
            this.deselect();
            renderer.lastBlockClickWorld = null;
            this.notify('已取消選中');
        }
    }
    onKeyDown(e) {
        if (!this.keyboardMouseEnabled)
            return;
        if (e.ctrlKey || e.metaKey)
            return; // 保留給 undo/redo 快捷鍵（M3）
        const dir = DIRECTION_KEYS[e.key];
        if (!dir)
            return;
        e.preventDefault();
        this.animateMove(dir);
    }
    /** 對外：虛擬鍵盤/程式化移動入口。 */
    move(direction) {
        this.animateMove(direction);
    }
    /** 帶動畫的移動：預測 → 動畫插值 → 提交。 */
    animateMove(direction, clearAfter = false) {
        const { store, renderer } = this.ui;
        const cmd = store.cmd;
        const blocked = this.ui.beforeMove?.();
        if (blocked) {
            this.clearSelectionAfterMove = false;
            this.notify(blocked);
            return;
        }
        this.clearSelectionAfterMove = clearAfter;
        if (!cmd.selectedGap) {
            this.clearSelectionAfterMove = false;
            this.notify('請先選中縫隙');
            return;
        }
        if (!cmd.selectedBlock) {
            this.clearSelectionAfterMove = false;
            this.notify('請先選中滑塊');
            return;
        }
        if (!isValidDirectionForGap(cmd.selectedGap.type, direction)) {
            this.clearSelectionAfterMove = false;
            this.flashInvalid();
            this.notify(`移動方向非法（${cmd.selectedGap.type === 'h' ? 'h→a/d' : 'v→w/s'}）`);
            return;
        }
        const finalPositions = store.game.try_move(direction, store.currentStep);
        if (!finalPositions) {
            this.clearSelectionAfterMove = false;
            this.flashInvalid();
            this.notify('移動不合法（碰撞或斷連）');
            return;
        }
        // 建立全量 block 的起點/終點（選中組終點用 finalPositions，其餘原地）
        const selectedList = store.game.blocks.filter((b) => store.game.selected.has(b));
        const movedPositions = selectedList.map((b) => [b.row, b.col]);
        const endBySelected = new Map(selectedList.map((b, i) => [b, finalPositions[i]]));
        const start = store.game.blocks.map((b) => [b.row, b.col]);
        const end = store.game.blocks.map((b) => {
            const e = endBySelected.get(b);
            return e ? [e[0], e[1]] : [b.row, b.col];
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
        const frame = (now) => {
            const anim = renderer.animation;
            if (!anim)
                return;
            const p = Math.min(1, (now - t0) / anim.durationMs);
            anim.progress = p;
            this.ui.requestPaint?.();
            if (p < 1) {
                requestAnimationFrame(frame);
            }
            else {
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
    deselect() {
        const { store } = this.ui;
        store.cmd.selectedGap = null;
        store.cmd.selectedBlock = null;
        store.game.selected.clear();
        this.ui.requestPaint?.();
    }
}

return { BoardController };
},
    "m6": function (require) {
/**
 * 內部指令匯流排（對照 gui/events.py::process_commands 的動作語義）
 *
 * 體驗版不做 HTTP/stdin 通道；用同一套 action 名稱封裝，方便日後
 * 把求解器掛到 Web Worker 時沿用原版指令協定。
 */
const { GameHistory } = require("./GameHistory.js");
const { isValidDirectionForGap } = require("./rules.js");
function createContext(game, step) {
    const ctx = {
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
function selectGap(ctx, type, line) {
    const valid = type === 'h' ? ctx.game.is_valid_h_line(line) : ctx.game.is_valid_v_line(line);
    if (!valid) {
        return { ok: false, message: `${type} 分割線 ${line} 不合法` };
    }
    ctx.selectedGap = { type, line };
    ctx.game.selected.clear();
    ctx.selectedBlock = null;
    return { ok: true, message: `已選中縫隙: ${type} ${line}` };
}
function selectBlock(ctx, row, col) {
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
function move(ctx, direction) {
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
    const finalPositions = ctx.game.try_move(direction, ctx.step);
    if (!finalPositions) {
        return { ok: false, message: '移動不合法（碰撞或斷連）' };
    }
    const movedPositions = ctx.game.blocks
        .filter((b) => ctx.game.selected.has(b))
        .map((b) => [b.row, b.col]);
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
function undo(ctx) {
    if (!ctx.history.canUndo) {
        return { ok: false, message: '沒有可撤銷的步驟' };
    }
    ctx.history.undo(ctx.game);
    ctx.stepCount = Math.max(0, ctx.stepCount - 1);
    return { ok: true, message: '撤銷' };
}
function redo(ctx) {
    if (!ctx.history.canRedo) {
        return { ok: false, message: '沒有可重做的步驟' };
    }
    ctx.history.redo(ctx.game);
    ctx.stepCount += 1;
    return { ok: true, message: '重做' };
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
function shuffle(ctx, attempts = 100, opts = {}) {
    const safe = opts.safe ?? true;
    ctx.shuffleBefore = ctx.game.snapshot();
    if (safe) {
        ctx.game.shuffle_safe(Math.max(1, Math.round(attempts * SAFE_ATTEMPTS_RATIO)), ctx.step, opts.rng);
    }
    else {
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
function reset(ctx) {
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

return { createContext, selectGap, selectBlock, move, undo, redo, shuffle, reset };
},
    "m7": function (require) {
/**
 * 快照式撤銷/重做（對照 history.py::GameHistory + move_info）
 *
 * 每筆快照記錄當下版面與「如何從前一版面到達此版面」的 move_info，
 * 供撤銷/重做只對該步滑塊組做動畫（對照原版 _start_undo_redo_animation）。
 */
const { Block } = require("./Block.js");
class GameHistory {
    constructor() {
        this.entries = [];
        this.index = -1;
    }
    /** 保存當前狀態快照；若不在歷史末尾則截斷。 */
    save_snapshot(game, move_info) {
        const snapshot = {
            blocks: game.blocks.map((b) => [b.row, b.col]),
        };
        // 只有數字形態才存編號，方形存檔維持與原版完全一致的格式
        if (game.blocks.some((b) => b.number !== null)) {
            snapshot.numbers = game.blocks.map((b) => b.number);
        }
        if (move_info)
            snapshot.move_info = move_info;
        if (this.index < this.entries.length - 1) {
            this.entries = this.entries.slice(0, this.index + 1);
        }
        this.entries.push(snapshot);
        this.index = this.entries.length - 1;
    }
    get canUndo() {
        return this.index > 0;
    }
    get canRedo() {
        return this.index >= 0 && this.index < this.entries.length - 1;
    }
    get length() {
        return this.entries.length;
    }
    get currentIndex() {
        return this.index;
    }
    /** 目前快照的 move_info（最後一步如何到達目前版面；undo 用它反向動畫）。 */
    currentMoveInfo() {
        return this.entries[this.index]?.move_info ?? null;
    }
    /** undo 目標（上一筆）快照的 blocks；無可撤銷回 null。 */
    undoTarget() {
        return this.canUndo ? this.entries[this.index - 1] : null;
    }
    /** redo 目標（下一筆）快照的 blocks；無可重做回 null。 */
    redoTarget() {
        return this.canRedo ? this.entries[this.index + 1] : null;
    }
    /** 下一個 redo 目標快照的 move_info。 */
    nextMoveInfo() {
        return this.entries[this.index + 1]?.move_info ?? null;
    }
    /** 撤銷：回退一步，並把快照套用到 game。 */
    undo(game) {
        if (!this.canUndo)
            return false;
        this.index -= 1;
        this.apply(game, this.entries[this.index]);
        return true;
    }
    /** 重做：前進一步。 */
    redo(game) {
        if (!this.canRedo)
            return false;
        this.index += 1;
        this.apply(game, this.entries[this.index]);
        return true;
    }
    /** 設定目前歷史索引（載入存檔時用）。 */
    setIndex(index) {
        if (Number.isInteger(index) && index >= 0 && index < this.entries.length)
            this.index = index;
    }
    /** 直接跳到指定歷史步（虛擬鍵盤「跳到某步」用）。 */
    jumpTo(game, index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.entries.length)
            return false;
        this.index = index;
        this.apply(game, this.entries[this.index]);
        return true;
    }
    /** 匯出全部快照（供存檔）。 */
    snapshotAll() {
        return this.entries.map((e) => ({
            blocks: e.blocks.map(([r, c]) => [r, c]),
            ...(e.numbers ? { numbers: [...e.numbers] } : {}),
            ...(e.move_info ? { move_info: e.move_info } : {}),
        }));
    }
    /** 由快照列表還原（index 設為末位，對應載入時停在最新狀態）。 */
    restoreAll(list) {
        this.entries = list.map((e) => ({
            blocks: e.blocks.map(([r, c]) => [r, c]),
            ...(e.numbers ? { numbers: [...e.numbers] } : {}),
            ...(e.move_info ? { move_info: e.move_info } : {}),
        }));
        this.index = this.entries.length - 1;
    }
    apply(game, entry) {
        game.blocks = entry.blocks.map(([r, c], i) => {
            const b = new Block([r, c]);
            b.number = entry.numbers?.[i] ?? null;
            return b;
        });
        game.selected.clear();
    }
}

return { GameHistory };
},
    "m8": function (require) {
/**
 * 滑塊 Block（對照 game.py::Block）
 *
 * 原版把 be_opted 存在每個 block 上；網頁版把選中狀態移出，
 * 由 SliderMatrix.selected 集合統一管理，避免物件上散布可變標誌。
 */
class Block {
    constructor(location) {
        /**
         * 數字形態的編號（1..m*n），跟著滑塊走；非數字形態為 null。
         * 對照 game.py::Block.number —— 過關條件與方形完全相同（拼成實心矩形），
         * 編號只是給玩家看的視覺線索，不參與勝負判定。
         */
        this.number = null;
        this.location = location;
    }
    get row() {
        return this.location[0];
    }
    get col() {
        return this.location[1];
    }
    clone() {
        const b = new Block([this.location[0], this.location[1]]);
        b.number = this.number;
        return b;
    }
}

return { Block };
},
    "m9": function (require) {
/**
 * UI 狀態聚合（對照 SliderGUI 的狀態集中式設計）
 * 存檔格式與原版完全一致：{version, puzzle, step_count, history:{history_index, snapshots:[{matrix,bounds,move_info?}]}}
 */
const { createContext } = require("../core/CommandBus.js");
const { SliderMatrix } = require("../core/SliderMatrix.js");
function matrixToBlocks(matrix, bounds) {
    if (!Array.isArray(matrix) || !bounds || !Number.isInteger(bounds.min_row) || !Number.isInteger(bounds.min_col))
        return null;
    const out = [];
    for (let r = 0; r < matrix.length; r++) {
        const row = matrix[r];
        if (!Array.isArray(row))
            return null;
        for (let c = 0; c < row.length; c++) {
            if (row[c] === 1)
                out.push([bounds.min_row + r, bounds.min_col + c]);
        }
    }
    return out;
}
/**
 * 把「依滑塊順序」排列的編號改成「依位置行主序」排列。
 * 存檔裡的 matrix 是按位置掃出來的，編號必須用同一個順序才不會錯位。
 */
function numbersInMatrixOrder(blocks, numbers) {
    if (!numbers)
        return null;
    const order = blocks
        .map((_, i) => i)
        .sort((a, b) => blocks[a][0] - blocks[b][0] || blocks[a][1] - blocks[b][1]);
    return order.map((i) => numbers[i] ?? null);
}
function blocksToMatrix(blocks) {
    if (blocks.length === 0) {
        return { matrix: [], bounds: { min_row: 0, max_row: 0, min_col: 0, max_col: 0 } };
    }
    const rows = blocks.map((b) => b[0]);
    const cols = blocks.map((b) => b[1]);
    const min_row = Math.min(...rows);
    const max_row = Math.max(...rows);
    const min_col = Math.min(...cols);
    const max_col = Math.max(...cols);
    const set = new Set(blocks.map((b) => `${b[0]}:${b[1]}`));
    const matrix = [];
    for (let r = min_row; r <= max_row; r++) {
        const row = [];
        for (let c = min_col; c <= max_col; c++) {
            row.push(set.has(`${r}:${c}`) ? 1 : 0);
        }
        matrix.push(row);
    }
    return { matrix, bounds: { min_row, max_row, min_col, max_col } };
}
class GameStore {
    constructor(m = 4, n = 4, step = 2, numbered = false) {
        /**
         * 自定義目標形狀（創造模式手造形狀用）。null 表示沿用「m×n 實心矩形」判定。
         * 矩陣每次重建後都要重新掛回，所以集中在各 new SliderMatrix 之後賦值。
         */
        this.solutionMask = null;
        this.currentM = m;
        this.currentN = n;
        this.currentStep = step;
        this.numbered = numbered;
        this.game = new SliderMatrix(m, n);
        this.game.solutionMask = this.solutionMask;
        this.game.assignNumbers(numbered);
        this.cmd = createContext(this.game, step);
    }
    get solved() {
        return this.game.is_solved();
    }
    /** 謎題分組鍵（對照 puzzle_key）：數字形態後綴 #num，成績與狀態顯示都用它。 */
    get puzzleKey() {
        const base = `${this.currentStep}~${this.currentM}*${this.currentN}`;
        return this.numbered ? `${base}#num` : base;
    }
    get selectedGap() {
        return this.cmd.selectedGap;
    }
    get selectedCells() {
        return new Set([...this.cmd.game.selected].map((b) => `${b.row}:${b.col}`));
    }
    newPuzzle(m, n, step, numbered = this.numbered) {
        if (step >= Math.max(m, n))
            return false;
        this.currentM = m;
        this.currentN = n;
        this.currentStep = step;
        this.numbered = numbered;
        this.game = new SliderMatrix(m, n);
        this.game.solutionMask = this.solutionMask;
        this.game.assignNumbers(numbered);
        this.cmd = createContext(this.game, step);
        return true;
    }
    /**
     * 直接套用一段「以 [row,col] 列表描述的局面」作為新謎題起點（歷史清空為單一原點）。
     * 教程載入某一關的起始亂局、創造模式套用手造形狀都走這裡。
     * solutionMask 由呼叫方另行設定（教程為 null → 走矩形判定）。
     */
    applyPuzzle(m, n, step, blocks) {
        this.currentM = m;
        this.currentN = n;
        this.currentStep = step;
        this.numbered = false;
        this.game = new SliderMatrix(m, n);
        this.game.solutionMask = this.solutionMask;
        this.game.restore({ blocks });
        this.cmd = createContext(this.game, step);
        this.cmd.history.save_snapshot(this.game);
        this.cmd.stepCount = 0;
    }
    /**
     * 新手引導用的固定局面：4×4 等級 1，最下面一整排向右錯開一格。
     * 只要「選第 3、4 行之間的橫縫 → 點最下面一排 → 往左推」一步就回到原位，
     * 一次走完整套「點縫 → 點塊 → 推」的流程。
     */
    loadTutorialPosition() {
        this.newPuzzle(4, 4, 1, false);
        for (const b of this.game.blocks) {
            if (b.row === 3)
                b.location = [3, b.col + 1];
        }
        // 重建歷史，讓這個局面成為「原點」（撤銷不會退回還原態）
        this.cmd = createContext(this.game, 1);
        this.cmd.history.save_snapshot(this.game);
    }
    /** 在當前謎題上切換數字形態（重新編號，不重開一局）。 */
    setNumbered(on) {
        if (this.numbered === on)
            return;
        this.numbered = on;
        this.game.assignNumbers(on);
    }
    /** 序列化為與原版完全一致的結構。 */
    serialize() {
        const entries = this.cmd.history.snapshotAll();
        const snapshots = entries.map((e) => {
            const { matrix, bounds } = blocksToMatrix(e.blocks);
            const snap = { matrix, bounds };
            if (e.move_info)
                snap.move_info = e.move_info;
            // 編號另外存，不塞進 matrix：原版存檔格式維持 0/1，原版開啟時退化為方形
            const nums = numbersInMatrixOrder(e.blocks, e.numbers);
            if (nums)
                snap.numbers = nums;
            return snap;
        });
        return {
            version: 1,
            puzzle: {
                m: this.currentM,
                n: this.currentN,
                step: this.currentStep,
                ...(this.numbered ? { kind: 'numbered' } : {}),
            },
            step_count: this.cmd.stepCount,
            ...(this.solutionMask ? { solution: Array.from(this.solutionMask) } : {}),
            history: {
                history_index: this.cmd.history.currentIndex,
                snapshots,
            },
        };
    }
    /** 由序列化結構還原（相容原版 save JSON；也相容舊版網頁格式）。 */
    deserialize(p) {
        const m = p.puzzle?.m ?? this.currentM;
        const n = p.puzzle?.n ?? this.currentN;
        const step = p.puzzle?.step ?? this.currentStep;
        if (!Number.isInteger(m) || !Number.isInteger(n) || !Number.isInteger(step))
            return false;
        if (step >= Math.max(m, n))
            return false;
        this.currentM = m;
        this.currentN = n;
        this.currentStep = step;
        this.numbered = p.puzzle?.kind === 'numbered';
        this.solutionMask = Array.isArray(p.solution)
            ? new Set(p.solution)
            : null;
        this.game = new SliderMatrix(m, n);
        this.game.solutionMask = this.solutionMask;
        // 將各格式歷史轉為 HistoryEntry（blocks + numbers? + move_info?）
        const entries = [];
        if (Array.isArray(p.history)) {
            // 舊版網頁格式：history 是 blocks 陣列
            for (const h of p.history) {
                if (Array.isArray(h?.blocks))
                    entries.push({ blocks: h.blocks, ...(h.move_info ? { move_info: h.move_info } : {}) });
            }
        }
        else if (p.history && Array.isArray(p.history.snapshots)) {
            // 原版格式：matrix + bounds + move_info?
            // numbers 是網頁版數字形態的附加欄位，順序與 matrix 掃描順序一致
            for (const snap of p.history.snapshots) {
                const blocks = matrixToBlocks(snap?.matrix, snap?.bounds);
                if (blocks) {
                    entries.push({
                        blocks,
                        ...(Array.isArray(snap?.numbers) ? { numbers: snap.numbers } : {}),
                        ...(snap?.move_info ? { move_info: snap.move_info } : {}),
                    });
                }
            }
        }
        if (entries.length > 0) {
            const last = entries[entries.length - 1];
            this.game.restore({ blocks: last.blocks, ...(last.numbers ? { numbers: last.numbers } : {}) });
        }
        this.cmd = createContext(this.game, step);
        this.cmd.stepCount = p.step_count ?? 0;
        if (entries.length > 0) {
            this.cmd.history.restoreAll(entries);
            const idx = p.history && typeof p.history === 'object' && 'history_index' in p.history
                ? p.history.history_index
                : entries.length - 1;
            this.cmd.history.setIndex(idx);
        }
        return true;
    }
}

return { GameStore };
} };
  var __cache = {};
  function __load(id) {
    if (Object.prototype.hasOwnProperty.call(__cache, id)) return __cache[id];
    var fn = __modules[id];
    if (!fn) throw new Error('module not found: ' + id);
    var require = function (spec) { return __load(__resolvedId(id, spec)); };
    return __cache[id] = fn(require);
  }
  var __resolve = { "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/main.js": "m0",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/render/BoardRenderer.js": "m1",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/core/SliderMatrix.js": "m10",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/solver/index.js": "m11",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/solver/model.js": "m12",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/solver/gather.js": "m13",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/io/SaveManager.js": "m14",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/feature/Timer.js": "m15",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/feature/Records.js": "m16",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/feature/tutorial.js": "m17",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/tutorial/tutorialData.js": "m18",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/feature/create.js": "m19",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/render/theme.js": "m2",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/core/rules.js": "m3",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/render/arrowImage.js": "m4",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/interaction/BoardController.js": "m5",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/core/CommandBus.js": "m6",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/core/GameHistory.js": "m7",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/core/Block.js": "m8",
    "E:/program_project/other/wkbddtest/GatenneaSliderWeb/dist/store/GameStore.js": "m9" };
  function __resolvedId(fromId, spec) {
    var fromAbs = null;
    for (var k in __resolve) { if (__resolve[k] === fromId) { fromAbs = k; break; } }
    var parts = fromAbs.split('/');
    parts.pop();
    var specParts = spec.split('/');
    for (var i = 0; i < specParts.length; i++) {
      if (specParts[i] === '.' || specParts[i] === '') continue;
      if (specParts[i] === '..') parts.pop();
      else parts.push(specParts[i]);
    }
    var target = parts.join('/');
    var id = __resolve[target];
    if (!id) throw new Error('module not found: ' + spec + ' from ' + fromAbs);
    return id;
  }
  __load("m0");
})();
