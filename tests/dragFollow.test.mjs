/**
 * 拖拽跟随（缺陷 18：一边拖一边动 + 越界判定）。
 * 对照原版 gui/drag.py 的 DragMixin + gui/events.py 的 MOUSEMOTION 分发。
 *
 * 两级测法：
 * 1) 纯逻辑（src/feature/dragFollow.ts）：探测上限 / 偏移投影与夹紧 / 提交量化 /
 *    接续比例 / 回弹包络——这些边界（量化会不会少走一格、贴边会不会误报）人肉拖很难复现。
 * 2) 控制器级（真 GameStore + 真 BoardRenderer，同 controlModes.test.mjs）：
 *    进入跟随 → 每帧偏移 → 松手提交 → 拖拽接续 → 越界回弹 → 边界缝拒绝。
 *
 * rAF 用「入隊 + 手動沖」的 stub：同步執行會讓回彈的 tick 自我遞歸爆棧。
 */
globalThis.window = globalThis.window ?? { addEventListener: () => {}, removeEventListener: () => {} };

const rafQueue = [];
globalThis.requestAnimationFrame = (cb) => {
  rafQueue.push(cb);
  return rafQueue.length;
};
globalThis.cancelAnimationFrame = () => {};

import { probeMaxCells, followFrame, quantizeCells, continuationRatio, shakeAmpCells, SHAKE_MS } from '../dist/feature/dragFollow.js';
import { BoardController, directGestureFromDrag } from '../dist/interaction/BoardController.js';
import { BoardRenderer } from '../dist/render/BoardRenderer.js';
import { GameStore } from '../dist/store/GameStore.js';
import { selectGap, selectBlock, shuffle, undo } from '../dist/core/CommandBus.js';

const CELL = 60;
const STEP = 64; // CELL + GAP：每格間距（世界單位），zoom=1 時也是屏幕 px
const PITCH = 64; // renderer.stepPx

/** 沖刷 rAF 隊列（有界次數，避免回彈 tick 自我遞歸停不下來） */
function flushRaf() {
  const now = performance.now() + 5000;
  for (let i = 0; i < 8 && rafQueue.length; i++) {
    const cb = rafQueue.shift();
    cb(now);
  }
}

