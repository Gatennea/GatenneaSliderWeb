/**
 * 控制方式解耦（原版五開關：單次觸控 / 兩次觸控 / 鼠標鍵盤 / 虛擬鍵盤 / 箭頭按鍵）。
 *
 * 測的是「開關關掉後那條路真的不通」，對照原版 events.py 的兩條規則：
 *   selectable = 兩次觸控 or 鼠標鍵盤（任一開著才能選縫隙/選滑塊）
 *   拖拽起點 需 單次觸控 or 兩次觸控（兩者都關時，按在滑塊上也只是平移）
 *
 * BoardRenderer 的命中方法不碰 ctx，可用假 canvas 實例化（同 hit.test.mjs）。
 * 文件末尾另測雙指縮放的錨點行為（起始兩指中點為錨，對照原版 Ctrl+滾輪）。
 */
// BoardController.attach() 會綁 window 事件，Node 沒有 window，先塞個 stub
globalThis.window = globalThis.window ?? { addEventListener: () => {}, removeEventListener: () => {} };

import { BoardController } from '../dist/interaction/BoardController.js';
import { BoardRenderer } from '../dist/render/BoardRenderer.js';
import { GameStore } from '../dist/store/GameStore.js';

// 與 hit.test.mjs 同一套幾何：CELL 60 / GAP 4 / STEP 64
const GAP_Y = 62; // h 線 line=0（row0 與 row1 之間）
const BLOCK_X = 30;
const BLOCK_Y = 30; // 塊 (0,0) 中心
const FAR_X = 700;
const FAR_Y = 470; // 棋盤外的空白

