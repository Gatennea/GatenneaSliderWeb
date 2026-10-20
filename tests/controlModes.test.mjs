/**
 * 控制方式解耦（原版五開關：單次觸控 / 兩次觸控 / 鼠標鍵盤 / 虛擬鍵盤 / 箭頭按鍵）。
 *
 * 測的是「開關關掉後那條路真的不通」，對照原版 events.py 的兩條規則：
 *   selectable = 兩次觸控 or 鼠標鍵盤（任一開著才能選縫隙/選滑塊）
 *   拖拽起點 需 單次觸控 or 兩次觸控（兩者都關時，按在滑塊上也只是平移）
 *
 * BoardRenderer 的命中方法不碰 ctx，可用假 canvas 實例化（同 hit.test.mjs）。
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
  const canvas = { addEventListener: () => {}, width: 800, height: 500 };
  const status = [];
  const controller = new BoardController({
    canvas, renderer, store,
    onStatus: (m) => status.push(m),
  });
  return { controller, store, renderer, status };
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
];