function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}：期望 ${expected}，實為 ${actual}`);
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

function positions(game) {
  return game.blocks.map((b) => [b.row, b.col]);
}

function samePositions(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}

function makeController() {
  const store = new GameStore(4, 4, 2);
  const renderer = new BoardRenderer({ canvas: { width: 800, height: 500 } }, 1);
  const canvas = { addEventListener: () => {}, width: 800, height: 500, style: {} };
  const status = [];
  const controller = new BoardController({
    canvas, renderer, store,
    onStatus: (m) => status.push(m),
  });
  return { controller, store, renderer, status };
}

/** 塊中心的屏幕座標（zoom=1、camera=0 時屏幕=世界） */
function blockCenter(renderer, row, col) {
  const [x, y] = renderer.worldToScreen(col * STEP + CELL / 2, row * STEP + CELL / 2);
  return [x, y];
}

/**
 * 找一條「選中縫 + 選中塊 + 方向」使得 try_move(dir, step) 成功。
 * 搜索後留下選好縫/選好塊的現場（兩次觸控拖拽直接用）。
 *
 * ⚠️ 掃描範圍必須按棋盤實際外框推，不能硬編碼 0..4：安全打亂是隨機遊走
 * （最多 80 步 × ±2 格），實測 28% 的局面前 0..4 內一條合法縫都不剩
 * （外框漂到如 rows -14..-8 × cols 9..14）。曾經硬編碼，於是偶發
 * 「打亂後應至少存在一步可走」失敗——不是打亂出錯，是搜索範圍漏了外框外的縫。
 * （不變式：安全打亂最後一步的反向步必然合法，全範圍掃描下 500/500 非空。）
 */
function findMovableSetup(store) {
  const step = store.currentStep;
  const bounds = store.game.get_boundaries();
  const ranges = { h: [bounds.min_row, bounds.max_row - 1], v: [bounds.min_col, bounds.max_col - 1] };
  for (const type of ['h', 'v']) {
    for (let line = ranges[type][0]; line <= ranges[type][1]; line++) {
      if (!selectGap(store.cmd, type, line).ok) continue;
      for (const b of [...store.game.blocks]) {
        if (!selectBlock(store.cmd, b.row, b.col).ok) continue;
        const dirs = type === 'h' ? ['d', 'a'] : ['s', 'w'];
        for (const dir of dirs) {
          if (store.game.try_move(dir, step)) return { type, line, row: b.row, col: b.col, dir };
        }
      }
    }
  }
  return null;
}

/** 找一條「單次觸控（無預選縫隙）下 8 區映射剛好可走」的設置；結束時清空選中。 */
function findSingleTouchSetup(store) {
  const step = store.currentStep;
  for (const b of [...store.game.blocks]) {
    const g = directGestureFromDrag(b.row, b.col, PITCH, 0); // 向右拖
    if (!selectGap(store.cmd, g.gap.type, g.gap.line).ok) continue;
    if (!selectBlock(store.cmd, b.row, b.col).ok) continue;
    if (store.game.try_move(g.direction, step)) {
      // 清空選中，模擬「沒有預選縫隙」的單次觸控現場
      store.cmd.selectedGap = null;
      store.cmd.selectedBlock = null;
      store.game.selected.clear();
      return { row: b.row, col: b.col };
    }
  }
  return null;
}

/** 方向 → 拖拽向量（沿該方向拖 d 像素） */
const DRAG_VEC = { d: [1, 0], a: [-1, 0], w: [0, -1], s: [0, 1] };
/** 方向 → (行, 列) 增量 */
const DIR_DELTA = { d: [0, 1], a: [0, -1], w: [-1, 0], s: [1, 0] };

export const cases = [
  // ---------- 純邏輯 ----------
  {
    name: 'probeMaxCells：全選按 0 格（整盤剛體平移不改變形狀，對照原版 all_selected）',
    run() {
      const store = new GameStore(4, 4, 2);
      for (const b of store.game.blocks) store.game.selected.add(b);
      eq(probeMaxCells(store.game, 'd', 2), 0, '全選應按 0 格');
      eq(probeMaxCells(store.game, 'w', 2), 0, '全選任何方向都 0 格');
    },
  },
  {
    name: 'probeMaxCells：結果是 step 倍數、且确為可達上限（+step 必然不合法）',
    run() {
      const store = new GameStore(4, 4, 2);
      shuffle(store.cmd, 200);
      const setup = findMovableSetup(store);
      ok(setup, '打亂後應至少存在一步可走');
      const game = store.game;
      const step = store.currentStep;
      const reach = probeMaxCells(game, setup.dir, step);
      ok(reach % step === 0, `結果應是 step 倍數，實為 ${reach}`);
      if (reach > 0) ok(game.try_move(setup.dir, reach), 'reach 格應可走');
      ok(!game.try_move(setup.dir, reach + step), 'reach+step 應不合法（确為上限）');
    },
  },
  {
    name: 'followFrame：四方向投影（拖的方向即前進，反向拖回停在原位）',
    run() {
      const f = (dir, dx, dy) => followFrame(dir, dx, dy, PITCH, 4);
      let r = f('d', 64, 0);
      eq(r.dr, 0, 'd：行不動'); eq(r.dc, 1, 'd：拖 1 間距 = 1 格'); ok(!r.invalid, 'd：未越界');
      r = f('a', -64, 0);
      eq(r.dc, -1, 'a：向左拖前進'); ok(!r.invalid, 'a：未越界');
      r = f('w', 0, -64);
      eq(r.dr, -1, 'w：向上拖前進'); ok(!r.invalid, 'w：未越界');
      r = f('s', 0, 64);
      eq(r.dr, 1, 's：向下拖前進'); ok(!r.invalid, 's：未越界');
      // 反向拖回起點：停在原位，絕不產生反向位移
      r = f('d', -100, 0);
      eq(r.dc, 0, '反拖應停在 0');
      r = f('w', 0, 100);
      eq(r.dr, 0, '反拖應停在 0');
      // 垂直分量不參與水平方向的投影
      r = f('d', 64, 500);
      eq(r.dc, 1, '垂直抖動不影響水平偏移');
    },
  },
  {
    name: 'followFrame：夾緊到 [0,max] 與 0.05 格容差（貼邊不誤報）',
    run() {
      const r1 = followFrame('d', 64 * 2.5, 0, PITCH, 2);
      eq(r1.dc, 2, '超過上限應夾到 2');
      ok(r1.invalid, '超過上限 0.5 格應報越界');
      // 恰好貼邊 + 0.05 格以內：不報（覆蓋像素取整誤差）
      const r2 = followFrame('d', 64 * 2.04, 0, PITCH, 2);
      ok(!r2.invalid, '貼邊 0.04 格不應報越界');
      const r3 = followFrame('d', 64 * 2.06, 0, PITCH, 2);
      ok(r3.invalid, '超出 0.06 格應報越界');
    },
  },
  {
    name: 'quantizeCells：int(x+0.5)*step，規避 round 銀行家舍入',
    run() {
      const q = (c) => quantizeCells(c, 2);
      eq(q(0.6), 0, '半格以內不提交');
      eq(q(1), 2, '1 格進位到 2（round(0.5) 會給 0，這裡必須給 1 格組）');
      eq(q(1.4), 2, '1.4 格仍屬最近的一組');
      eq(q(2), 2, '整組不進位');
      eq(q(2.6), 2, '2.6 歸到 2');
      eq(q(3), 4, '3 格進位到兩組');
      eq(quantizeCells(1, 1), 1, 'step=1 時逐格');
      eq(quantizeCells(0, 3), 0, '0 還是 0');
    },
  },
  {
    name: 'continuationRatio：接續比例夾緊在 [0,1]',
    run() {
      eq(continuationRatio(0, 1, 0, 2), 0.5, '跟了一半 → 動畫只滑剩下的一半');
      eq(continuationRatio(0, 3, 0, 2), 1, '跟過頭 → 起點停在落點，不退回去了');
      eq(continuationRatio(0, -1, 0, 2), 0, '反向偏移不產生負比例');
      eq(continuationRatio(0, 0, 0, 2), 0, '零偏移 = 不接續');
      eq(continuationRatio(0, 1, 0, 0), 0, '總位移為 0 時無比例可談');
      eq(continuationRatio(1, 0, 0, 2), 0, '分量正交不計入');
    },
  },
  {
    name: 'shakeAmpCells：先衝後彈的衰減包絡，兩端歸零',
    run() {
      // 包絡 = 6px×zoom×phase×|sin(π·phase)|，phase 從 1 衰到 0：
      // 起點和終點都恰好是 0（sin(0)=sin(π)=0），中點最大——「先衝一下再彈回」
      const a0 = shakeAmpCells(0, 1, PITCH);
      const aMid = shakeAmpCells(SHAKE_MS / 2, 1, PITCH);
      const aLate = shakeAmpCells(SHAKE_MS * 0.9, 1, PITCH);
      ok(Math.abs(a0) < 1e-9, `起點應為 0，實為 ${a0}`);
      ok(aMid > 0, '中點應有振幅');
      ok(aLate > 0 && aLate < aMid, '尾段更小但仍有振幅');
      eq(shakeAmpCells(SHAKE_MS, 1, PITCH), 0, '結束歸零');
      eq(shakeAmpCells(SHAKE_MS * 2, 1, PITCH), 0, '超時歸零');
      // 6px×zoom 折算成格：zoom=2、間距 128 時中點振幅 = 6/128
      ok(Math.abs(shakeAmpCells(SHAKE_MS / 2, 2, 128) - 6 / 128) < 1e-9, '振幅隨 zoom 與間距折算');
    },
  },

  // ---------- 控制器級 ----------
  {
    name: '進入跟隨：按在塊上拖過閾值 → 實時偏移 + 選中組 + 定縫',
    run() {
      rafQueue.length = 0;
      const { controller, store, renderer } = makeController();
      const setup = findMovableSetup(store);
      ok(setup, '打亂後應至少存在一步可走');
      const [vx, vy] = DRAG_VEC[setup.dir];
      const [px, py] = blockCenter(renderer, setup.row, setup.col);
      controller.onPointerDown(px, py);
      ok(!renderer.dragFollow, '按下時還不應進入跟隨');
      controller.onPointerMove(px + vx * PITCH, py + vy * PITCH); // 沿可走方向拖 1 格
      ok(renderer.dragFollow, '拖過閾值應進入跟隨');
      eq(renderer.dragFollow.dr, DIR_DELTA[setup.dir][0], '行偏移 = 方向增量');
      eq(renderer.dragFollow.dc, DIR_DELTA[setup.dir][1], '列偏移 = 方向增量');
      ok(store.cmd.selectedGap, '跟隨已定縫');
      ok(store.game.selected.size > 0, '跟隨已選中連通組');
      controller.cancelFollow();
    },
  },
  {
    name: '跟隨夾緊：拖到可達上限就停住',
    run() {
      rafQueue.length = 0;
      const { controller, store, renderer } = makeController();
      const setup = findMovableSetup(store);
      const step = store.currentStep;
      const max = probeMaxCells(store.game, setup.dir, step);
      ok(max >= step, '該設置至少能走一組');
      const [px, py] = blockCenter(renderer, setup.row, setup.col);
      controller.onPointerDown(px, py);
      controller.onPointerMove(px + PITCH, py);
      controller.onPointerMove(px + PITCH * 20, py); // 使勁往前拖
      const f = renderer.dragFollow;
      eq(Math.abs(f.dr) + Math.abs(f.dc), max, '偏移應夾在可達上限');
      controller.cancelFollow();
    },
  },
  {
    name: '松手提交：量化到 step 整數倍並真的走（含拖拽接續、快照記實際格數、撤銷能還原）',
    run() {
      rafQueue.length = 0;
      const { controller, store, renderer } = makeController();
      const setup = findMovableSetup(store);
      const step = store.currentStep;
      const [vx, vy] = DRAG_VEC[setup.dir];
      const [dr0, dc0] = DIR_DELTA[setup.dir];
      const before = positions(store.game);
      const stepsBefore = store.cmd.stepCount;
      const [px, py] = blockCenter(renderer, setup.row, setup.col);
      controller.onPointerDown(px, py);
      controller.onPointerMove(px + vx * PITCH, py + vy * PITCH); // 拖 1 格 → 量化成 1 組
      controller.onPointerUp();
      // 拖拽接續：動畫起點已被前移、時長縮短（先斷言，再沖刷提交）
      ok(renderer.animation, '松手應播放動畫');
      ok(renderer.animation.durationMs < controller.moveDurationMs,
        `接續後時長應短於整段（${renderer.animation.durationMs} vs ${controller.moveDurationMs}）`);
      flushRaf();
      ok(!renderer.animation, '沖刷後動畫應結束');
      const after = positions(store.game);
      let movedCount = 0;
      for (let i = 0; i < after.length; i++) {
        if (after[i][0] !== before[i][0] || after[i][1] !== before[i][1]) {
          movedCount++;
          // 動過的塊必須整整移動一組（step 格）沿鎖定方向
          if (after[i][0] - before[i][0] !== dr0 * step || after[i][1] - before[i][1] !== dc0 * step) {
            throw new Error(`塊 ${i} 位移不對：${before[i]} → ${after[i]}`);
          }
        }
      }
      ok(movedCount > 0, '應有塊移動');
      ok(movedCount < after.length, '不該整盤都動（那就成了剛體平移）');
      eq(store.cmd.stepCount, stepsBefore + 1, '記 1 步');
      // 快照記「實際推進格數」：撤銷動畫按 post = pre + delta*step 重建位置
      const info = store.cmd.history.currentMoveInfo();
      ok(info, '應有 move_info');
      eq(info.step, step, '單組拖動快照 step = 一組格數');
      // 撤銷還原
      ok(undo(store.cmd).ok, '撤銷應成功');
      ok(samePositions(positions(store.game), before), '撤銷後應回到拖動前');
    },
  },
  {
    name: '堵死方向：整組走不動時拖了也不動，明說「推不動」',
    run() {
      rafQueue.length = 0;
      const { controller, store, renderer, status } = makeController();
      // 直接擺一個「牆就在一格外」的局面（引擎不校驗靜態棋盤，只需連通）：
      //   row 0: X X . X .
      //   row 1: X X . X .
      //   row 2: X X X X X
      //   row 3: X X X X X
      // h 縫 line=1 的上半左簇（rows 0-1 × cols 0-1）往右：第 1 格暢通，第 2 格撞上
      // (0,3) → 可達 1 格；step=2 向下取整後上限 0 —— 玩家視角就是「這組推不動」。
      // （引擎只查碰撞/斷連、不查越界，所以堵死必須是真的撞到東西。）
      const layout = [
        [0, 0], [0, 1], [0, 3],
        [1, 0], [1, 1], [1, 3],
        [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
        [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
      ];
      store.game.blocks.forEach((b, i) => { b.location = [layout[i][0], layout[i][1]]; });
      ok(selectGap(store.cmd, 'h', 1).ok, '構造：縫隙應合法');
      ok(selectBlock(store.cmd, 0, 0).ok, '構造：應選中上半左簇');
      eq(store.game.selected.size, 4, '構造：選中組應是 4 塊');
      eq(probeMaxCells(store.game, 'd', 2), 0, '整組（step=2）應推不動');

      const [px, py] = blockCenter(renderer, 0, 0);
      const before = positions(store.game);
      controller.onPointerDown(px, py);
      controller.onPointerMove(px + PITCH * 3, py); // 向右使勁拖
      ok(renderer.dragFollow, '推不動也應進入跟隨（只是上限 0）');
      eq(renderer.dragFollow.dc, 0, '上限 0 → 偏移夾在 0');
      controller.onPointerUp();
      flushRaf();
      ok(!renderer.dragFollow, '松手後跟隨結束');
      ok(samePositions(positions(store.game), before), '推不動的方向不應移動任何塊');
      ok(status.some((m) => m.includes('推不动')), `應明說推不動，實為 ${status.join(' / ')}`);
      // 偏移被夾在 0 → 沒有方向可抖（原版同理：_shake_offset 返回 (0,0)），不強求回彈
      ok(!renderer.followShake, '零偏移不產生回彈');
    },
  },
  {
    name: 'spawnFollowShake：記住松手那刻的選中組（拷貝）與方向符號',
    run() {
      rafQueue.length = 0;
      const { store, renderer } = makeController();
      const blocks = new Set([store.game.blocks[0], store.game.blocks[1]]);
      renderer.spawnFollowShake(blocks, -1, 0); // 向上越界
      ok(renderer.followShake, '應置位回彈狀態');
      eq(renderer.followShake.dr, -1, '行符號取 -1');
      eq(renderer.followShake.dc, 0, '列符號取 0');
      blocks.clear(); // 模擬單次觸控隨後清空選中
      eq(renderer.followShake.blocks.size, 2, '應是拷貝：不隨原集合清空而消失');
      renderer.spawnFollowShake(new Set(), 1, 0);
      ok(renderer.followShake, '空集合不應覆蓋已有狀態');
    },
  },
  {
    name: '邊界縫拒絕：整盤外沿的塊拖不出跟隨（第 1 項護欄在跟隨入口同樣生效）',
    run() {
      rafQueue.length = 0;
      const { controller, store, renderer, status } = makeController();
      // 棋盤恆為滿的 m×n，右下角塊 (3,3) 向上拖 → 8 區算出邊界縫（v line = max_col）
      const [px, py] = blockCenter(renderer, 3, 3);
      controller.onPointerDown(px, py);
      controller.onPointerMove(px, py - 60); // 向上拖
      ok(!renderer.dragFollow, '邊界縫不應進入跟隨');
      ok(status.some((m) => m.includes('没有可推的缝隙')), `應提示沒有可推的縫隙，實為 ${status.join(' / ')}`);
      const before = positions(store.game);
      controller.onPointerUp();
      flushRaf();
      ok(samePositions(positions(store.game), before), '邊界縫拖拽不應移動任何塊');
    },
  },
  {
    name: '未過閾值：按下只拖一小截 → 不進跟隨，松手算點擊',
    run() {
      rafQueue.length = 0;
      const { controller, store, renderer } = makeController();
      const setup = findMovableSetup(store);
      const [px, py] = blockCenter(renderer, setup.row, setup.col);
      controller.onPointerDown(px, py);
      controller.onPointerMove(px + 5, py + 3); // 遠小於閾值
      ok(!renderer.dragFollow, '小位移不應進入跟隨');
      const before = positions(store.game);
      controller.onPointerUp();
      flushRaf();
      ok(samePositions(positions(store.game), before), '小位移不應移動');
    },
  },
  {
    name: '單次觸控路徑：無預選縫隙時 8 區定縫，结束自動取消選中',
    run() {
      rafQueue.length = 0;
      const { controller, store, renderer } = makeController();
      const setup = findSingleTouchSetup(store);
      ok(setup, '應找到一條單次觸控可走的路');
      ok(!store.cmd.selectedGap, '前提：無預選縫隙');
      const [px, py] = blockCenter(renderer, setup.row, setup.col);
      controller.onPointerDown(px, py);
      controller.onPointerMove(px + PITCH, py); // 向右拖 → 第 0 區：h 縫 + 右移
      ok(renderer.dragFollow, '單次觸控也應進入跟隨');
      ok(store.cmd.selectedGap, '8 區映射已定縫');
      const before = positions(store.game);
      controller.onPointerUp();
      flushRaf();
      ok(!samePositions(positions(store.game), before), '應完成一次移動');
      eq(store.game.selected.size, 0, '單次觸控结束自動取消選中');
      ok(!store.cmd.selectedGap, '單次觸控结束自動清縫隙');
    },
  },
];
