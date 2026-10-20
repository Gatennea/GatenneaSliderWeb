/**
 * 虛擬鍵盤的純邏輯：佈局、面板夾邊、跳到某步、粘滯連播。
 *
 * DOM 那一側（按鈕長相、拖動事件）測不到，所以把這三塊抽成純函數——
 * 舊版「面板能被拖出畫面」「連續撤銷停不下來」都是只有人肉點才會發現的毛病。
 */
import {
  VK, vkPanelSize, vkDirectionRows, vkBuildLayout, vkClampPosition, vkDefaultPosition,
  resolveJumpTarget, StickyPlayer,
} from '../dist/feature/virtualKeyboard.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 斷言：實際值必須等於期望值 */
function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}：期望 ${expected}，實為 ${actual}`);
  }
}

export const cases = [
  {
    name: '面板尺寸對齊原版：寬 216 固定，高隨方向鍵行數',
    run() {
      const s2 = vkPanelSize(2);
      eq(s2.w, 8 * 2 + 62 * 2 + 54 + 6 * 2, '寬度（動作列決定）');
      eq(s2.h, 26 + 8 + 44 * 2 + 6 * 2 + 32 + 6 + 30 + 8, '高度（2 行方向鍵）');
      const s3 = vkPanelSize(3);
      eq(s3.w, s2.w, '換行數不影響寬度');
      eq(s3.h - s2.h, 44 + 6, '多一行多一顆鍵的高度');
      eq(vkDirectionRows(), 2, '網頁版只有矩形形態，恆 2 行');
    },
  },
  {
    name: '佈局：所有元件都在面板內，且動作列與跳到列都居中',
    run() {
      const L = vkBuildLayout(100, 50);
      const { panel } = L;
      const inside = (r, what) => {
        if (r.x < panel.x || r.y < panel.y
          || r.x + r.w > panel.x + panel.w + 0.001
          || r.y + r.h > panel.y + panel.h + 0.001) {
          throw new Error(`${what} 超出面板：${JSON.stringify(r)} vs ${JSON.stringify(panel)}`);
        }
      };
      for (const [action, r] of Object.entries(L.buttons)) inside(r, action);
      inside(L.jumpInput, 'jumpInput');
      inside(L.jumpBtn, '跳到按鈕');
      inside(L.close, '關閉鈕');

      // 每個元件的中心都該落在面板中線上（水平置中）
      const centerX = panel.x + panel.w / 2;
      for (const action of ['move_up', 'move_down', 'sticky']) {
        const r = L.buttons[action];
        const mid = r.x + r.w / 2;
        if (action === 'sticky') {
          // 動作列三者合起來居中，故粘滯在最左、不在中線
          const rightEnd = L.buttons['redo'].x + L.buttons['redo'].w;
          const groupMid = (r.x + rightEnd) / 2;
          if (Math.abs(groupMid - centerX) > 0.001) {
            throw new Error(`動作列未居中：${groupMid} vs ${centerX}`);
          }
        } else if (Math.abs(mid - centerX) > 0.001) {
          throw new Error(`${action} 未居中：${mid} vs ${centerX}`);
        }
      }
      const jumpMid = (L.jumpInput.x + L.jumpBtn.x + L.jumpBtn.w) / 2;
      if (Math.abs(jumpMid - centerX) > 0.001) throw new Error('跳到列未居中');

      // 左/下/右 同一行，且左在左、右在右
      eq(L.buttons['move_left'].y, L.buttons['move_down'].y, '第二行同高');
      if (!(L.buttons['move_left'].x < L.buttons['move_down'].x
        && L.buttons['move_down'].x < L.buttons['move_right'].x)) {
        throw new Error('左/下/右 順序不對');
      }
      // 撤銷在粘滯右邊、重做在撤銷右邊
      if (!(L.buttons['sticky'].x < L.buttons['undo'].x && L.buttons['undo'].x < L.buttons['redo'].x)) {
        throw new Error('粘滞/撤销/重做 順序不對');
      }
      // 關閉鈕在標題欄右側
      if (!(L.close.x > centerX && L.close.y < L.title.y + L.title.h)) {
        throw new Error('關閉鈕應在標題欄右側');
      }
    },
  },
  {
    name: '夾邊：面板不得超出畫面，也不得壓住選單列與狀態列',
    run() {
      const size = { w: 216, h: 200 };
      const vp = { width: 1000, height: 800 };
      const chrome = { top: 32, bottom: 28 };
      // 往左上拖過頭 → 夾回 (0, 32)
      let p = vkClampPosition({ x: -50, y: -50 }, vp, size, chrome);
      eq(p.x, 0, '左邊界');
      eq(p.y, 32, '上邊界（不得壓選單列）');
      // 往右下拖過頭 → 夾回 (1000-216, 800-28-200)
      p = vkClampPosition({ x: 9999, y: 9999 }, vp, size, chrome);
      eq(p.x, 1000 - 216, '右邊界');
      eq(p.y, 800 - 28 - 200, '下邊界（不得壓狀態列）');
      // 正常位置不動
      p = vkClampPosition({ x: 300, y: 200 }, vp, size, chrome);
      eq(p.x, 300, '範圍內不該被動 x');
      eq(p.y, 200, '範圍內不該被動 y');
    },
  },
  {
    name: '夾邊：面板比可視區還大時貼左上角，至少標題欄看得到',
    run() {
      const p = vkClampPosition({ x: 500, y: 500 }, { width: 200, height: 300 }, { w: 216, h: 400 }, { top: 32, bottom: 28 });
      eq(p.x, 0, '放不下時 x 貼左');
      eq(p.y, 32, '放不下時 y 貼到選單列下緣');
    },
  },
  {
    name: '默認位置在右上角（原版 screen_width-200 / menu_bar_height+60），窄屏會被收回來',
    run() {
      const chrome = { top: 32, bottom: 28 };
      const w = vkPanelSize(2).w;
      const p = vkDefaultPosition({ width: 1200, height: 800 }, chrome);
      // 面板寬 206 > 原版留的 200，故右上角會被 clamp 收進 6px（原版亦然）
      eq(p.x, 1200 - w, '默認 x 收進右邊界');
      if (p.x > 1200 - 200) throw new Error('不該比原版的 W-200 更靠右');
      eq(p.y, 92, '默認 y = 選單列 + 60');
      // 窄屏：整塊面板都得在畫面內
      const narrow = vkDefaultPosition({ width: 300, height: 600 }, chrome);
      if (narrow.x + w > 300) throw new Error(`窄屏默認位置仍超出畫面：${narrow.x} + ${w}`);
      if (narrow.x < 0) throw new Error('窄屏默認位置跑到畫面左邊外');
      // 高度放得下時：面板不能壓到狀態列
      const fits = vkDefaultPosition({ width: 800, height: 600 }, chrome);
      if (fits.y + vkPanelSize(2).h > 600 - 28) throw new Error('放得下卻壓到狀態列');
      // 高度真的放不下（可用 180 < 面板 210）：保住標題欄——貼到選單列下緣，
      // 此時溢出底部是必然，原版也一樣，不該為了不壓狀態列把標題欄推出畫面
      const short = vkDefaultPosition({ width: 800, height: 240 }, chrome);
      eq(short.y, 32, '放不下時貼到選單列下緣');
      if (short.y < 32) throw new Error('放不下時反而壓住了選單列');
    },
  },
  {
    name: '跳到某步：範圍內照跳，超出就夾到最後一步並說清楚（原版語義）',
    run() {
      let r = resolveJumpTarget('3', 10);
      eq(r.ok, true, '範圍內 ok');
      eq(r.target, 3, '範圍內目標');
      eq(r.clamped, false, '範圍內不算夾');
      eq(r.message, '跳到第 3 步', '範圍內文案');

      r = resolveJumpTarget('99', 10);
      eq(r.ok, true, '超出範圍仍可跳');
      eq(r.target, 9, '夾到最後一步');
      eq(r.clamped, true, '標記為已夾');
      eq(r.message, '超出範圍，已跳到第 9 步', '夾後文案');

      eq(resolveJumpTarget('0', 10).ok, true, '第 0 步合法');
      eq(resolveJumpTarget('-1', 10).ok, false, '負數不合法');
      eq(resolveJumpTarget('', 10).ok, false, '空的當沒輸入');
      eq(resolveJumpTarget('abc', 10).ok, false, '非數字不合法');
      eq(resolveJumpTarget('1.5', 10).ok, false, '小數不合法');
      eq(resolveJumpTarget('3', 0).ok, false, '沒有歷史就不能跳');
    },
  },
  {
    name: '粘滯關閉時：撤銷/重做各走一步',
    run() {
      const done = [];
      const p = new StickyPlayer((k) => done.push(k), () => true, 5);
      p.sticky = false;
      eq(p.press('undo'), true, '單步撤銷有走');
      p.press('redo');
      eq(done.join(','), 'undo,redo', '各走一步');
      eq(p.isPlaying, false, '單步不算連播');
    },
  },
  {
    name: '粘滯開啟時：連播，再按一次同鍵就停（原版 _toggle_continuous）',
    async run() {
      const done = [];
      const p = new StickyPlayer((k) => done.push(k), () => true, 5);
      eq(p.sticky, true, '粘滯默認開（對照原版 vk_sticky = True）');
      eq(p.press('undo'), true, '第一次按下開始連播');
      await sleep(40);
      const afterFirst = done.length;
      if (afterFirst < 2) throw new Error(`連播應走多步，實為 ${afterFirst}`);

      eq(p.press('undo'), false, '再按一次是停止，不算走一步');
      await sleep(40);
      eq(done.length, afterFirst, '停止後不該繼續走');
      eq(p.isPlaying, false, '停止後狀態要清乾淨');
    },
  },
  {
    name: '粘滯連播中換方向：前一條要先停，不能兩條計時器並跑',
    async run() {
      const done = [];
      const p = new StickyPlayer((k) => done.push(k), () => true, 5);
      p.press('undo');
      await sleep(20);
      p.press('redo');
      eq(p.playingKind, 'redo', '切到重做');
      await sleep(40);
      // 換方向之後不該再有 undo 混進來
      if (done.slice(done.lastIndexOf('undo') + 1).includes('undo')) {
        throw new Error(`換方向後仍在走 undo：${done.join(',')}`);
      }
      p.stop();
    },
  },
  {
    name: '關掉粘滯會連帶停止連播；不能再走時自動停',
    async run() {
      const done = [];
      const p = new StickyPlayer((k) => done.push(k), () => true, 5);
      p.press('undo');
      await sleep(20);
      p.toggleSticky(); // 開 → 關
      eq(p.sticky, false, '開關已關');
      eq(p.isPlaying, false, '關粘滯要順手停掉連播');
      const n = done.length;
      await sleep(30);
      eq(done.length, n, '關掉後不再走');

      // 不能再走時：按下就該回 false，且不啟動連播
      let steps = 0;
      const q = new StickyPlayer(() => { steps += 1; }, () => false, 5);
      eq(q.press('undo'), false, '不能撤銷時 press 回 false');
      eq(steps, 0, '不能撤銷時一步都不走');
      eq(q.isPlaying, false, '不能撤銷時不該啟動連播');
    },
  },
];
