/**
 * 冒煙測試：用最小 DOM stub 在 Node 裡真跑一遍 app.js，確認初始化不拋錯，
 * 並真的點開幾個選單走一遍新加的交互路徑。
 *
 * 抓的是 tsc 抓不到的問題：TDZ（const 還沒初始化就被用）、事件接線、
 * null 取值。DOM 是假的，所以只驗證「不炸 + 該出現的元素有出現」，不驗證畫面。
 *
 * 用法：npm run smoke（需先 npm run build，因為跑的是產物 app.js）
 */
import fs from 'node:fs';
import vm from 'node:vm';

const noop = () => {};
const rect = { left: 0, top: 0, width: 100, height: 30, right: 100, bottom: 30 };

/** 2D context：任何方法都是 no-op，measureText/createLinearGradient 回可用的形狀 */
const ctx2d = new Proxy(
  {
    canvas: { width: 800, height: 500 },
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  },
  {
    get(t, k) {
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  },
);

function stubEl(tag = 'div') {
  return {
    tagName: String(tag).toUpperCase(),
    // 直接賦值（style.background = …）走一般屬性；setProperty/removeProperty 也要有
    style: { setProperty: noop, removeProperty: noop, getPropertyValue: () => '' },
    dataset: {},
    children: [],
    textContent: '',
    value: '',
    type: '',
    placeholder: '',
    href: '',
    target: '',
    rel: '',
    title: '',
    id: '',
    className: '',
    width: 800,
    height: 500,
    offsetWidth: 200,
    offsetHeight: 300,
    offsetLeft: 0,
    offsetTop: 0,
    clientWidth: 800,
    clientHeight: 500,
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { this.children.push(...cs); },
    prepend(...cs) { this.children.unshift(...cs); },
    insertBefore(c) { this.children.push(c); return c; },
    removeChild(c) { return c; },
    remove: noop,
    // 記下處理器，讓冒煙能真的觸發 click / mouseenter
    addEventListener(type, fn) { (this._h ??= {})[type] ??= []; this._h[type].push(fn); },
    removeEventListener: noop,
    setAttribute: noop,
    getAttribute: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    getBoundingClientRect: () => rect,
    focus: noop,
    click: noop,
    cloneNode() { return stubEl(this.tagName); },
    contains: () => false,
    hasAttribute: () => false,
    closest: () => null,
    getContext: () => ctx2d,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    toDataURL: () => 'data:,',
  };
}

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const body = stubEl('body');
const root = stubEl('div'); // #app
globalThis.document = {
  createElement: stubEl,
  createTextNode: () => stubEl(),
  getElementById: () => stubEl(),
  // app.js 用 querySelector('#app') 取根節點：這裡固定回同一個，後續 appendChild 才看得到
  querySelector: (sel) => (sel === '#app' ? root : null),
  querySelectorAll: () => [],
  addEventListener: noop,
  body,
  documentElement: stubEl('html'),
  head: stubEl('head'),
};
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 800,
  devicePixelRatio: 1,
  addEventListener: noop,
  removeEventListener: noop,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: noop,
  setTimeout,
  clearTimeout,
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  location: { href: 'file:///game.html', search: '' },
  open: noop,
  localStorage: globalThis.localStorage,
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = noop;
// Node 22 的 navigator 是唯讀 getter，只能用 defineProperty 蓋
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node-smoke', language: 'zh-CN' },
  configurable: true,
  writable: true,
});
globalThis.Image = class { constructor() { this.complete = false; } set src(v) { this._src = v; } };
globalThis.URL.createObjectURL = () => 'blob:stub';
globalThis.Blob = class {};

import path from 'node:path';
const code = fs.readFileSync(path.join(import.meta.dirname, '..', 'app.js'), 'utf8');

/** 深度走訪 stub 出的 DOM 樹（只走 children） */
function walk(el, out = []) {
  for (const c of el.children) { out.push(c); walk(c, out); }
  return out;
}
const findEl = (pred) => walk(root).find(pred) ?? null;
const findAll = (pred) => walk(root).filter(pred);
function fire(el, type, ev = {}) {
  if (!el) throw new Error(`要觸發 ${type} 的元素不存在`);
  const hs = el._h?.[type] ?? [];
  if (hs.length === 0) throw new Error(`元素沒有 ${type} 處理器`);
  for (const h of hs) h({ stopPropagation: noop, preventDefault: noop, target: el, ...ev });
}

