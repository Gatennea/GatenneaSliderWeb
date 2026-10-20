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

import type { GameStore } from '../store/GameStore.js';
import type { BoardRenderer } from '../render/BoardRenderer.js';
import type { BoardController } from '../interaction/BoardController.js';
import { SliderMatrix } from '../core/SliderMatrix.js';
import { COLORS, GEOMETRY } from '../render/theme.js';

const BRAND = '#4696c8';
const EDITOR_SIZE = 12; // 手動構造網格 12×12

export interface CreativeHost {
  store: GameStore;
  renderer: BoardRenderer;
  controller: BoardController;
  app: HTMLElement;
  schedulePaint: () => void;
  showToast: (s: string) => void;
  centerCamera: () => void;
  /** 套用一段局面為新謎題；solution 非 null 表示自定義目標形狀（會顯示虛影）。 */
  applyAsPuzzle: (
    m: number,
    n: number,
    step: number,
    blocks: [number, number][],
    solution: Set<string> | null,
  ) => void;
  /** 切換到創造模式（main 負責改 gameMode、歸位計時器）。 */
  enterCreative: () => void;
  /** 退出創造模式回到練習。 */
  exitCreative: () => void;
}

export class CreativeController {
  private host: CreativeHost;
  private panel: HTMLElement;
  private editor: HTMLElement | null = null;

  constructor(host: CreativeHost) {
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

  private buildPanel(): void {
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
    const mkNum = (label: string, def: number): HTMLInputElement => {
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
    grid.append(
      this.mkBtn('随机生成（挖洞）', true, () => this.randomGen(mInp, nInp, sInp, false)),
      this.mkBtn('随机生成（缺口）', true, () => this.randomGen(mInp, nInp, sInp, true)),
      this.mkBtn('手动构造…', false, () => this.openEditor(sInp)),
      this.mkBtn('退出创造模式', false, () => this.host.exitCreative()),
    );
    this.panel.appendChild(grid);
  }

  enter(): void {
    this.host.enterCreative();
    this.panel.style.display = 'flex';
    this.host.showToast('创造模式：生成谜题后自由还原');
    this.host.schedulePaint();
  }
  exit(): void {
    this.panel.style.display = 'none';
    this.closeEditor();
  }

  // ---------- 隨機生成 ----------
  private randomGen(
    mInp: HTMLInputElement,
    nInp: HTMLInputElement,
    sInp: HTMLInputElement,
    edgeOnly: boolean,
  ): void {
    const m = clampInt(mInp.value, 2, 20, 6);
    const n = clampInt(nInp.value, 2, 20, 6);
    const step = clampInt(sInp.value, 1, Math.max(m, n) - 1, 2);
    const blocks = this.buildRandomShape(m, n, edgeOnly);
    this.host.applyAsPuzzle(m, n, step, blocks, null);
    this.host.showToast(edgeOnly ? '已生成「缺口」谜题' : '已生成「挖洞」谜题');
  }

  /** 完整矩形挖掉一格並在外側補一個凸起；保證連通且可還原為實心矩形。 */
  private buildRandomShape(m: number, n: number, edgeOnly: boolean): [number, number][] {
    const rect: [number, number][] = [];
    for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) rect.push([r, c]);

    const candidates: [number, number][] = [];
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) {
        const edge = r === 0 || c === 0 || r === m - 1 || c === n - 1;
        if (edgeOnly ? edge : !edge) candidates.push([r, c]);
      }
    }
    if (candidates.length === 0) candidates.push([Math.floor(m / 2), Math.floor(n / 2)]);
    const [hr, hc] = candidates[Math.floor(Math.random() * candidates.length)];

    // 找一個「外側、且與挖掉格的某個剩餘鄰格相鄰」的凸起格 → 保證連通
    const neighbors = ([
      [hr - 1, hc],
      [hr + 1, hc],
      [hr, hc - 1],
      [hr, hc + 1],
    ] as [number, number][]).filter(
      ([r, c]) => r >= 0 && r < m && c >= 0 && c < n && !(r === hr && c === hc),
    );
    const outs: [number, number][] = [];
    for (const [r, c] of neighbors) {
      outs.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }
    const protrusion = outs.find(([r, c]) => r < 0 || r >= m || c < 0 || c >= n)!;

    const set = new Set(rect.map(([r, c]) => `${r}:${c}`));
    set.delete(`${hr}:${hc}`);
    set.add(`${protrusion[0]}:${protrusion[1]}`);
    return [...set].map((k) => k.split(':').map(Number) as [number, number]);
  }

  // ---------- 手動構造 ----------
  private openEditor(sInp: HTMLInputElement): void {
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

    const cells = new Set<string>();
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${EDITOR_SIZE}, 22px)`;
    grid.style.gap = '2px';
    const cellEls: HTMLElement[] = [];
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
          if (cells.has(key)) cells.delete(key);
          else cells.add(key);
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
    btnRow.appendChild(
      this.mkBtn('应用为谜题', true, () => {
        const shape: [number, number][] = [...cells].map((k): [number, number] => {
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
        const scrambled = tmp.blocks.map((b) => [b.row, b.col] as [number, number]);
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
      }),
    );
    btnRow.appendChild(this.mkBtn('清空', false, () => {
      cells.clear();
      for (const el of cellEls) el.style.background = COLORS.input_bg;
    }));
    btnRow.appendChild(this.mkBtn('取消', false, () => this.closeEditor()));
    box.appendChild(btnRow);

    overlay.appendChild(box);
    this.host.app.appendChild(overlay);
    this.editor = overlay;
  }

  private closeEditor(): void {
    if (this.editor) {
      this.editor.remove();
      this.editor = null;
    }
  }

  private mkBtn(label: string, primary: boolean, onClick: () => void): HTMLElement {
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

function clampInt(v: string, lo: number, hi: number, def: number): number {
  const x = Math.floor(Number(v));
  if (!Number.isFinite(x)) return def;
  return Math.max(lo, Math.min(hi, x));
}
