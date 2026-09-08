/**
 * 命中測試（M2）——對照 GUI.py 的 get_block_at_pos / get_gap_at_pos / get_cell_at_pos。
 * BoardRenderer 的命中方法不觸碰 ctx，可用假 ctx 實例化。
 */
import { BoardRenderer } from '../dist/render/BoardRenderer.js';
import { GameStore } from '../dist/store/GameStore.js';

const CELL = 60;
const GAP = 4;
const STEP = CELL + GAP; // 64

function makeRenderer() {
  return new BoardRenderer({ canvas: { width: 800, height: 500 } }, 1);
}

export const cases = [
  {
    name: '初始 4×4：方塊命中共中心',
    run() {
      const store = new GameStore(4, 4, 2);
      const r = makeRenderer();
      // block (0,0) 中心 = (30,30)
      const b = r.getBlockAtPos(30, 30, store);
      if (!b || b.row !== 0 || b.col !== 0) throw new Error('應命中 (0,0)');
    },
  },
  {
    name: '點在縫隙上 → getBlockAtPos 回 null，getGapAtPos 命中',
    run() {
      const store = new GameStore(4, 4, 2);
      const r = makeRenderer();
      // h 線 line=0（row 0 與 row 1 之間）：gap_y = 1*STEP - GAP/2 = 62
      const gapY = 1 * STEP - GAP / 2;
      const screenY = gapY; // camera=0, zoom=1
      if (r.getBlockAtPos(30, screenY, store) !== null) throw new Error('縫隙處不應命中方塊');
      const gap = r.getGapAtPos(30, screenY, store);
      if (!gap || gap.type !== 'h' || gap.line !== 0) throw new Error(`應命中 h 0，實為 ${JSON.stringify(gap)}`);
    },
  },
  {
    name: '縫隙命中只在合法範圍內（is_valid_h_line 過濾）',
    run() {
      const store = new GameStore(4, 4, 2);
      const r = makeRenderer();
      // 邊界縫隙 line=min_row=0 合法；line=bounds.max_row (=3) 不合法
      // i 迴圈：line = i-1，共 i in [min_row, max_row+1] = [0..4]
      // line=3 → i=4 → gap_y=4*STEP-GAP/2=254，應被 is_valid_h_line(3) = min_row<=3<max_row(3)? 3<3 false → 不合法
      const invalidY = 4 * STEP - GAP / 2; // 254
      const gap = r.getGapAtPos(30, invalidY, store);
      if (gap !== null) throw new Error(`邊界外縫隙不應命中，實為 ${JSON.stringify(gap)}`);
    },
  },
  {
    name: 'getCellAtPos 落在縫隙上回 null',
    run() {
      const store = new GameStore(4, 4, 2);
      const r = makeRenderer();
      const cell = r.getCellAtPos(30, 30); // (0,0) 內
      if (!cell || cell[0] !== 0 || cell[1] !== 0) throw new Error('應為 (0,0)');
      const gap = r.getCellAtPos(30, 1 * STEP - GAP / 2); // 縫隙
      if (gap !== null) throw new Error('縫隙點應回 null');
    },
  },
  {
    name: 'shuffle 後座標可為負，命中仍正確',
    run() {
      const store = new GameStore(4, 4, 2);
      store.game.shuffle(20, 2);
      const r = makeRenderer();
      const b = store.game.get_boundaries();
      // 取第一個方塊其中心，應能命中該方塊本身
      const block = store.game.blocks[0];
      const cx = block.col * STEP + CELL / 2;
      const cy = block.row * STEP + CELL / 2;
      const hit = r.getBlockAtPos(cx, cy, store);
      if (!hit || hit.row !== block.row || hit.col !== block.col) {
        throw new Error('應命中該方塊本身');
      }
      // bounds 可能為負，但不影響 is_blank_area 判定
      const blank = r.isBlankArea(cx, cy, store);
      if (blank) throw new Error('方塊處不應為空白');
    },
  },
  {
    name: 'camera ≠ 0 時縫隙與方塊仍正確對齊（回歸：縫隙錯位 bug）',
    run() {
      const store = new GameStore(4, 4, 2);
      const r = makeRenderer();
      r.cameraX = 123.5;
      r.cameraY = -87.25;

      // block (0,0) 中心：世界 (30,30) → 螢幕 (30+camX, 30+camY)
      const bx = 30 + r.cameraX;
      const by = 30 + r.cameraY;
      if (r.getBlockAtPos(bx, by, store) === null) throw new Error('camera 偏移後方塊應可命中');

      // 縫隙 h line=0：世界 y = 1*STEP - GAP/2 = 62 → 螢幕 y = 62 + camY
      const gapY = 1 * STEP - GAP / 2 + r.cameraY;
      const gap = r.getGapAtPos(30 + r.cameraX, gapY, store);
      if (!gap || gap.type !== 'h' || gap.line !== 0) {
        throw new Error(`camera 偏移後應命中 h 0，實為 ${JSON.stringify(gap)}`);
      }

      // 縫隙 v line=0：世界 x = 1*STEP - GAP/2 = 62 → 螢幕 x = 62 + camX
      const gapX = 1 * STEP - GAP / 2 + r.cameraX;
      const vgap = r.getGapAtPos(gapX, 30 + r.cameraY, store);
      if (!vgap || vgap.type !== 'v' || vgap.line !== 0) {
        throw new Error(`camera 偏移後應命中 v 0，實為 ${JSON.stringify(vgap)}`);
      }
    },
  },
];