let failed = 0;
const check = (ok, msg) => {
  if (ok) console.log(`  ✔ ${msg}`);
  else { failed += 1; console.log(`  ✘ ${msg}`); }
};

try {
  vm.runInThisContext(code, { filename: 'app.js' });
  console.log('✔ app.js 初始化未拋錯');

  // ---- 選單列 ----
  const menuItems = findAll((e) => e.dataset?.menuItem === '1');
  const labels = menuItems.map((e) => e.textContent);
  console.log(`  選單列：${labels.join(' / ')}`);
  check(labels.join(',') === '文件,编辑,谜题,宏定义,设置,搜索,帮助,教程,官网',
    '選單列 9 項且「搜索」在设置与帮助之间（對照原版 menu_items）');

  // ---- 谜题 → 二級子菜單 ----
  fire(menuItems[2], 'click');
  const dd = findEl((e) => e.dataset?.dropdown === '1');
  check(!!dd, '點「谜题」會開出下拉');
  const rowTexts = dd ? dd.children.map((c) => c.children[0]?.textContent ?? c.textContent) : [];
  check(rowTexts.includes('矩形谜题') && rowTexts.includes('异形谜题'),
    '一级菜单出现「矩形谜题 ▸」「异形谜题 ▸」');
  check(rowTexts.some((t) => String(t).startsWith('当前：')), '底部有「当前：…」狀態行');

  const rectRow = dd?.children.find((c) => (c.children[0]?.textContent ?? '') === '矩形谜题');
  fire(rectRow, 'mouseenter');
  const sub = findEl((e) => e.dataset?.subdropdown === '1');
  check(!!sub, '懸停「矩形谜题」展開二級子菜單');
  const subTexts = sub ? sub.children.map((c) => c.children[0]?.textContent ?? c.textContent) : [];
  check(subTexts.some((t) => String(t).startsWith('等级')), '二級子菜單有分組標題（等级1/2/3）');
  check(subTexts.includes('6×6 等级3'), '二級子菜單列出具體檔位（例：6×6 等级3）');

  // 點二級子菜單裡的檔位 → 換謎題（handler 走 preset 分支）
  const presetRow = sub?.children.find((c) => (c.children[0]?.textContent ?? '') === '6×6 等级3');
  fire(presetRow, 'click');
  check(true, '點二級檔位未拋錯（走 preset → handlePresetPuzzle）');

  // ---- 搜索 → 命令面板 ----
  const searchItem = menuItems.find((e) => e.textContent === '搜索');
  fire(searchItem, 'click'); // 先開下拉
  const searchDd = findAll((e) => e.dataset?.dropdown === '1').at(-1);
  const cmdRow = searchDd?.children.find((c) => (c.children[0]?.textContent ?? '') === '命令面板 Ctrl+K');
  check(!!cmdRow, '「搜索」下拉有「命令面板 Ctrl+K」');
  fire(cmdRow, 'click'); // 再點那一列才真的叫出面板
  // 注意：初始化時別的對話框也建過 input，這裡挑「有 keydown 處理器」的那個（面板自己的）
  const input = findAll((e) => e.tagName === 'INPUT').find((e) => e._h?.keydown);
  check(!!input, '「搜索」叫出命令面板（含輸入框）');
  if (input) {
    fire(input, 'keydown', { key: 'ArrowDown' });
    fire(input, 'keydown', { key: 'Enter' });
    check(true, '命令面板 ↑↓/Enter 未拋錯');
  }

  // ---- 常駐撤銷/重做條（手機端不必調出虛擬鍵盤也能用） ----
  const allBtns = findAll((e) => e.tagName === 'BUTTON');
  const quickUndo = allBtns.find((e) => String(e.textContent).includes('撤销'));
  const quickRedo = allBtns.find((e) => String(e.textContent).includes('重做'));
  check(!!quickUndo && !!quickRedo, '常駐條有「撤销」「重做」');
  check(quickUndo?._h?.click === true || !!quickUndo?._h?.click, '常駐撤销接上了 click');
  if (quickUndo) {
    fire(quickUndo, 'click');
    check(true, '點常駐撤销未拋錯');
  }

  // ---- 控制模式對話框：原版五個開關 ----
  const setItem = menuItems.find((e) => e.textContent === '设置');
  fire(setItem, 'click');
  const setDd = findAll((e) => e.dataset?.dropdown === '1').at(-1);
  const ctrlRow = setDd?.children.find((c) => (c.children[0]?.textContent ?? '') === '控制模式...');
  check(!!ctrlRow, '「设置」有「控制模式...」');
  fire(ctrlRow, 'click');
  // 開關按鈕的開/關文字（UI 文案已統一為簡體）
  const swBtns = findAll((e) => e.tagName === 'BUTTON')
    .filter((e) => e.textContent === '开' || e.textContent === '关');
  check(swBtns.length >= 5, `控制模式有五個開關（實為 ${swBtns.length}）`);
  if (swBtns.length >= 5) {
    fire(swBtns[0], 'click');
    check(true, '切換控制開關未拋錯');
  }

  // ---- 成績錄入：DNF 後面板應即時出現新行 ----
  // 回歸測試：入庫原本只寫 localStorage，面板（桌面端默認展開）不刷新，
  // 玩家 DNF 後看面板還是舊的，等於「沒有及時計入成績」。
  // 路徑全走 UI：謎題選單切競速 → 編輯選單打亂（計時器進就緒）→ 點計時區兩次（開始→放棄）
  fire(menuItems[2], 'click'); // 謎題
  const pzDd2 = findAll((e) => e.dataset?.dropdown === '1').at(-1);
  const timedRow = pzDd2?.children.find((c) => (c.children[0]?.textContent ?? '') === '模式:竞速');
  check(!!timedRow, '「谜题」有「模式:竞速」');
  if (timedRow) {
    fire(timedRow, 'click');
    const editItem = menuItems.find((e) => e.textContent === '编辑');
    fire(editItem, 'click');
    const edDd = findAll((e) => e.dataset?.dropdown === '1').at(-1);
    const shuffleRow = edDd?.children.find((c) => (c.children[0]?.textContent ?? '') === '打乱 Alt+S');
    check(!!shuffleRow, '「编辑」有「打乱 Alt+S」');
    if (shuffleRow) {
      fire(shuffleRow, 'click'); // 競速下打亂 → 計時器進入就緒
      // 狀態列：高 28px、剛好五個子元素（狀態/步數/計時/謎題/縮放）的那個；第三個是計時區
      const statusBar = walk(root).find((e) => e.children.length === 5 && e.style?.height === '28px');
      const stTimerEl = statusBar?.children[2];
      check(!!stTimerEl && (stTimerEl._h?.click?.length ?? 0) > 0,
        '計時區接上了 click（手機端 DNF 入口，對照原版 _timer_bar_rect）');
      if (stTimerEl) {
        fire(stTimerEl, 'click'); // 就緒 → 開始計時
        fire(stTimerEl, 'click'); // 計時中 → 放棄(DNF)
        const dnfCells = findAll((e) => e.textContent === 'DNF');
        check(dnfCells.length > 0, 'DNF 後成績面板即時出現 DNF 行（不用手動開關面板）');
        const saved = JSON.parse(store['gatennea-slider-web:records'] ?? '{}');
        const all = Object.values(saved).flat();
        check(all.length === 1 && all[0].dnf === true,
          `DNF 已寫入 localStorage（實為 ${all.length} 條，dnf=${all[0]?.dnf}）`);
      }
    }
  }
} catch (e) {
  console.error('✘ 拋錯：', e && e.stack ? e.stack.split('\n').slice(0, 6).join('\n') : e);
  process.exitCode = 1;
}

if (failed > 0) process.exitCode = 1;
console.log(failed === 0 ? '\n冒煙通過' : `\n冒煙失敗 ${failed} 項`);
process.exit(process.exitCode ?? 0);