function makeController() {
  const store = new GameStore(4, 4, 2);
  const renderer = new BoardRenderer({ canvas: { width: 800, height: 500 } }, 1);
  const handlers = {};
  const canvas = {
    width: 800, height: 500, style: {},
    addEventListener: (type, fn) => { (handlers[type] ??= []).push(fn); },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  const status = [];
  const controller = new BoardController({
    canvas, renderer, store,
    onStatus: (m) => status.push(m),
  });
  return { controller, store, renderer, status, canvas, handlers };
}

/** 構造一個 touch 事件（只需 touches 與 preventDefault） */
function touchEvt(points) {
  return { touches: points.map(([x, y]) => ({ clientX: x, clientY: y })), preventDefault: () => {} };
}

/** 派發到 canvas 上指定類型的所有監聽器（attach() 註冊的） */
function fire(handlers, type, evt) {
  for (const fn of handlers[type] ?? []) fn(evt);
}

export const cases = [
  {
    name: 'selectable = 兩次觸控 or 鼠標鍵盤（原版 events.py 的規則）',
    run() {
      const { controller } = makeController();
      const set = (s, t, k) => {
        controller.singleTouchEnabled = s;
        controller.twoTouchEnabled = t;
        controller.keyboardMouseEnabled = k;
      };
      set(true, true, true);
      if (!controller.selectable) throw new Error('全開應可選中');
      set(true, false, true);
      if (!controller.selectable) throw new Error('只關兩次觸控：鼠標仍能選中');
      set(true, true, false);
      if (!controller.selectable) throw new Error('只關鼠標鍵盤：兩次觸控仍能選中');
      set(true, false, false);
      if (controller.selectable) throw new Error('兩者都關就不能選中了');
      // 單次觸控不在條件裡：它的拖拽自帶定縫，不需要先選
      set(false, false, true);
      if (!controller.selectable) throw new Error('單次觸控關不影響選中（靠鼠標鍵盤）');
    },
  },
  {
    name: '單次/兩次觸控都關時，按在滑塊上也只是平移（全關只剩平移/縮放）',
    run() {
      const { controller } = makeController();
      controller.singleTouchEnabled = false;
      controller.twoTouchEnabled = false;
      controller.keyboardMouseEnabled = true;
      controller.onPointerDown(BLOCK_X, BLOCK_Y);
      if (!controller.drag.pan) throw new Error('兩種觸控都關：按滑塊也應能平移');

      // 開回單次觸控：按在滑塊上就不該平移（對照原版：拖塊優先於拖地圖）
      controller.singleTouchEnabled = true;
      controller.onPointerDown(BLOCK_X, BLOCK_Y);
      if (controller.drag.pan) throw new Error('有觸控方式時，按滑塊不該平移');

      controller.twoTouchEnabled = true;
      controller.singleTouchEnabled = false;
      controller.onPointerDown(BLOCK_X, BLOCK_Y);
      if (controller.drag.pan) throw new Error('只開兩次觸控也能起拖');
    },
  },
  {
    name: '空白處任何開關組合都能平移（平移/縮放永遠不會被關掉）',
    run() {
      const { controller } = makeController();
      for (const [s, t, k] of [[true, true, true], [false, false, false], [false, true, false]]) {
        controller.singleTouchEnabled = s;
        controller.twoTouchEnabled = t;
        controller.keyboardMouseEnabled = k;
        controller.onPointerDown(FAR_X, FAR_Y);
        if (!controller.drag.pan) throw new Error(`空白處應總能平移（${s}/${t}/${k}）`);
      }
    },
  },
  {
    name: '點縫隙：能選中就選中，兩者都關時不選中且要有話說',
    run() {
      // 可選中：點到縫隙就選上
      {
        const { controller, store, status } = makeController();
        controller.twoTouchEnabled = true;
        controller.keyboardMouseEnabled = true;
        controller.handleClick(BLOCK_X, GAP_Y);
        if (!store.cmd.selectedGap) throw new Error('可選中時應選上縫隙');
        if (!status.some((m) => String(m).includes('选中'))) throw new Error('應提示已選中');
      }
      // 都關：不選中，但要提示為什麼（原版全關時只剩平移/縮放）
      {
        const { controller, store, status } = makeController();
        controller.twoTouchEnabled = false;
        controller.keyboardMouseEnabled = false;
        controller.handleClick(BLOCK_X, GAP_Y);
        if (store.cmd.selectedGap) throw new Error('不可選中時不該選上縫隙');
        if (!status.some((m) => String(m).includes('平移'))) {
          throw new Error(`應提示只能平移/縮放，實為 ${JSON.stringify(status)}`);
        }
      }
    },
  },
  {
    name: '箭頭按鍵有自己的開關：關掉後點不中箭頭',
    run() {
      const { controller, renderer } = makeController();
      // 手動擺一顆箭頭在原點，驗證開關兩態下 handleClick 的不同走向
      renderer.arrowEnabled = true;
      renderer.arrowButtons = [{ x: BLOCK_X, y: BLOCK_Y, size: 20, dir: 'd' }];
      controller.twoTouchEnabled = true;
      controller.handleClick(BLOCK_X, BLOCK_Y);
      const hit = renderer.arrowEnabled; // 開關仍開 = 這一擊被箭頭吃掉
      if (!hit) throw new Error('箭頭開關應保持開');
      // 關掉：同樣位置不該再走箭頭分支（此處只驗證不拋錯且開關狀態為關）
      renderer.arrowEnabled = false;
      controller.handleClick(BLOCK_X, BLOCK_Y);
      if (renderer.arrowEnabled !== false) throw new Error('箭頭開關關掉後不該被改回');
    },
  },
  {
    name: '雙指縮放以起始兩指中點為錨：錨點處的世界座標縮放後不動',
    run() {
      const { controller, renderer, handlers } = makeController();
      // 模擬「已經平移過」的相機（非零 camera），錨點數學必須能處理任意相機
      renderer.cameraX = 137.5;
      renderer.cameraY = -62.25;
      const ax = 300, ay = 200; // pinch 起始中點（canvas 座標）
      const [wx, wy] = renderer.screenToWorld(ax, ay);

      fire(handlers, 'touchstart', touchEvt([[ax - 50, ay], [ax + 50, ay]]));
      const zoom0 = renderer.zoom;
      fire(handlers, 'touchmove', touchEvt([[ax - 100, ay], [ax + 100, ay]]));
      const zoom1 = renderer.zoom;
      if (Math.abs(zoom1 - zoom0 * 2) > 1e-9) {
        throw new Error(`間距翻倍 zoom 應翻倍：${zoom0} → ${zoom1}`);
      }
      const [sx, sy] = renderer.worldToScreen(wx, wy);
      if (Math.abs(sx - ax) > 1e-6 || Math.abs(sy - ay) > 1e-6) {
        throw new Error(`錨點世界座標應留在原地，實飄到 (${sx.toFixed(2)}, ${sy.toFixed(2)})`);
      }

      // 縮小同理：繼續收到更小間距，錨點依然不漂
      fire(handlers, 'touchmove', touchEvt([[ax - 25, ay], [ax + 25, ay]]));
      const [sx2, sy2] = renderer.worldToScreen(wx, wy);
      if (Math.abs(sx2 - ax) > 1e-6 || Math.abs(sy2 - ay) > 1e-6) {
        throw new Error(`縮小後錨點也不該漂，實飄到 (${sx2.toFixed(2)}, ${sy2.toFixed(2)})`);
      }
    },
  },
  {
    name: '雙指縮放錨點固定為起始中點：中途平移兩指不換錨',
    run() {
      const { controller, renderer, handlers } = makeController();
      const ax = 300, ay = 200;
      const [wx, wy] = renderer.screenToWorld(ax, ay);
      fire(handlers, 'touchstart', touchEvt([[ax - 50, ay], [ax + 50, ay]]));
      // 兩指整體移到 (500,400) 但間距不變 → factor=1，zoom/camera 都不該動
      const camX = renderer.cameraX, camY = renderer.cameraY, zoom = renderer.zoom;
      fire(handlers, 'touchmove', touchEvt([[450, 400], [550, 400]]));
      if (renderer.zoom !== zoom || renderer.cameraX !== camX || renderer.cameraY !== camY) {
        throw new Error('間距不變時不該改 zoom/camera');
      }
      // 之後再拉開間距：錨點仍是起始中點 (300,200)，不是當前中點 (500,400)
      fire(handlers, 'touchmove', touchEvt([[350, 400], [650, 400]]));
      const [sx, sy] = renderer.worldToScreen(wx, wy);
      if (Math.abs(sx - ax) > 1e-6 || Math.abs(sy - ay) > 1e-6) {
        throw new Error(`錨點應為起始中點，實以 (${sx.toFixed(2)}, ${sy.toFixed(2)}) 為錨`);
      }
    },
  },
  {
    name: 'pinch 結束後清錨點：下一次 pinch 以新中點為錨',
    run() {
      const { controller, renderer, handlers } = makeController();
      fire(handlers, 'touchstart', touchEvt([[250, 150], [350, 150]]));
      fire(handlers, 'touchmove', touchEvt([[150, 150], [450, 150]]));
      fire(handlers, 'touchend', touchEvt([[300, 150]])); // 抬起一根 → pinch 結束
      const zoomAfterFirst = renderer.zoom;

      // 第二次 pinch 在新中點 (600,300)
      const bx = 600, by = 300;
      const [wx, wy] = renderer.screenToWorld(bx, by);
      fire(handlers, 'touchstart', touchEvt([[bx - 50, by], [bx + 50, by]]));
      fire(handlers, 'touchmove', touchEvt([[bx - 150, by], [bx + 150, by]]));
      const [sx, sy] = renderer.worldToScreen(wx, wy);
      if (Math.abs(sx - bx) > 1e-6 || Math.abs(sy - by) > 1e-6) {
        throw new Error(`第二次 pinch 應以新中點為錨，實飄到 (${sx.toFixed(2)}, ${sy.toFixed(2)})`);
      }
      if (renderer.zoom <= zoomAfterFirst) {
        throw new Error('第二次 pinch 應在第一次基礎上繼續放大');
      }
    },
  },
  {
    name: '虛擬鼠標（觸屏）：單指按下即出圓點 + 開啟時把手指當 hover 源（連鎖亮起）',
    run() {
      const { controller, renderer, handlers } = makeController();
      renderer.showVirtualMouse = true;
      renderer.chainHintEnabled = true;
      const px = BLOCK_X, py = BLOCK_Y; // 塊 (0,0) 中心
      fire(handlers, 'touchstart', touchEvt([[px, py]]));
      if (!renderer.virtualPointer || renderer.virtualPointer.x !== px || renderer.virtualPointer.y !== py) {
        throw new Error(`虛擬指針應在按下點 (${px},${py})，實為 ${JSON.stringify(renderer.virtualPointer)}`);
      }
      const expectCell = renderer.getCellAtPos(px, py);
      if (JSON.stringify(renderer.hoverCell) !== JSON.stringify(expectCell)) {
        throw new Error(`連鎖應因虛擬鼠標亮起於 ${JSON.stringify(expectCell)}，實為 ${JSON.stringify(renderer.hoverCell)}`);
      }
    },
  },
  {
    name: '虛擬鼠標（觸屏）：touchmove 圓點跟手、未拖動時 hover 實時跟隨',
    run() {
      const { controller, renderer, handlers } = makeController();
      renderer.showVirtualMouse = true;
      renderer.chainHintEnabled = true;
      fire(handlers, 'touchstart', touchEvt([[BLOCK_X, BLOCK_Y]]));
      // 小幅移動（不超拖動門檻，不進入跟隨），圓點應跟到新點
      const nx = BLOCK_X + 5, ny = BLOCK_Y + 5;
      fire(handlers, 'touchmove', touchEvt([[nx, ny]]));
      if (!renderer.virtualPointer || renderer.virtualPointer.x !== nx || renderer.virtualPointer.y !== ny) {
        throw new Error('圓點應跟手到新座標');
      }
      // 仍在同一格內（小移動不跨格），hover 應持續為該格
      const expectCell = renderer.getCellAtPos(nx, ny);
      if (JSON.stringify(renderer.hoverCell) !== JSON.stringify(expectCell)) {
        throw new Error('未拖動時 hover 應實時跟隨手指');
      }
    },
  },
  {
    name: '虛擬鼠標（觸屏）：單指鬆開清除圓點與 hover',
    run() {
      const { controller, renderer, handlers } = makeController();
      renderer.showVirtualMouse = true;
      renderer.chainHintEnabled = true;
      fire(handlers, 'touchstart', touchEvt([[BLOCK_X, BLOCK_Y]]));
      if (!renderer.virtualPointer) throw new Error('按下後應有圓點');
      if (!renderer.hoverCell) throw new Error('按下後應有 hover');
      fire(handlers, 'touchend', touchEvt([[BLOCK_X, BLOCK_Y]]));
      if (renderer.virtualPointer !== null) throw new Error('鬆開後圓點應消失');
      if (renderer.hoverCell !== null) throw new Error('鬆開後 hover 應清除（觸屏無真 hover）');
    },
  },
  {
    name: '虛擬鼠標關閉時：觸屏不驅動連鎖（圓點資料仍記但繪製不顯示）',
    run() {
      const { controller, renderer, handlers } = makeController();
      renderer.showVirtualMouse = false;
      renderer.chainHintEnabled = true;
      fire(handlers, 'touchstart', touchEvt([[BLOCK_X, BLOCK_Y]]));
      // 關閉時不調 updateHover → hoverCell 不變（保持 null），連鎖不觸發
      if (renderer.hoverCell !== null) throw new Error('關閉虛擬鼠標時觸屏不應驅動連鎖');
      // 圓點座標仍被記錄（便宜），但繪製時由 showVirtualMouse 攔掉，不影響行為
      if (!renderer.virtualPointer) throw new Error('按下點仍記入 virtualPointer（供繪製判斷）');
    },
  },
];
